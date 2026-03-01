// ============================================================
// Zod Schema Validation Tests
// ============================================================
// Tests that the schemas correctly accept valid input and
// reject invalid input with appropriate error messages.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  LoginSchema,
  RegisterSchema,
  QueueSchema,
  LeaveQueueSchema,
  DebateActionSchema,
  CastVoteSchema,
  CreateChallengeSchema,
  RespondChallengeSchema,
  CreateCustomTopicSchema,
  SideSwapSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  OAuthSchema,
} from "@/lib/schemas";

// ── LoginSchema ──────────────────────────────────────────────

describe("LoginSchema", () => {
  it("accepts valid login", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = LoginSchema.safeParse({ password: "secret123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = LoginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain("email");
  });

  it("rejects empty password", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── RegisterSchema ───────────────────────────────────────────

describe("RegisterSchema", () => {
  it("accepts valid registration", () => {
    const result = RegisterSchema.safeParse({
      username: "testuser",
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts registration with sessionId", () => {
    const result = RegisterSchema.safeParse({
      username: "testuser",
      email: "user@example.com",
      password: "password123",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short username", () => {
    const result = RegisterSchema.safeParse({
      username: "ab",
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username with special chars", () => {
    const result = RegisterSchema.safeParse({
      username: "user@name",
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain("letters, numbers, and underscores");
  });

  it("rejects short password", () => {
    const result = RegisterSchema.safeParse({
      username: "testuser",
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain("8 characters");
  });
});

// ── QueueSchema ──────────────────────────────────────────────

describe("QueueSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid queue entry with userId", () => {
    const result = QueueSchema.safeParse({
      userId: validUuid,
      category: "politics",
      timeLimit: "15",
    });
    expect(result.success).toBe(true);
    expect(result.data.timeLimit).toBe(15); // transformed to number
    expect(result.data.stance).toBe("either"); // default
    expect(result.data.ranked).toBe(false); // default
  });

  it("accepts valid queue entry with sessionId", () => {
    const result = QueueSchema.safeParse({
      sessionId: validUuid,
      category: "politics",
      timeLimit: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when neither userId nor sessionId provided", () => {
    const result = QueueSchema.safeParse({
      category: "politics",
      timeLimit: "15",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain("userId or sessionId");
  });

  it("rejects missing category", () => {
    const result = QueueSchema.safeParse({
      userId: validUuid,
      timeLimit: "15",
    });
    expect(result.success).toBe(false);
  });

  it("validates stance enum", () => {
    const result = QueueSchema.safeParse({
      userId: validUuid,
      category: "politics",
      timeLimit: "15",
      stance: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

// ── DebateActionSchema ───────────────────────────────────────

describe("DebateActionSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts ready action", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "ready",
    });
    expect(result.success).toBe(true);
  });

  it("accepts phase action with valid phase", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "phase",
      phase: "opening_con",
    });
    expect(result.success).toBe(true);
  });

  it("rejects phase action without phase field", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "phase",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid phase value", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "phase",
      phase: "invalid_phase",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown action", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("accepts forfeit action", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "forfeit",
    });
    expect(result.success).toBe(true);
  });

  it("accepts cancel action", () => {
    const result = DebateActionSchema.safeParse({
      debateId: validUuid,
      action: "cancel",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid debateId", () => {
    const result = DebateActionSchema.safeParse({
      debateId: "not-a-uuid",
      action: "ready",
    });
    expect(result.success).toBe(false);
  });
});

// ── CastVoteSchema ───────────────────────────────────────────

describe("CastVoteSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validUuid2 = "660e8400-e29b-41d4-a716-446655440000";

  it("accepts valid vote", () => {
    const result = CastVoteSchema.safeParse({
      debateId: validUuid,
      voterId: validUuid2,
      winnerChoice: "pro",
    });
    expect(result.success).toBe(true);
  });

  it("accepts vote with optional fields", () => {
    const result = CastVoteSchema.safeParse({
      debateId: validUuid,
      voterId: validUuid2,
      winnerChoice: "draw",
      betterArguments: "con",
      changedMind: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid winnerChoice", () => {
    const result = CastVoteSchema.safeParse({
      debateId: validUuid,
      voterId: validUuid2,
      winnerChoice: "tie",
    });
    expect(result.success).toBe(false);
  });
});

// ── CreateChallengeSchema ────────────────────────────────────

describe("CreateChallengeSchema", () => {
  const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
  const uuid2 = "660e8400-e29b-41d4-a716-446655440000";
  const uuid3 = "770e8400-e29b-41d4-a716-446655440000";

  it("accepts valid challenge", () => {
    const result = CreateChallengeSchema.safeParse({
      challengerId: uuid1,
      targetId: uuid2,
      topicId: uuid3,
    });
    expect(result.success).toBe(true);
    expect(result.data.timeLimit).toBe(15); // default
  });

  it("rejects self-challenge", () => {
    const result = CreateChallengeSchema.safeParse({
      challengerId: uuid1,
      targetId: uuid1,
      topicId: uuid3,
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain("Cannot challenge yourself");
  });
});

// ── RespondChallengeSchema ───────────────────────────────────

describe("RespondChallengeSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts accept action", () => {
    const result = RespondChallengeSchema.safeParse({
      challengeId: validUuid,
      action: "accept",
    });
    expect(result.success).toBe(true);
  });

  it("accepts decline action", () => {
    const result = RespondChallengeSchema.safeParse({
      challengeId: validUuid,
      action: "decline",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = RespondChallengeSchema.safeParse({
      challengeId: validUuid,
      action: "reject",
    });
    expect(result.success).toBe(false);
  });
});

// ── CreateCustomTopicSchema ──────────────────────────────────

describe("CreateCustomTopicSchema", () => {
  it("accepts valid topic", () => {
    const result = CreateCustomTopicSchema.safeParse({
      headline: "Should AI be regulated",
      description: "A discussion about AI regulation and its implications for society.",
      notificationPreference: "email",
    });
    expect(result.success).toBe(true);
  });

  it("rejects headline over 20 words", () => {
    const longHeadline = Array(25).fill("word").join(" ");
    const result = CreateCustomTopicSchema.safeParse({
      headline: longHeadline,
      description: "A short description.",
      notificationPreference: "both",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain("20 words");
  });

  it("rejects invalid notification preference", () => {
    const result = CreateCustomTopicSchema.safeParse({
      headline: "Valid headline",
      description: "Valid description.",
      notificationPreference: "sms",
    });
    expect(result.success).toBe(false);
  });
});

// ── SideSwapSchema ───────────────────────────────────────────

describe("SideSwapSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid swap request", () => {
    const result = SideSwapSchema.safeParse({
      debateId: validUuid,
      requestingSide: "pro",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid side", () => {
    const result = SideSwapSchema.safeParse({
      debateId: validUuid,
      requestingSide: "neutral",
    });
    expect(result.success).toBe(false);
  });
});

// ── Auth helper schemas ──────────────────────────────────────

describe("ForgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = ForgotPasswordSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = ForgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("ResetPasswordSchema", () => {
  it("accepts valid reset", () => {
    const result = ResetPasswordSchema.safeParse({
      token: "abc123def456",
      password: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = ResetPasswordSchema.safeParse({
      token: "abc123",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("OAuthSchema", () => {
  it("accepts valid access token", () => {
    const result = OAuthSchema.safeParse({ accessToken: "some-jwt-token" });
    expect(result.success).toBe(true);
  });

  it("rejects empty access token", () => {
    const result = OAuthSchema.safeParse({ accessToken: "" });
    expect(result.success).toBe(false);
  });
});
