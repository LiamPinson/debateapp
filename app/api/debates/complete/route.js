import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase";
import { startRecording, stopRecording, deleteDailyRoom } from "@/lib/daily";
import { processDebateCompletion } from "@/lib/pipeline";

export const maxDuration = 300;

// Canonical phase order — used to validate transitions
const PHASE_ORDER = [
  "prematch",
  "opening_pro",
  "opening_con",
  "freeflow",
  "closing_con",
  "closing_pro",
  "ended",
];

/**
 * POST /api/debates/complete
 * Handle debate lifecycle events: start, phase change, complete, forfeit.
 *
 * Body: { debateId, action, phase?, side? }
 * Actions: 'start', 'phase', 'complete', 'forfeit'
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { debateId, action, phase, side } = body;

    if (!debateId || !action) {
      return NextResponse.json(
        { error: "debateId and action required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    switch (action) {
      // ---- MARK READY (prematch) ----
      // Records one side as ready. When both sides are ready the server
      // atomically starts the debate and returns the real started_at timestamp
      // so both clients can sync their timers to the same origin.
      case "ready": {
        if (!side || !["pro", "con"].includes(side)) {
          return NextResponse.json(
            { error: "side required (pro or con)" },
            { status: 400 }
          );
        }

        const readyField = side === "pro" ? "pro_ready" : "con_ready";

        // Mark this side ready; guard on prematch so we ignore late calls.
        const { data: readyResult, error: readyErr } = await db
          .from("debates")
          .update({ [readyField]: true })
          .eq("id", debateId)
          .eq("status", "prematch")
          .select("pro_ready, con_ready, status, phase, started_at")
          .maybeSingle();

        if (readyErr) {
          return NextResponse.json({ error: readyErr.message }, { status: 500 });
        }

        // Debate was already started (prematch guard matched 0 rows) — fetch current state.
        if (!readyResult) {
          const { data: current } = await db
            .from("debates")
            .select("status, phase, started_at, pro_ready, con_ready")
            .eq("id", debateId)
            .single();
          return NextResponse.json({
            success: true,
            alreadyStarted: true,
            ...current,
          });
        }

        // Both sides ready → start the debate atomically.
        if (readyResult.pro_ready && readyResult.con_ready) {
          const now = new Date().toISOString();
          const { data: started } = await db
            .from("debates")
            .update({
              status: "in_progress",
              phase: "opening_pro",
              started_at: now,
            })
            .eq("id", debateId)
            .eq("status", "prematch")
            .select("status, phase, started_at, daily_room_name, daily_room_url")
            .maybeSingle();

          // If update failed (debate already in_progress), fetch fresh state
          if (!started) {
            const { data: current } = await db
              .from("debates")
              .select("status, phase, started_at, daily_room_name, daily_room_url")
              .eq("id", debateId)
              .single();

            if (current?.status === "in_progress") {
              // Started by the other player — start recording if not already
              if (current?.daily_room_name) {
                startRecording(current.daily_room_name).catch((err) =>
                  console.error("Recording start failed:", err)
                );
              }
              return NextResponse.json({
                success: true,
                bothReady: true,
                status: current.status,
                phase: current.phase,
                started_at: current.started_at,
                daily_room_name: current.daily_room_name,
                daily_room_url: current.daily_room_url,
              });
            }
          }

          // Update succeeded — we started it
          // Start recording (fire-and-forget).
          if (started?.daily_room_name) {
            startRecording(started.daily_room_name).catch((err) =>
              console.error("Recording start failed:", err)
            );
          }

          return NextResponse.json({
            success: true,
            bothReady: true,
            status: started?.status || "in_progress",
            phase: started?.phase || "opening_pro",
            started_at: started?.started_at || now,
            daily_room_name: started?.daily_room_name,
            daily_room_url: started?.daily_room_url,
          });
        }

        // Only one side ready so far — return updated flags.
        return NextResponse.json({
          success: true,
          bothReady: false,
          pro_ready: readyResult.pro_ready,
          con_ready: readyResult.con_ready,
          status: readyResult.status,
        });
      }

      // ---- CANCEL (prematch timeout or manual leave) ----
      case "cancel": {
        // Atomic: only cancel if still in prematch.
        const { data: cancelResult, error: cancelErr } = await db
          .from("debates")
          .update({
            status: "cancelled",
            phase: "ended",
            completed_at: new Date().toISOString(),
          })
          .eq("id", debateId)
          .eq("status", "prematch") // CAS guard
          .select("id")
          .maybeSingle();

        if (cancelErr) {
          return NextResponse.json({ error: cancelErr.message }, { status: 500 });
        }

        if (!cancelResult) {
          // Debate already started or was already cancelled — not an error.
          // Return full state so the client can transition correctly.
          const { data: current } = await db
            .from("debates")
            .select("status, phase, started_at")
            .eq("id", debateId)
            .single();
          return NextResponse.json({
            success: true,
            alreadyCancelled: current?.status === "cancelled",
            alreadyStarted: current?.status === "in_progress",
            status: current?.status,
            phase: current?.phase,
            started_at: current?.started_at,
          });
        }

        // Release both players' queue entries
        await db
          .from("matchmaking_queue")
          .update({ status: "expired", debate_id: null, matched_with: null })
          .eq("debate_id", debateId)
          .eq("status", "matched");

        return NextResponse.json({ success: true, cancelled: true });
      }

      // ---- START DEBATE ----
      case "start": {
        // Atomic: only transition prematch → in_progress
        // The .eq("status", "prematch") acts as a compare-and-swap guard.
        // If another request already started the debate, this update matches 0 rows.
        const { data: startResult, error: startErr } = await db
          .from("debates")
          .update({
            status: "in_progress",
            phase: "opening_pro",
            started_at: new Date().toISOString(),
          })
          .eq("id", debateId)
          .eq("status", "prematch")
          .select("daily_room_name")
          .maybeSingle();

        if (startErr) {
          console.error("Start debate DB error:", startErr);
          return NextResponse.json(
            { error: startErr.message },
            { status: 500 }
          );
        }

        if (!startResult) {
          // Another request already started this debate — that's fine, not an error
          return NextResponse.json({
            success: true,
            phase: "opening_pro",
            alreadyStarted: true,
          });
        }

        // Start recording (fire-and-forget, don't block the response)
        if (startResult.daily_room_name) {
          startRecording(startResult.daily_room_name).catch((err) =>
            console.error("Recording start failed:", err)
          );
        }

        return NextResponse.json({ success: true, phase: "opening_pro" });
      }

      // ---- PHASE TRANSITION ----
      case "phase": {
        if (!phase) {
          return NextResponse.json(
            { error: "phase required" },
            { status: 400 }
          );
        }

        const validPhases = [
          "opening_pro",
          "opening_con",
          "freeflow",
          "closing_con",
          "closing_pro",
          "ended",
        ];
        if (!validPhases.includes(phase)) {
          return NextResponse.json(
            { error: "Invalid phase" },
            { status: 400 }
          );
        }

        // Determine what the previous phase MUST be for this transition to be valid
        const targetIndex = PHASE_ORDER.indexOf(phase);
        const expectedCurrentPhase =
          targetIndex > 0 ? PHASE_ORDER[targetIndex - 1] : null;

        if (!expectedCurrentPhase) {
          return NextResponse.json(
            { error: "Cannot transition to this phase" },
            { status: 400 }
          );
        }

        // Atomic compare-and-swap: only advance if current phase matches expected.
        // If both clients fire simultaneously, only one will match — the other gets 0 rows.
        const updatePayload =
          phase === "ended"
            ? {
                phase: "ended",
                status: "completed",
                completed_at: new Date().toISOString(),
              }
            : { phase };

        const { data: phaseResult, error: phaseErr } = await db
          .from("debates")
          .update(updatePayload)
          .eq("id", debateId)
          .eq("phase", expectedCurrentPhase)
          .eq("status", "in_progress")
          .select("id")
          .maybeSingle();

        if (phaseErr) {
          console.error("Phase advance DB error:", phaseErr);
          return NextResponse.json(
            { error: phaseErr.message },
            { status: 500 }
          );
        }

        if (!phaseResult) {
          // Phase was already advanced by the other client — not an error
          return NextResponse.json({
            success: true,
            phase,
            alreadyAdvanced: true,
          });
        }

        // If we transitioned to 'ended', trigger the async processing pipeline
        if (phase === "ended") {
          waitUntil(
            processDebateCompletion(debateId).catch(async (err) => {
              console.error("Pipeline failed:", err);
              await db.from("debates")
                .update({ status: "pipeline_failed" })
                .eq("id", debateId);
            })
          );
        }

        return NextResponse.json({ success: true, phase });
      }

      // ---- COMPLETE (direct, e.g. from handleTimeUp when next phase is 'ended') ----
      case "complete": {
        // Atomic: only complete if still in_progress
        const { data: completeResult, error: completeErr } = await db
          .from("debates")
          .update({
            status: "completed",
            phase: "ended",
            completed_at: new Date().toISOString(),
          })
          .eq("id", debateId)
          .eq("status", "in_progress")
          .select("id")
          .maybeSingle();

        if (completeErr) {
          console.error("Complete debate DB error:", completeErr);
          return NextResponse.json(
            { error: completeErr.message },
            { status: 500 }
          );
        }

        if (!completeResult) {
          return NextResponse.json({
            success: true,
            alreadyCompleted: true,
          });
        }

        // Trigger pipeline
        waitUntil(
          processDebateCompletion(debateId).catch(async (err) => {
            console.error("Pipeline failed:", err);
            await db.from("debates")
              .update({ status: "pipeline_failed" })
              .eq("id", debateId);
          })
        );

        return NextResponse.json({ success: true });
      }

      // ---- FORFEIT ----
      case "forfeit": {
        if (!side) {
          return NextResponse.json(
            { error: "side required for forfeit" },
            { status: 400 }
          );
        }

        const winner = side === "pro" ? "con" : "pro";

        // Atomic: go directly to terminal "forfeited" state inline.
        // The CAS guard (.eq status in_progress) prevents double-forfeit.
        // Previous approach used a transitional "forfeiting" status + waitUntil
        // pipeline, but Vercel kept killing the background work before the
        // critical DB update completed, leaving debates stuck forever.
        const { data: forfeitResult, error: forfeitErr } = await db
          .from("debates")
          .update({
            status: "forfeited",
            phase: "ended",
            winner,
            winner_source: "forfeit",
            completed_at: new Date().toISOString(),
          })
          .eq("id", debateId)
          .eq("status", "in_progress")
          .select("id, daily_room_name, pro_user_id, con_user_id")
          .maybeSingle();

        if (forfeitErr) {
          console.error("Forfeit DB error:", forfeitErr);
          return NextResponse.json(
            { error: forfeitErr.message },
            { status: 500 }
          );
        }

        if (!forfeitResult) {
          return NextResponse.json({
            success: true,
            alreadyEnded: true,
          });
        }

        // Non-critical cleanup (W/L stats, room teardown) — fire-and-forget
        waitUntil(
          (async () => {
            try {
              const winnerId = winner === "pro" ? forfeitResult.pro_user_id : forfeitResult.con_user_id;
              const loserId = side === "pro" ? forfeitResult.pro_user_id : forfeitResult.con_user_id;
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
              if (forfeitResult.daily_room_name) {
                await stopRecording(forfeitResult.daily_room_name).catch(() => {});
                await deleteDailyRoom(forfeitResult.daily_room_name).catch(() => {});
              }
            } catch (err) {
              console.error("Forfeit cleanup failed (non-critical):", err);
            }
          })()
        );
        return NextResponse.json({ success: true, forfeited_by: side });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Debate action error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
