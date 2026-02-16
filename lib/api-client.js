// ============================================================
// Client API Layer
// ============================================================
// All fetch calls from the frontend to the API routes.
// The React components import from here — never call fetch directly.
// ============================================================

const API = "";

// ---- SESSION (unregistered users) ----

const SESSION_KEY = "debate_session_token";

export async function getOrCreateSession() {
  const existingToken = localStorage.getItem(SESSION_KEY);

  const res = await fetch(`${API}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: existingToken || undefined }),
  });

  const data = await res.json();
  if (data.token) {
    localStorage.setItem(SESSION_KEY, data.token);
  }
  return data;
}

// ---- AUTH / REGISTRATION ----

export async function registerUser(username, email, sessionId) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, sessionId }),
  });
  return res.json();
}

// ---- MATCHMAKING ----

export async function enterQueue({ userId, sessionId, category, topicId, timeLimit, stance, ranked }) {
  const res = await fetch(`${API}/api/matchmaking/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, sessionId, category, topicId, timeLimit, stance, ranked }),
  });
  return res.json();
}

export async function leaveQueue(queueId) {
  const res = await fetch(`${API}/api/matchmaking/queue`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queueId }),
  });
  return res.json();
}

// ---- DAILY.CO ROOM ----

export async function getDailyToken(debateId, userId, sessionId, side) {
  const res = await fetch(`${API}/api/daily/room`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, userId, sessionId, side }),
  });
  return res.json();
}

// ---- DEBATE LIFECYCLE ----

export async function startDebate(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, action: "start" }),
  });
  return res.json();
}

export async function advancePhase(debateId, phase) {
  const res = await fetch(`${API}/api/debates/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, action: "phase", phase }),
  });
  return res.json();
}

export async function completeDebate(debateId) {
  const res = await fetch(`${API}/api/debates/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, action: "complete" }),
  });
  return res.json();
}

export async function forfeitDebate(debateId, side) {
  const res = await fetch(`${API}/api/debates/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, action: "forfeit", side }),
  });
  return res.json();
}

// ---- DEBATE DETAIL ----

export async function getDebateDetail(debateId) {
  const res = await fetch(`${API}/api/debates/detail?debateId=${debateId}`);
  return res.json();
}

// ---- SIDE SWAP (prematch) ----

export async function requestSideSwap(debateId, requestingSide) {
  const res = await fetch(`${API}/api/debates/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, requestingSide }),
  });
  return res.json();
}

// ---- VOTES ----

export async function castVote(debateId, voterId, winnerChoice, extras = {}) {
  const res = await fetch(`${API}/api/votes/cast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, voterId, winnerChoice, ...extras }),
  });
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
  const res = await fetch(`${API}/api/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationIds }),
  });
  return res.json();
}

export async function markAllNotificationsRead(userId) {
  const res = await fetch(`${API}/api/notifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, markAllRead: true }),
  });
  return res.json();
}

// ---- CHALLENGES ----

export async function createChallenge(challengerId, targetId, topicId, timeLimit) {
  const res = await fetch(`${API}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengerId, targetId, topicId, timeLimit }),
  });
  return res.json();
}

export async function respondToChallenge(challengeId, action) {
  const res = await fetch(`${API}/api/challenges`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId, action }),
  });
  return res.json();
}

export async function getChallenges(userId, type = "received") {
  const res = await fetch(`${API}/api/challenges?userId=${userId}&type=${type}`);
  return res.json();
}

// ---- SCORING (admin) ----

export async function triggerScoring(debateId) {
  const res = await fetch(`${API}/api/scoring/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId }),
  });
  return res.json();
}

export async function retryScoring(debateId) {
  const res = await fetch(`${API}/api/scoring/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debateId, retry: true }),
  });
  return res.json();
}
