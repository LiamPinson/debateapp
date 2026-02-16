// ============================================================
// Daily.co Integration
// ============================================================
// Creates temporary rooms for debates and generates participant tokens.
// Rooms auto-expire after the debate time limit + buffer.
// Recording is enabled for post-debate transcription.
// ============================================================

const DAILY_API_BASE = "https://api.daily.co/v1";
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || "verbalviol.daily.co";

function getApiKey() {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("Missing DAILY_API_KEY");
  return key;
}

/**
 * Create a Daily.co room for a debate.
 * @param {string} debateId - Unique debate identifier (used as room name)
 * @param {number} timeLimitMinutes - Debate duration in minutes
 * @returns {Promise<{name: string, url: string, id: string}>}
 */
export async function createDailyRoom(debateId, timeLimitMinutes) {
  const roomName = `debate-${debateId}`;
  // Room expires 15 min after debate should end (buffer for post-debate)
  const expSeconds = (timeLimitMinutes + 15) * 60;
  const exp = Math.floor(Date.now() / 1000) + expSeconds;

  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      name: roomName,
      privacy: "private", // require token to join
      properties: {
        exp,
        max_participants: 2,
        enable_chat: false,
        enable_screenshare: false,
        enable_recording: "cloud", // records to Daily.co cloud
        start_audio_off: false,
        start_video_off: true, // audio-only debates
        eject_at_room_exp: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daily.co room creation failed: ${res.status} ${err}`);
  }

  const room = await res.json();
  return {
    name: room.name,
    url: room.url,
    id: room.id,
  };
}

/**
 * Generate a meeting token for a participant.
 * @param {string} roomName - Daily.co room name
 * @param {string} participantLabel - Display name (username or "Pro"/"Con")
 * @param {boolean} isOwner - Whether this participant can control recording
 * @returns {Promise<string>} Meeting token
 */
export async function createMeetingToken(roomName, participantLabel, isOwner = false) {
  const exp = Math.floor(Date.now() / 1000) + 7200; // 2 hour token expiry

  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: participantLabel,
        exp,
        is_owner: isOwner,
        enable_recording: isOwner ? "cloud" : undefined,
        start_audio_off: false,
        start_video_off: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daily.co token creation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.token;
}

/**
 * Start cloud recording for a room.
 * Called when the debate transitions from prematch to opening_pro.
 * @param {string} roomName
 */
export async function startRecording(roomName) {
  const res = await fetch(`${DAILY_API_BASE}/rooms/${roomName}/recordings/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      // Record separate audio tracks per participant
      layout: { preset: "audio-only" },
    }),
  });

  // 409 means recording already started — that's fine
  if (!res.ok && res.status !== 409) {
    const err = await res.text();
    console.error(`Recording start failed: ${res.status} ${err}`);
  }
}

/**
 * Stop recording and get the recording access link.
 * @param {string} roomName
 * @returns {Promise<{id: string, download_url: string} | null>}
 */
export async function stopRecording(roomName) {
  const res = await fetch(`${DAILY_API_BASE}/rooms/${roomName}/recordings/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!res.ok) {
    console.error(`Recording stop failed: ${res.status}`);
    return null;
  }

  return await res.json();
}

/**
 * Get recording access link after it's processed.
 * Daily.co takes a few minutes to process recordings.
 * @param {string} recordingId
 * @returns {Promise<{download_link: string} | null>}
 */
export async function getRecordingLink(recordingId) {
  const res = await fetch(`${DAILY_API_BASE}/recordings/${recordingId}/access-link`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!res.ok) return null;
  return await res.json();
}

/**
 * Delete a room after debate is complete and recording is saved.
 * @param {string} roomName
 */
export async function deleteDailyRoom(roomName) {
  await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });
}
