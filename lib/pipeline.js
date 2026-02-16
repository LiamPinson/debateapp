// ============================================================
// Post-Debate Pipeline
// ============================================================
// Triggered when a debate ends. Orchestrates:
// 1. Stop recording → get download link
// 2. Transcribe with Deepgram
// 3. Run two-tiered AI scoring
// 4. Write results to DB
// 5. Update user stats
// 6. Notify participants
// ============================================================

import { createServiceClient } from "./supabase.js";
import { stopRecording, getRecordingLink, deleteDailyRoom } from "./daily.js";
import { transcribeAudio, labelTranscriptSpeakers } from "./deepgram.js";
import { runFullAnalysis } from "./scoring.js";

/**
 * Full post-debate processing pipeline.
 * Called when debate.status transitions to 'completed'.
 *
 * @param {string} debateId
 */
export async function processDebateCompletion(debateId) {
  const db = createServiceClient();

  // 1. Get debate record
  const { data: debate, error } = await db
    .from("debates")
    .select("*, topics(*)")
    .eq("id", debateId)
    .single();

  if (error || !debate) {
    console.error(`Pipeline: debate ${debateId} not found`, error);
    return;
  }

  console.log(`Pipeline: processing debate ${debateId}`);

  // 2. Stop recording and get download link
  let audioUrl = null;
  if (debate.daily_room_name) {
    try {
      const recording = await stopRecording(debate.daily_room_name);
      if (recording?.id) {
        // Daily.co takes a few minutes to process recordings.
        // We'll poll for the download link.
        await db
          .from("debates")
          .update({
            recording_id: recording.id,
            transcript_status: "processing",
          })
          .eq("id", debateId);

        // Wait for recording to be available (poll every 10s, max 5 min)
        audioUrl = await pollForRecording(recording.id, 30, 10000);

        if (audioUrl) {
          await db
            .from("debates")
            .update({ audio_url_combined: audioUrl })
            .eq("id", debateId);
        }
      }
    } catch (err) {
      console.error(`Pipeline: recording retrieval failed`, err);
    }
  }

  // 3. Transcribe
  let transcript = null;
  let labeledTranscript = null;

  if (audioUrl) {
    try {
      const rawTranscript = await transcribeAudio(audioUrl);
      const labeled = labelTranscriptSpeakers(rawTranscript.segments);

      transcript = {
        segments: labeled.labeled_segments,
        full_text: labeled.full_labeled_text,
        pro_text: labeled.pro_text,
        con_text: labeled.con_text,
        duration: rawTranscript.duration,
      };

      labeledTranscript = labeled.full_labeled_text;

      await db
        .from("debates")
        .update({
          transcript,
          transcript_status: "completed",
        })
        .eq("id", debateId);
    } catch (err) {
      console.error(`Pipeline: transcription failed`, err);
      await db
        .from("debates")
        .update({ transcript_status: "failed" })
        .eq("id", debateId);
    }
  }

  // 4. AI Scoring (runs even without perfect transcript)
  const topicTitle = debate.topics?.title || "Unknown topic";
  const transcriptText = labeledTranscript || "[Transcript unavailable]";

  try {
    await db
      .from("debates")
      .update({ scoring_status: "processing" })
      .eq("id", debateId);

    const analysis = await runFullAnalysis(topicTitle, transcriptText, debate.time_limit);

    const proScore = analysis.qualitative?.pro_player?.overall_quality || 50;
    const conScore = analysis.qualitative?.con_player?.overall_quality || 50;

    await db
      .from("debates")
      .update({
        ai_procedural_analysis: analysis.procedural,
        ai_qualitative_analysis: analysis.qualitative,
        pro_quality_score: proScore,
        con_quality_score: conScore,
        scoring_status: "completed",
      })
      .eq("id", debateId);

    // 5. Process strikes (queue for admin review)
    await processStrikes(db, debate, analysis.procedural);

    // 6. Update user stats
    await updateUserStats(db, debate, proScore, conScore);

    // 7. Notify participants
    await notifyParticipants(db, debate, analysis);

  } catch (err) {
    console.error(`Pipeline: scoring failed`, err);
    await db
      .from("debates")
      .update({ scoring_status: "failed" })
      .eq("id", debateId);
  }

  // 8. Clean up Daily.co room
  if (debate.daily_room_name) {
    try {
      await deleteDailyRoom(debate.daily_room_name);
    } catch (err) {
      console.error(`Pipeline: room cleanup failed`, err);
    }
  }

  console.log(`Pipeline: debate ${debateId} processing complete`);
}

/**
 * Poll Daily.co for recording download link.
 */
async function pollForRecording(recordingId, maxAttempts, intervalMs) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await getRecordingLink(recordingId);
      if (result?.download_link) {
        return result.download_link;
      }
    } catch (_) {
      // Recording not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.warn(`Recording ${recordingId} not available after ${maxAttempts} attempts`);
  return null;
}

/**
 * Process Tier 1 strike flags — creates strike records for admin review.
 */
async function processStrikes(db, debate, procedural) {
  if (!procedural) return;

  const sides = [
    { key: "pro_strikes", userId: debate.pro_user_id, sessionId: debate.pro_session_id },
    { key: "con_strikes", userId: debate.con_user_id, sessionId: debate.con_session_id },
  ];

  for (const side of sides) {
    const strikes = procedural[side.key];
    if (!strikes) continue;

    for (const [reason, flagged] of Object.entries(strikes)) {
      if (!flagged) continue;

      // Find the corresponding flagged moment for confidence
      const moment = procedural.flagged_moments?.find(
        (m) => m.type === reason && m.speaker === (side.key === "pro_strikes" ? "Pro" : "Con")
      );

      await db.from("strikes").insert({
        user_id: side.userId || null,
        session_id: side.sessionId || null,
        debate_id: debate.id,
        reason,
        ai_confidence: moment?.confidence || 0.9,
        transcript_excerpt: moment?.transcript_excerpt || null,
        admin_reviewed: false,
        admin_decision: "pending",
      });
    }
  }
}

/**
 * Update user quality scores and W/L records.
 * Quality score uses recency-weighted rolling average.
 */
async function updateUserStats(db, debate, proScore, conScore) {
  const updates = [
    { userId: debate.pro_user_id, score: proScore },
    { userId: debate.con_user_id, score: conScore },
  ];

  for (const { userId, score } of updates) {
    if (!userId) continue;

    const { data: user } = await db
      .from("users")
      .select("quality_score_avg, total_debates")
      .eq("id", userId)
      .single();

    if (!user) continue;

    // Recency-weighted average: 80% old score, 20% new score
    const newAvg =
      user.total_debates === 0
        ? score
        : Math.round(user.quality_score_avg * 0.8 + score * 0.2);

    await db
      .from("users")
      .update({
        quality_score_avg: Math.max(0, Math.min(100, newAvg)),
        total_debates: user.total_debates + 1,
      })
      .eq("id", userId);
  }

  // Update topic debate count
  if (debate.topic_id) {
    await db.rpc("increment_topic_debate_count", { topic_uuid: debate.topic_id }).catch(() => {
      // Fallback: manual increment
      db.from("topics")
        .select("debate_count")
        .eq("id", debate.topic_id)
        .single()
        .then(({ data }) => {
          if (data) {
            db.from("topics")
              .update({ debate_count: (data.debate_count || 0) + 1 })
              .eq("id", debate.topic_id);
          }
        });
    });
  }
}

/**
 * Send in-app notifications to debate participants.
 */
async function notifyParticipants(db, debate, analysis) {
  const participants = [
    { userId: debate.pro_user_id, side: "pro" },
    { userId: debate.con_user_id, side: "con" },
  ];

  for (const { userId, side } of participants) {
    if (!userId) continue;

    const playerScores = analysis.qualitative?.[`${side}_player`];
    const overallScore = playerScores?.overall_quality || "N/A";

    await db.from("notifications").insert({
      user_id: userId,
      type: "debate_scored",
      title: "Your debate has been scored!",
      body: `Overall quality: ${overallScore}/100. View the full breakdown.`,
      data: {
        debate_id: debate.id,
        overall_score: overallScore,
      },
    });
  }
}

/**
 * Handle debate forfeit.
 */
export async function processDebateForfeit(debateId, forfeitingSide) {
  const db = createServiceClient();

  const { data: debate } = await db
    .from("debates")
    .select("*")
    .eq("id", debateId)
    .single();

  if (!debate) return;

  const winner = forfeitingSide === "pro" ? "con" : "pro";
  const winnerId = winner === "pro" ? debate.pro_user_id : debate.con_user_id;
  const loserId = forfeitingSide === "pro" ? debate.pro_user_id : debate.con_user_id;

  // Update debate
  await db
    .from("debates")
    .update({
      status: "forfeited",
      phase: "ended",
      winner,
      winner_source: "forfeit",
      completed_at: new Date().toISOString(),
    })
    .eq("id", debateId);

  // Update W/L records
  if (winnerId) {
    await db.rpc("increment_wins", { user_uuid: winnerId }).catch(async () => {
      const { data } = await db.from("users").select("wins, total_debates").eq("id", winnerId).single();
      if (data) await db.from("users").update({ wins: data.wins + 1, total_debates: data.total_debates + 1 }).eq("id", winnerId);
    });
  }
  if (loserId) {
    await db.rpc("increment_losses", { user_uuid: loserId }).catch(async () => {
      const { data } = await db.from("users").select("losses, total_debates").eq("id", loserId).single();
      if (data) await db.from("users").update({ losses: data.losses + 1, total_debates: data.total_debates + 1 }).eq("id", loserId);
    });
  }

  // Cleanup room
  if (debate.daily_room_name) {
    try {
      await stopRecording(debate.daily_room_name);
      await deleteDailyRoom(debate.daily_room_name);
    } catch (_) {}
  }
}
