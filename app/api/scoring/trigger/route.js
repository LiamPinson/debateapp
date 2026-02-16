import { NextResponse } from "next/server";
import { processDebateCompletion } from "@/lib/pipeline";

/**
 * POST /api/scoring/trigger
 * Manually trigger the scoring pipeline for a debate.
 * Useful for retrying failed pipelines or admin re-scoring.
 *
 * Body: { debateId }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { debateId } = body;

    if (!debateId) {
      return NextResponse.json({ error: "debateId required" }, { status: 400 });
    }

    // Run pipeline (non-blocking response, pipeline runs async)
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
