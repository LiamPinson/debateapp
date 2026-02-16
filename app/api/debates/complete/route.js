import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { startRecording } from "@/lib/daily";
import { processDebateCompletion, processDebateForfeit } from "@/lib/pipeline";

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
      return NextResponse.json({ error: "debateId and action required" }, { status: 400 });
    }

    const db = createServiceClient();

    switch (action) {
      // ---- START DEBATE ----
      case "start": {
        const { data: debate } = await db
          .from("debates")
          .select("daily_room_name")
          .eq("id", debateId)
          .single();

        // Start recording
        if (debate?.daily_room_name) {
          await startRecording(debate.daily_room_name).catch((err) =>
            console.error("Recording start failed:", err)
          );
        }

        await db
          .from("debates")
          .update({
            status: "in_progress",
            phase: "opening_pro",
            started_at: new Date().toISOString(),
          })
          .eq("id", debateId);

        return NextResponse.json({ success: true, phase: "opening_pro" });
      }

      // ---- PHASE TRANSITION ----
      case "phase": {
        if (!phase) {
          return NextResponse.json({ error: "phase required" }, { status: 400 });
        }

        const validPhases = [
          "opening_pro", "opening_con", "freeflow",
          "closing_con", "closing_pro", "ended",
        ];
        if (!validPhases.includes(phase)) {
          return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
        }

        await db
          .from("debates")
          .update({ phase })
          .eq("id", debateId);

        // If phase is 'ended', trigger completion
        if (phase === "ended") {
          await db
            .from("debates")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", debateId);

          // Trigger async processing pipeline (non-blocking)
          processDebateCompletion(debateId).catch((err) =>
            console.error("Pipeline failed:", err)
          );
        }

        return NextResponse.json({ success: true, phase });
      }

      // ---- COMPLETE ----
      case "complete": {
        await db
          .from("debates")
          .update({
            status: "completed",
            phase: "ended",
            completed_at: new Date().toISOString(),
          })
          .eq("id", debateId);

        // Trigger pipeline
        processDebateCompletion(debateId).catch((err) =>
          console.error("Pipeline failed:", err)
        );

        return NextResponse.json({ success: true });
      }

      // ---- FORFEIT ----
      case "forfeit": {
        if (!side) {
          return NextResponse.json({ error: "side required for forfeit" }, { status: 400 });
        }

        await processDebateForfeit(debateId, side);
        return NextResponse.json({ success: true, forfeited_by: side });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Debate action error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
