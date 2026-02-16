import { NextResponse } from "next/server";
import { requestSideSwap } from "@/lib/matchmaking";

/**
 * POST /api/debates/swap
 * Request a side swap during prematch lobby.
 *
 * Body: { debateId, requestingSide }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { debateId, requestingSide } = body;

    if (!debateId || !requestingSide) {
      return NextResponse.json(
        { error: "debateId and requestingSide required" },
        { status: 400 }
      );
    }

    if (!["pro", "con"].includes(requestingSide)) {
      return NextResponse.json({ error: "requestingSide must be 'pro' or 'con'" }, { status: 400 });
    }

    const result = await requestSideSwap(debateId, requestingSide);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
