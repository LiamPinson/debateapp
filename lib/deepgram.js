// ============================================================
// Deepgram Transcription Service
// ============================================================
// Transcribes debate recordings into speaker-labeled segments.
// Uses Deepgram's Nova-2 model with diarization for speaker separation.
// ============================================================

const DEEPGRAM_API_BASE = "https://api.deepgram.com/v1";

function getApiKey() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("Missing DEEPGRAM_API_KEY");
  return key;
}

/**
 * Transcribe an audio file from a URL (e.g. Daily.co recording download link).
 * Returns structured transcript with speaker diarization.
 *
 * @param {string} audioUrl - Public URL to the audio file
 * @returns {Promise<{
 *   full_text: string,
 *   segments: Array<{speaker: number, start: number, end: number, text: string}>,
 *   duration: number
 * }>}
 */
export async function transcribeAudio(audioUrl) {
  // Build URL with query params for Deepgram configuration
  const url = new URL(`${DEEPGRAM_API_BASE}/listen`);
  url.searchParams.set("model", "nova-2");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("diarize", "true"); // speaker separation
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("utterances", "true");
  url.searchParams.set("paragraphs", "true");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${getApiKey()}`,
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Deepgram transcription failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  const result = data.results;

  // Extract utterances with speaker labels
  const utterances = result?.utterances || [];
  const segments = utterances.map((u) => ({
    speaker: u.speaker, // 0 or 1
    start: u.start,
    end: u.end,
    text: u.transcript,
    confidence: u.confidence,
  }));

  // Build full text with speaker labels
  const full_text = segments
    .map((s) => `[Speaker ${s.speaker}] ${s.text}`)
    .join("\n");

  // Get total duration from last segment end time
  const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;

  return {
    full_text,
    segments,
    duration,
    raw: data, // keep raw response for debugging
  };
}

/**
 * Convert raw transcript segments into a labeled debate transcript.
 * Maps Deepgram speaker IDs (0, 1) to debate roles (Pro, Con).
 *
 * We determine which speaker is Pro vs Con based on who speaks first
 * (Pro always gives the first opening statement).
 *
 * @param {Array} segments - Deepgram transcript segments
 * @returns {{ pro_text: string, con_text: string, labeled_segments: Array, full_labeled_text: string }}
 */
export function labelTranscriptSpeakers(segments) {
  if (!segments || segments.length === 0) {
    return { pro_text: "", con_text: "", labeled_segments: [], full_labeled_text: "" };
  }

  // First speaker is always Pro (opening statement)
  const firstSpeaker = segments[0].speaker;
  const speakerMap = {
    [firstSpeaker]: "Pro",
    [firstSpeaker === 0 ? 1 : 0]: "Con",
  };

  const labeled = segments.map((s) => ({
    ...s,
    role: speakerMap[s.speaker] || `Speaker ${s.speaker}`,
  }));

  const pro_text = labeled
    .filter((s) => s.role === "Pro")
    .map((s) => s.text)
    .join(" ");

  const con_text = labeled
    .filter((s) => s.role === "Con")
    .map((s) => s.text)
    .join(" ");

  const full_labeled_text = labeled
    .map((s) => `[${s.role} @ ${formatTime(s.start)}] ${s.text}`)
    .join("\n");

  return { pro_text, con_text, labeled_segments: labeled, full_labeled_text };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
