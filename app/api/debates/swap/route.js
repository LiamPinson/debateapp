import { NextResponse } from "next/server";
import { requestSideSwap } from "@/lib/matchmaking";
import { SideSwapSchema, validate } from "@/lib/schemas";

/**
 * POST /api/debates/swap
 * Request a side swap during prematch lobby.
 *
 * Body: { debateId, requestingSide }
 */
export async function POST(request) {
  try {
    const { data: body, error: validationError } = await validate(request, SideSwapSchema);
    if (validationError) return validationError;

    const { debateId, requestingSide } = body;

    const result = await requestSideSwap(debateId, requestingSide);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
