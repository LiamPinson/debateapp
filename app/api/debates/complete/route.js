import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase";
import { startRecording } from "@/lib/daily";
import { processDebateCompletion, processDebateForfeit } from "@/lib/pipeline";

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
            processDebateCompletion(debateId).catch((err) => {
              console.error("Pipeline failed:", err);
              db.from("debates")
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
          processDebateCompletion(debateId).catch((err) => {
            console.error("Pipeline failed:", err);
            db.from("debates")
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

        // Atomic: only forfeit if still in_progress
        const { data: forfeitResult, error: forfeitErr } = await db
          .from("debates")
          .update({ status: "forfeiting" }) // transitional status to prevent double-forfeit
          .eq("id", debateId)
          .eq("status", "in_progress")
          .select("id")
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

        waitUntil(
          processDebateForfeit(debateId, side).catch((err) => {
            console.error("Forfeit pipeline failed:", err);
            db.from("debates")
              .update({ status: "pipeline_failed" })
              .eq("id", debateId);
          })
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
