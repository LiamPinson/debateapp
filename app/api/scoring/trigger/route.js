import { NextResponse } from "next/server";
import { processDebateCompletion, retryFailedSteps } from "@/lib/pipeline";

/**
 * POST /api/scoring/trigger
 * Trigger or retry the scoring pipeline for a debate.
 *
 * Body: { debateId, retry?: boolean }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { debateId, retry } = body;

    if (!debateId) {
      return NextResponse.json({ error: "debateId required" }, { status: 400 });
    }

    if (retry) {
      // Retry only failed steps
      const result = await retryFailedSteps(debateId);
      return NextResponse.json({
        success: result.success,
        failedSteps: result.failedSteps || [],
        message: result.error || (result.success
          ? "Retry completed successfully"
          : `Retry completed with failures: ${result.failedSteps?.join(", ")}`),
      });
    }

    // Full pipeline run (non-blocking)
    processDebateCompletion(debateId).catch((err) =>
      console.error(`Manual pipeline trigger failed for ${debateId}:`, err)
    );

    return NextResponse.json({
      success: true,
      message: `Pipeline triggered for debate ${debateId}. Processing in background.`,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
