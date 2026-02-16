// ============================================================
// AI Scoring System (Two-Tiered)
// ============================================================
// Tier 1: Procedural strike detection (high-precision, punitive)
// Tier 2: Qualitative debate scoring (exploratory, feedback)
//
// Both tiers run independently against the same transcript.
// Tier 1 flags are queued for admin review before strikes apply.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey: key });
}

// ============================================================
// TIER 1: Procedural Strike Detection
// ============================================================
const TIER1_SYSTEM_PROMPT = `You are a debate moderation system. Your job is to detect CLEAR, UNAMBIGUOUS rule violations in a debate transcript. You must be CONSERVATIVE — only flag violations you are highly confident about. False positives are far more damaging than false negatives.

You are detecting:
1. AD HOMINEM ATTACKS: Direct personal insults, name-calling, attacks on character rather than arguments. Saying "your argument is wrong" is NOT ad hominem. Saying "you're an idiot" IS.
2. SLURS AND HATE SPEECH: Racial, ethnic, gender, or sexuality-based slurs. Zero tolerance.
3. EXCESSIVE PROFANITY: Profanity used AGGRESSIVELY TOWARD THE OPPONENT. Casual profanity in argumentation (e.g., "that's a bullshit argument") is NOT flagged. Directed hostility (e.g., "fuck you, you piece of shit") IS flagged.
4. NON-PARTICIPATION: Extended silence (>30% of their allotted time), obvious non-engagement, or disruptive behavior.

CRITICAL RULES:
- Only flag what you are >90% confident about.
- Heated disagreement is NOT a violation.
- Passionate language is NOT a violation.
- Sarcasm is NOT a violation unless it crosses into personal attacks.
- If you are unsure, DO NOT FLAG.

Respond with ONLY valid JSON, no other text.`;

const TIER1_USER_PROMPT = (topic, transcript) => `Analyze this debate transcript for rule violations.

TOPIC: ${topic}

TRANSCRIPT:
${transcript}

Respond with this exact JSON structure:
{
  "pro_strikes": {
    "ad_hominem": false,
    "slurs": false,
    "excessive_profanity": false,
    "non_participation": false
  },
  "con_strikes": {
    "ad_hominem": false,
    "slurs": false,
    "excessive_profanity": false,
    "non_participation": false
  },
  "flagged_moments": [
    {
      "timestamp": "MM:SS",
      "speaker": "Pro or Con",
      "type": "ad_hominem|slurs|excessive_profanity|non_participation",
      "confidence": 0.0,
      "transcript_excerpt": "exact quote"
    }
  ],
  "notes": "Brief explanation of any flags, or 'No violations detected'"
}`;

/**
 * Run Tier 1 procedural strike detection.
 * @param {string} topic - Debate topic
 * @param {string} transcript - Full labeled transcript
 * @returns {Promise<Object>} Strike detection results
 */
export async function runTier1Analysis(topic, transcript) {
  const client = getClient();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: TIER1_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: TIER1_USER_PROMPT(topic, transcript) },
      ],
    });

    const text = response.content[0]?.text || "{}";
    // Strip markdown fences if present
    const clean = text.replace(/```json\n?|```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Tier 1 analysis failed:", err);
    // Return safe default — no strikes on failure
    return {
      pro_strikes: { ad_hominem: false, slurs: false, excessive_profanity: false, non_participation: false },
      con_strikes: { ad_hominem: false, slurs: false, excessive_profanity: false, non_participation: false },
      flagged_moments: [],
      notes: "Analysis failed — defaulting to no violations",
      error: err.message,
    };
  }
}

// ============================================================
// TIER 2: Qualitative Debate Scoring
// ============================================================
const TIER2_SYSTEM_PROMPT = `You are an expert debate analyst. Your job is to evaluate the quality of both debaters' arguments. You are fair, specific, and constructive.

You evaluate three dimensions (each 0-100):
1. ARGUMENT COHERENCE: Were arguments logically structured? Did claims follow from premises? Were conclusions supported by the reasoning?
2. ENGAGEMENT WITH OPPONENT: Did the debater address their opponent's points directly? Did they respond to counterarguments, or talk past them?
3. EVIDENCE & REASONING: Were claims backed by evidence, examples, data, or sound logical reasoning? Or were they purely assertion?

OVERALL QUALITY is the equal-weighted average of the three dimensions.

Be specific in your strengths and areas_for_improvement — reference actual moments from the transcript with approximate timestamps.

Respond with ONLY valid JSON, no other text.`;

const TIER2_USER_PROMPT = (topic, transcript, timeLimit) => `Analyze this ${timeLimit}-minute debate.

TOPIC: ${topic}

TRANSCRIPT:
${transcript}

Respond with this exact JSON structure:
{
  "pro_player": {
    "coherence": 0,
    "engagement": 0,
    "evidence": 0,
    "overall_quality": 0,
    "strengths": ["specific strength with timestamp reference"],
    "areas_for_improvement": ["specific area with timestamp reference"]
  },
  "con_player": {
    "coherence": 0,
    "engagement": 0,
    "evidence": 0,
    "overall_quality": 0,
    "strengths": ["specific strength with timestamp reference"],
    "areas_for_improvement": ["specific area with timestamp reference"]
  },
  "debate_summary": "2-3 sentence summary of the debate's key arguments and turning points",
  "notable_moments": [
    {
      "timestamp": "MM:SS",
      "description": "What happened and why it mattered"
    }
  ]
}`;

/**
 * Run Tier 2 qualitative scoring.
 * @param {string} topic - Debate topic
 * @param {string} transcript - Full labeled transcript
 * @param {number} timeLimit - Debate time limit in minutes
 * @returns {Promise<Object>} Qualitative scoring results
 */
export async function runTier2Analysis(topic, transcript, timeLimit) {
  const client = getClient();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: TIER2_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: TIER2_USER_PROMPT(topic, transcript, timeLimit) },
      ],
    });

    const text = response.content[0]?.text || "{}";
    const clean = text.replace(/```json\n?|```\n?/g, "").trim();
    const result = JSON.parse(clean);

    // Validate and compute overall if not provided
    for (const side of ["pro_player", "con_player"]) {
      const p = result[side];
      if (p) {
        p.coherence = clamp(p.coherence || 50);
        p.engagement = clamp(p.engagement || 50);
        p.evidence = clamp(p.evidence || 50);
        p.overall_quality = Math.round((p.coherence + p.engagement + p.evidence) / 3);
      }
    }

    return result;
  } catch (err) {
    console.error("Tier 2 analysis failed:", err);
    return {
      pro_player: defaultScores(),
      con_player: defaultScores(),
      debate_summary: "Analysis could not be completed.",
      notable_moments: [],
      error: err.message,
    };
  }
}

/**
 * Run both tiers and return combined results.
 * This is the main entry point called by the scoring pipeline.
 */
export async function runFullAnalysis(topic, transcript, timeLimit) {
  // Run both tiers in parallel
  const [tier1, tier2] = await Promise.all([
    runTier1Analysis(topic, transcript),
    runTier2Analysis(topic, transcript, timeLimit),
  ]);

  return {
    procedural: tier1,
    qualitative: tier2,
    analyzed_at: new Date().toISOString(),
  };
}

// Helpers
function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function defaultScores() {
  return {
    coherence: 50,
    engagement: 50,
    evidence: 50,
    overall_quality: 50,
    strengths: [],
    areas_for_improvement: ["Analysis could not be completed"],
  };
}
