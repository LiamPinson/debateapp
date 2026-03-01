// ============================================================
// Client API Layer
// ============================================================
// All fetch calls from the frontend to the API routes.
// The React components import from here — never call fetch directly.
// ============================================================

const API = "";

// ---- SESSION (unregistered users) ----

/**
 * Build standard headers for API calls.
 * Session token is transported via HttpOnly cookie (auto-attached by browser).
 */
function authHeaders() {
  return { "Content-Type": "application/json" };
}

/**
 * Standard fetch options — include credentials so the HttpOnly session
 * cookie is sent with every request.
 */
function fetchOpts(method, body) {
  return {
    method,
    headers: authHeaders(),
    credentials: "same-origin",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

export async function getOrCreateSession() {
  const res = await fetch(`${API}/api/auth/session`, fetchOpts("POST", {}));

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Session API error (${res.status})`);
  }
  return data;
}

/**
 * Clear the session cookie server-side.
 */
export async function logout() {
  await fetch(`${API}/api/auth/logout`, fetchOpts("POST"));
}

// ---- AUTH / REGISTRATION ----

export async function registerUser(username, email, password, sessionId) {
  const res = await fetch(`${API}/api/auth/register`, fetchOpts("POST", { username, email, password, sessionId }));
  return res.json();
}

export async function loginWithPassword(email, password) {
  const res = await fetch(`${API}/api/auth/login`, fetchOpts("POST", { email, password }));
  return res.json();
}

export async function loginWithOAuth(accessToken) {
  const res = await fetch(`${API}/api/auth/oauth`, fetchOpts("POST", { accessToken }));
  return res.json();
}

// ---- MATCHMAKING ----

export async function enterQueue({ userId, sessionId, category, topicId, timeLimit, stance, ranked }) {
  const res = await fetch(`${API}/api/matchmaking/queue`, fetchOpts("POST", { userId, sessionId, category, topicId, timeLimit, stance, ranked }));
  return res.json();
}

export async function leaveQueue(queueId) {
  const res = await fetch(`${API}/api/matchmaking/queue`, fetchOpts("DELETE", { queueId }));
  return res.json();
}

// ---- DAILY.CO ROOM ----

export async function getDailyToken(debateId, userId, sessionId, side) {
  const res = await fetch(`${API}/api/daily/room`, fetchOpts("POST", { debateId, userId, sessionId, side }));
  return res.json();
}

// ---- DEBATE LIFECYCLE ----

// Mark one side as ready in prematch. Server starts the debate when both sides
// are ready and returns the authoritative started_at timestamp.
// side parameter kept for backward compat but server derives it from session token
export async function setReady(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, fetchOpts("POST", { debateId, action: "ready" }));
  const data = await res.json();
  if (!res.ok) return { error: data.error || `Ready API error (${res.status})` };
  return data;
}

export async function startDebate(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, fetchOpts("POST", { debateId, action: "start" }));
  const data = await res.json();
  if (!res.ok) return { error: data.error || `Start API error (${res.status})` };
  return data;
}

export async function advancePhase(debateId, phase) {
  const res = await fetch(`${API}/api/debates/complete`, fetchOpts("POST", { debateId, action: "phase", phase }));
  const data = await res.json();
  if (!res.ok) return { error: data.error || `Phase advance API error (${res.status})` };
  return data;
}

export async function completeDebate(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, fetchOpts("POST", { debateId, action: "complete" }));
  const data = await res.json();
  if (!res.ok) return { error: data.error || `Complete API error (${res.status})` };
  return data;
}

// side is derived server-side from session token — not needed from client
export async function forfeitDebate(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, fetchOpts("POST", { debateId, action: "forfeit" }));
  const data = await res.json();
  if (!res.ok) return { error: data.error || `Forfeit API error (${res.status})` };
  return data;
}

export async function cancelDebate(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, fetchOpts("POST", { debateId, action: "cancel" }));
  const data = await res.json();
  if (!res.ok) return { error: data.error || `Cancel API error (${res.status})` };
  return data;
}

// ---- DEBATE DETAIL ----

export async function getDebateDetail(debateId) {
  // ?_= timestamp busts browser/CDN cache without the fetch cache option
  // (which throws "Invalid value" in some Next.js client environments)
  const res = await fetch(
    `${API}/api/debates/detail?debateId=${debateId}&_=${Date.now()}`
  );
  return res.json();
}

// ---- SIDE SWAP (prematch) ----

export async function requestSideSwap(debateId, requestingSide) {
  const res = await fetch(`${API}/api/debates/swap`, fetchOpts("POST", { debateId, requestingSide }));
  return res.json();
}

// ---- VOTES ----

export async function castVote(debateId, voterId, winnerChoice, extras = {}) {
  const res = await fetch(`${API}/api/votes/cast`, fetchOpts("POST", { debateId, voterId, winnerChoice, ...extras }));
  return res.json();
}

export async function getVoteTally(debateId) {
  const res = await fetch(`${API}/api/votes/cast?debateId=${debateId}`);
  return res.json();
}

// ---- PROFILE ----

export async function getProfile(userId) {
  const res = await fetch(`${API}/api/profile/me?userId=${userId}`);
  return res.json();
}

// ---- NOTIFICATIONS ----

export async function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const params = new URLSearchParams({ userId });
  if (unreadOnly) params.set("unreadOnly", "true");
  if (limit !== 50) params.set("limit", String(limit));

  const res = await fetch(`${API}/api/notifications?${params}`);
  return res.json();
}

export async function markNotificationsRead(notificationIds) {
  const res = await fetch(`${API}/api/notifications`, fetchOpts("PATCH", { notificationIds }));
  return res.json();
}

export async function markAllNotificationsRead(userId) {
  const res = await fetch(`${API}/api/notifications`, fetchOpts("PATCH", { userId, markAllRead: true }));
  return res.json();
}

// ---- CHALLENGES ----

export async function createChallenge(challengerId, targetId, topicId, timeLimit) {
  const res = await fetch(`${API}/api/challenges`, fetchOpts("POST", { challengerId, targetId, topicId, timeLimit }));
  return res.json();
}

export async function respondToChallenge(challengeId, action) {
  const res = await fetch(`${API}/api/challenges`, fetchOpts("PATCH", { challengeId, action }));
  return res.json();
}

export async function getChallenges(userId, type = "received") {
  const res = await fetch(`${API}/api/challenges?userId=${userId}&type=${type}`);
  return res.json();
}

// ---- SCORING (admin) ----

export async function triggerScoring(debateId) {
  const res = await fetch(`${API}/api/scoring/trigger`, fetchOpts("POST", { debateId }));
  return res.json();
}

export async function retryScoring(debateId) {
  const res = await fetch(`${API}/api/scoring/trigger`, fetchOpts("POST", { debateId, retry: true }));
  return res.json();
}

// ---- CUSTOM TOPICS ----

/**
 * Create a custom debate topic
 */
export async function createCustomTopic(headline, description, notificationPreference) {
  const res = await fetch(`${API}/api/custom-topics/create`, fetchOpts("POST", { headline, description, notificationPreference }));
  return res.json();
}

/**
 * Get all approved custom topics
 */
export async function getApprovedCustomTopics() {
  const response = await fetch(`${API}/api/custom-topics/approved`);
  return response.json();
}
