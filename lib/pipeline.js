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
//
// Each step is tracked independently. Failures in one step
// don't block independent downstream steps. The pipeline
// state is persisted so failed steps can be retried.
// ============================================================

import { createServiceClient } from "./supabase.js";
import { stopRecording, getRecordingLink, deleteDailyRoom } from "./daily.js";
import { transcribeAudio, labelTranscriptSpeakers } from "./deepgram.js";
import { runFullAnalysis } from "./scoring.js";

/**
 * Pipeline step status values.
 */
const STEP = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
};

/**
 * Initialize default pipeline state for all steps.
 */
function defaultPipelineState() {
  return {
    recording: { status: STEP.PENDING, error: null, attempts: 0 },
    transcription: { status: STEP.PENDING, error: null, attempts: 0 },
    scoring: { status: STEP.PENDING, error: null, attempts: 0 },
    strikes: { status: STEP.PENDING, error: null, attempts: 0 },
    user_stats: { status: STEP.PENDING, error: null, attempts: 0 },
    notifications: { status: STEP.PENDING, error: null, attempts: 0 },
    cleanup: { status: STEP.PENDING, error: null, attempts: 0 },
    started_at: new Date().toISOString(),
    completed_at: null,
  };
}

/**
 * Persist pipeline state to the debates table.
 */
async function savePipelineState(db, debateId, pipelineState) {
  await db
    .from("debates")
    .update({ pipeline_state: pipelineState })
    .eq("id", debateId);
}

/**
 * Run a single pipeline step with error isolation.
 * Tracks attempts, captures errors, and persists state.
 */
async function runStep(db, debateId, pipelineState, stepName, fn) {
  const step = pipelineState[stepName];
  if (step.status === STEP.COMPLETED) return true;

  step.status = STEP.RUNNING;
  step.attempts += 1;
  await savePipelineState(db, debateId, pipelineState);

  try {
    await fn();
    step.status = STEP.COMPLETED;
    step.error = null;
    await savePipelineState(db, debateId, pipelineState);
    return true;
  } catch (err) {
    step.status = STEP.FAILED;
    step.error = err.message || String(err);
    await savePipelineState(db, debateId, pipelineState);
    console.error(`Pipeline step '${stepName}' failed for debate ${debateId}:`, err);
    return false;
  }
}

/**
 * Full post-debate processing pipeline.
 * Called when debate.status transitions to 'completed'.
 *
 * @param {string} debateId
 * @param {Object} [existingState] - Resume from existing pipeline state
 */
export async function processDebateCompletion(debateId, existingState) {
  const db = createServiceClient();

  // 1. Get debate record
  const { data: debate, error } = await db
    .from("debates")
    .select("*, topics(*)")
    .eq("id", debateId)
    .single();

  if (error || !debate) {
    console.error(`Pipeline: debate ${debateId} not found`, error);
    return { success: false, error: "Debate not found" };
  }

  console.log(`Pipeline: processing debate ${debateId}`);

  // Initialize or resume pipeline state
  const pipelineState = existingState || debate.pipeline_state || defaultPipelineState();
  await savePipelineState(db, debateId, pipelineState);

  // Shared mutable context for passing data between steps
  let audioUrl = debate.audio_url_combined || null;
  let labeledTranscript = debate.transcript?.full_text || null;

  // ── Step 1: Stop recording and get download link ──
  if (debate.daily_room_name) {
    await runStep(db, debateId, pipelineState, "recording", async () => {
      const recording = await stopRecording(debate.daily_room_name);
      if (!recording?.id) {
        // No recording ID — mark as skipped rather than failed
        pipelineState.recording.status = STEP.SKIPPED;
        return;
      }

      await db
        .from("debates")
        .update({
          recording_id: recording.id,
          transcript_status: "processing",
        })
        .eq("id", debateId);

      // Poll for recording (30 attempts × 10s = 5 min max)
      audioUrl = await pollForRecording(recording.id, 30, 10000);

      if (audioUrl) {
        await db
          .from("debates")
          .update({ audio_url_combined: audioUrl })
          .eq("id", debateId);
      } else {
        throw new Error("Recording not available after polling timeout");
      }
    });
  } else {
    pipelineState.recording.status = STEP.SKIPPED;
    await savePipelineState(db, debateId, pipelineState);
  }

  // ── Step 2: Transcribe ──
  if (audioUrl) {
    await runStep(db, debateId, pipelineState, "transcription", async () => {
      const rawTranscript = await transcribeAudio(audioUrl);
      const labeled = labelTranscriptSpeakers(rawTranscript.segments);

      const transcript = {
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
    });

    if (pipelineState.transcription.status === STEP.FAILED) {
      await db
        .from("debates")
        .update({ transcript_status: "failed" })
        .eq("id", debateId);
    }
  } else if (pipelineState.recording.status !== STEP.COMPLETED) {
    pipelineState.transcription.status = STEP.SKIPPED;
    await savePipelineState(db, debateId, pipelineState);
  }

  // ── Step 3: AI Scoring (runs even without perfect transcript) ──
  const topicTitle = debate.topics?.title || "Unknown topic";
  const transcriptText = labeledTranscript || "[Transcript unavailable]";
  let analysis = null;

  await runStep(db, debateId, pipelineState, "scoring", async () => {
    await db
      .from("debates")
      .update({ scoring_status: "processing" })
      .eq("id", debateId);

    analysis = await runFullAnalysis(topicTitle, transcriptText, debate.time_limit);

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
  });

  if (pipelineState.scoring.status === STEP.FAILED) {
    await db
      .from("debates")
      .update({ scoring_status: "failed" })
      .eq("id", debateId);
  }

  // ── Step 4: Process strikes (independent of stats/notifications) ──
  if (analysis?.procedural) {
    await runStep(db, debateId, pipelineState, "strikes", async () => {
      await processStrikes(db, debate, analysis.procedural);
    });
  } else {
    pipelineState.strikes.status = STEP.SKIPPED;
    await savePipelineState(db, debateId, pipelineState);
  }

  // ── Step 5: Update user stats ──
  if (analysis?.qualitative) {
    const proScore = analysis.qualitative?.pro_player?.overall_quality || 50;
    const conScore = analysis.qualitative?.con_player?.overall_quality || 50;

    await runStep(db, debateId, pipelineState, "user_stats", async () => {
      await updateUserStats(db, debate, proScore, conScore);
    });
  } else {
    pipelineState.user_stats.status = STEP.SKIPPED;
    await savePipelineState(db, debateId, pipelineState);
  }

  // ── Step 6: Notify participants ──
  if (analysis) {
    await runStep(db, debateId, pipelineState, "notifications", async () => {
      await notifyParticipants(db, debate, analysis);
    });
  } else {
    pipelineState.notifications.status = STEP.SKIPPED;
    await savePipelineState(db, debateId, pipelineState);
  }

  // ── Step 7: Clean up Daily.co room ──
  if (debate.daily_room_name) {
    await runStep(db, debateId, pipelineState, "cleanup", async () => {
      await deleteDailyRoom(debate.daily_room_name);
    });
  } else {
    pipelineState.cleanup.status = STEP.SKIPPED;
    await savePipelineState(db, debateId, pipelineState);
  }

  // ── Finalize ──
  pipelineState.completed_at = new Date().toISOString();
  await savePipelineState(db, debateId, pipelineState);

  const failedSteps = Object.entries(pipelineState)
    .filter(([k, v]) => typeof v === "object" && v?.status === STEP.FAILED)
    .map(([k]) => k);

  if (failedSteps.length > 0) {
    console.warn(`Pipeline: debate ${debateId} completed with failures: ${failedSteps.join(", ")}`);
  } else {
    console.log(`Pipeline: debate ${debateId} processing complete`);
  }

  return {
    success: failedSteps.length === 0,
    failedSteps,
    pipelineState,
  };
}

/**
 * Retry failed pipeline steps for a debate.
 * Resumes from persisted pipeline state, only re-running failed steps.
 *
 * @param {string} debateId
 * @returns {Promise<Object>} Pipeline result
 */
export async function retryFailedSteps(debateId) {
  const db = createServiceClient();

  const { data: debate } = await db
    .from("debates")
    .select("pipeline_state")
    .eq("id", debateId)
    .single();

  if (!debate?.pipeline_state) {
    return { success: false, error: "No pipeline state found — run full pipeline first" };
  }

  const state = debate.pipeline_state;

  // Reset failed steps to pending so they re-run
  for (const [key, val] of Object.entries(state)) {
    if (typeof val === "object" && val?.status === STEP.FAILED) {
      val.status = STEP.PENDING;
      val.error = null;
    }
  }
  state.completed_at = null;

  return processDebateCompletion(debateId, state);
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
