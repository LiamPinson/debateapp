// ============================================================
// Zod Schemas — Request validation for all API routes
// ============================================================
// Define once, reuse everywhere. Each schema validates the
// JSON body of a specific API endpoint.
// ============================================================

import { z } from "zod";
import { NextResponse } from "next/server";

// ── Reusable primitives ──────────────────────────────────────

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().nullable();

// ── Auth ─────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be 3-24 characters")
    .max(24, "Username must be 3-24 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  sessionId: optionalUuid,
});

export const SessionSchema = z.object({
  token: z.string().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const OAuthSchema = z.object({
  accessToken: z.string().min(1, "accessToken required"),
});

// ── Matchmaking ──────────────────────────────────────────────

export const QueueSchema = z
  .object({
    userId: optionalUuid,
    sessionId: optionalUuid,
    category: z.string().min(1, "category is required"),
    topicId: optionalUuid,
    timeLimit: z.union([z.string(), z.number()]).transform((v) => parseInt(String(v), 10)),
    stance: z.enum(["pro", "con", "either"]).default("either"),
    ranked: z.boolean().default(false),
  })
  .refine((data) => data.userId || data.sessionId, {
    message: "Either userId or sessionId is required",
  });

export const LeaveQueueSchema = z.object({
  queueId: uuid,
});

// ── Debate actions ───────────────────────────────────────────

const DebatePhase = z.enum([
  "opening_pro",
  "opening_con",
  "freeflow",
  "closing_con",
  "closing_pro",
  "ended",
]);

export const DebateActionSchema = z.discriminatedUnion("action", [
  z.object({ debateId: uuid, action: z.literal("ready") }),
  z.object({ debateId: uuid, action: z.literal("start") }),
  z.object({ debateId: uuid, action: z.literal("phase"), phase: DebatePhase }),
  z.object({ debateId: uuid, action: z.literal("complete") }),
  z.object({ debateId: uuid, action: z.literal("forfeit") }),
  z.object({ debateId: uuid, action: z.literal("cancel") }),
]);

// ── Voting ───────────────────────────────────────────────────

export const CastVoteSchema = z.object({
  debateId: uuid,
  voterId: uuid,
  winnerChoice: z.enum(["pro", "con", "draw"]),
  betterArguments: z.enum(["pro", "con"]).optional().nullable(),
  moreRespectful: z.enum(["pro", "con"]).optional().nullable(),
  changedMind: z.boolean().optional().nullable(),
});

// ── Challenges ───────────────────────────────────────────────

export const CreateChallengeSchema = z
  .object({
    challengerId: uuid,
    targetId: uuid,
    topicId: uuid,
    timeLimit: z.number().int().positive().default(15),
  })
  .refine((data) => data.challengerId !== data.targetId, {
    message: "Cannot challenge yourself",
  });

export const RespondChallengeSchema = z.object({
  challengeId: uuid,
  action: z.enum(["accept", "decline"]),
});

// ── Custom Topics ────────────────────────────────────────────

export const CreateCustomTopicSchema = z.object({
  headline: z
    .string()
    .min(1, "Headline cannot be empty")
    .refine((v) => v.trim().split(/\s+/).length <= 20, {
      message: "Headline must be 20 words or fewer",
    }),
  description: z
    .string()
    .min(1, "Description cannot be empty")
    .refine((v) => v.trim().split(/\s+/).length <= 150, {
      message: "Description must be 150 words or fewer",
    }),
  notificationPreference: z.enum(["email", "in_app", "both"]),
});

// ── Side Swap ────────────────────────────────────────────────

export const SideSwapSchema = z.object({
  debateId: uuid,
  requestingSide: z.enum(["pro", "con"]),
});

// ── Validation helper ────────────────────────────────────────

/**
 * Parse the JSON body against a Zod schema.
 * Returns { data } on success, or { error: NextResponse } on failure.
 *
 * Usage:
 *   const { data, error } = await validate(request, MySchema);
 *   if (error) return error;
 *   // data is now typed and validated
 */
export async function validate(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const message = firstError?.path?.length
      ? `${firstError.path.join(".")}: ${firstError.message}`
      : firstError?.message || "Validation failed";

    return {
      data: null,
      error: NextResponse.json({ error: message }, { status: 400 }),
    };
  }

  return { data: result.data, error: null };
}
