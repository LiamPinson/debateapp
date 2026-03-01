// ============================================================
// Auth Helper Tests
// ============================================================
// Tests for resolveCallerSide and cookie helpers.
// resolveCallerIdentity requires DB access so is not tested here.
// ============================================================

import { describe, it, expect } from "vitest";
import { resolveCallerSide } from "@/lib/auth";

describe("resolveCallerSide", () => {
  const debate = {
    pro_user_id: "user-aaa",
    con_user_id: "user-bbb",
    pro_session_id: "sess-111",
    con_session_id: "sess-222",
  };

  it("returns 'pro' for matching userId", () => {
    const caller = { userId: "user-aaa", sessionId: "sess-xxx" };
    expect(resolveCallerSide(debate, caller)).toBe("pro");
  });

  it("returns 'con' for matching userId", () => {
    const caller = { userId: "user-bbb", sessionId: "sess-xxx" };
    expect(resolveCallerSide(debate, caller)).toBe("con");
  });

  it("returns 'pro' for matching sessionId (guest)", () => {
    const caller = { userId: null, sessionId: "sess-111" };
    expect(resolveCallerSide(debate, caller)).toBe("pro");
  });

  it("returns 'con' for matching sessionId (guest)", () => {
    const caller = { userId: null, sessionId: "sess-222" };
    expect(resolveCallerSide(debate, caller)).toBe("con");
  });

  it("returns null for non-participant", () => {
    const caller = { userId: "user-zzz", sessionId: "sess-zzz" };
    expect(resolveCallerSide(debate, caller)).toBeNull();
  });

  it("returns null if caller is null", () => {
    expect(resolveCallerSide(debate, null)).toBeNull();
  });

  it("returns null if debate is null", () => {
    const caller = { userId: "user-aaa", sessionId: "sess-111" };
    expect(resolveCallerSide(null, caller)).toBeNull();
  });

  it("prefers userId match over sessionId", () => {
    // Caller has pro's userId but con's sessionId — userId should win
    const caller = { userId: "user-aaa", sessionId: "sess-222" };
    expect(resolveCallerSide(debate, caller)).toBe("pro");
  });
});
