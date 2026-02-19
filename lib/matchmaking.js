// ============================================================
// Matchmaking Engine
// ============================================================
// Handles queue entry, opponent matching, side assignment,
// prematch lobby with side swap, and debate room creation.
//
// Uses Supabase realtime for instant match notifications.
// ============================================================

import { createServiceClient } from "./supabase.js";
import { createDailyRoom, createMeetingToken } from "./daily.js";

/**
 * Add a user to the matchmaking queue.
 * @returns {{ queueEntry, immediateMatch? }}
 */
export async function enterQueue({
  userId,       // null if unregistered
  sessionId,    // null if registered
  category,     // 'quick' or topic category
  topicId,      // null for quick match
  timeLimit,    // 5, 15, or 45
  stance,       // 'pro', 'con', 'either'
  ranked,       // boolean
}) {
  const db = createServiceClient();

  // Check for existing queue entry
  const identityFilter = userId
    ? { column: "user_id", value: userId }
    : { column: "session_id", value: sessionId };

  const { data: existing } = await db
    .from("matchmaking_queue")
    .select("id")
    .eq(identityFilter.column, identityFilter.value)
    .eq("status", "waiting")
    .limit(1);

  if (existing && existing.length > 0) {
    // Already in queue — return existing entry
    return { queueEntry: existing[0], alreadyQueued: true };
  }

  // Insert into queue
  const entry = {
    user_id: userId || null,
    session_id: sessionId || null,
    category,
    topic_id: topicId || null,
    time_limit: timeLimit,
    stance,
    ranked,
    status: "waiting",
  };

  const { data: queueEntry, error } = await db
    .from("matchmaking_queue")
    .insert(entry)
    .select()
    .single();

  if (error) throw new Error(`Queue insert failed: ${error.message}`);

  // Expire stale queue entries before searching for a match
  try {
    await db.rpc("expire_stale_queue");
  } catch {
    // Fallback: inline expiry (RPC may not exist)
    await db
      .from("matchmaking_queue")
      .update({ status: "expired" })
      .eq("status", "waiting")
      .lt("expires_at", new Date().toISOString());
  }

  // Immediately try to find a match
  const match = await findMatch(db, queueEntry);

  return { queueEntry, match };
}

/**
 * Find a matching opponent in the queue.
 */
async function findMatch(db, entry) {
  console.log("FINDMATCH: searching", JSON.stringify({ id: entry.id, category: entry.category, time_limit: entry.time_limit, stance: entry.stance, ranked: entry.ranked, session_id: entry.session_id, user_id: entry.user_id }));
  // Build match query — only match with non-expired waiting entries
  let query = db
    .from("matchmaking_queue")
    .select("*")
    .eq("status", "waiting")
    .eq("time_limit", entry.time_limit)
    .eq("ranked", entry.ranked)
    .neq("id", entry.id)
    .gte("expires_at", new Date().toISOString());

  // Category matching
  if (entry.category === "quick") {
    query = query.eq("category", "quick");
  } else {
    query = query.eq("category", entry.category);
    if (entry.topic_id) {
      // Match on same topic, or anyone with no specific topic
      query = query.or(`topic_id.eq.${entry.topic_id},topic_id.is.null`);
    }
  }

  // Stance matching: prefer opposite stance
  if (entry.stance === "pro") {
    // Look for con or either
    query = query.in("stance", ["con", "either"]);
  } else if (entry.stance === "con") {
    query = query.in("stance", ["pro", "either"]);
  }
  // If stance is 'either', match with anyone

  // Exclude same user
  if (entry.user_id) {
    query = query.or(`user_id.neq.${entry.user_id},user_id.is.null`);
  }
  if (entry.session_id) {
    query = query.or(`session_id.neq.${entry.session_id},session_id.is.null`);
  }

  // FIFO — oldest first
  query = query.order("created_at", { ascending: true }).limit(1);

  const { data: opponents, error } = await query;

  console.log("FINDMATCH: result", JSON.stringify({ count: opponents?.length, error: error?.message, first: opponents?.[0]?.id }));
  if (!opponents || opponents.length === 0) {
    return null; // No match found, stay in queue
  }

  const opponent = opponents[0];

  // Assign sides
  const { proEntry, conEntry } = assignSides(entry, opponent);

  // Select topic for quick match
  let topicId = entry.topic_id || opponent.topic_id;
  if (!topicId) {
    topicId = await getRandomTopic(db, entry.category);
  }

  // Create the debate record
  const { data: debate, error: debateErr } = await db
    .from("debates")
    .insert({
      topic_id: topicId,
      pro_user_id: proEntry.user_id || null,
      pro_session_id: proEntry.session_id || null,
      con_user_id: conEntry.user_id || null,
      con_session_id: conEntry.session_id || null,
      time_limit: entry.time_limit,
      ranked: entry.ranked,
      status: "prematch",
      phase: "prematch",
    })
    .select()
    .single();

  if (debateErr) throw new Error(`Debate creation failed: ${debateErr.message}`);

  // Create Daily.co room
  const room = await createDailyRoom(debate.id, entry.time_limit);

  // Generate meeting tokens for both participants
  const proLabel = proEntry.user_id
    ? await getUsername(db, proEntry.user_id)
    : "Pro";
  const conLabel = conEntry.user_id
    ? await getUsername(db, conEntry.user_id)
    : "Con";

  const proToken = await createMeetingToken(room.name, proLabel, true);
  const conToken = await createMeetingToken(room.name, conLabel, false);

  // Update debate with room info
  await db
    .from("debates")
    .update({
      daily_room_name: room.name,
      daily_room_url: room.url,
    })
    .eq("id", debate.id);

  // Update both queue entries as matched
  await db
    .from("matchmaking_queue")
    .update({
      status: "matched",
      matched_with: opponent.id,
      debate_id: debate.id,
    })
    .eq("id", entry.id);

  await db
    .from("matchmaking_queue")
    .update({
      status: "matched",
      matched_with: entry.id,
      debate_id: debate.id,
    })
    .eq("id", opponent.id);

  // Send in-app notifications
  for (const qe of [proEntry, conEntry]) {
    if (qe.user_id) {
      await db.from("notifications").insert({
        user_id: qe.user_id,
        type: "match_found",
        title: "Match found!",
        body: "Your debate is ready. Join now.",
        data: { debate_id: debate.id },
      });
    }
  }

  return {
    debate_id: debate.id,
    topic_id: topicId,
    room_name: room.name,
    room_url: room.url,
    pro: {
      queue_id: proEntry.id,
      user_id: proEntry.user_id,
      session_id: proEntry.session_id,
      token: proToken,
      label: proLabel,
    },
    con: {
      queue_id: conEntry.id,
      user_id: conEntry.user_id,
      session_id: conEntry.session_id,
      token: conToken,
      label: conLabel,
    },
  };
}

/**
 * Assign Pro/Con sides based on stance preferences.
 */
function assignSides(entryA, entryB) {
  // If one explicitly chose pro
  if (entryA.stance === "pro") return { proEntry: entryA, conEntry: entryB };
  if (entryB.stance === "pro") return { proEntry: entryB, conEntry: entryA };

  // If one explicitly chose con
  if (entryA.stance === "con") return { proEntry: entryB, conEntry: entryA };
  if (entryB.stance === "con") return { proEntry: entryA, conEntry: entryB };

  // Both are 'either' — random assignment
  if (Math.random() > 0.5) {
    return { proEntry: entryA, conEntry: entryB };
  }
  return { proEntry: entryB, conEntry: entryA };
}

/**
 * Get a random topic for quick match.
 */
async function getRandomTopic(db, category) {
  let query = db.from("topics").select("id").eq("is_official", true);

  if (category && category !== "quick") {
    query = query.eq("category", category);
  }

  const { data: topics } = await query;
  if (!topics || topics.length === 0) return null;

  const random = topics[Math.floor(Math.random() * topics.length)];
  return random.id;
}

/**
 * Get username from user_id.
 */
async function getUsername(db, userId) {
  const { data } = await db
    .from("users")
    .select("username")
    .eq("id", userId)
    .single();
  return data?.username || "Anonymous";
}

/**
 * Handle side swap request in prematch lobby.
 * Both players must request a swap for it to happen.
 */
export async function requestSideSwap(debateId, requestingSide) {
  const db = createServiceClient();

  const { data: debate } = await db
    .from("debates")
    .select("*")
    .eq("id", debateId)
    .single();

  if (!debate || debate.phase !== "prematch") {
    return { swapped: false, reason: "Debate not in prematch phase" };
  }

  // Store swap requests in a simple metadata approach
  // We'll use a convention: check if both sides requested
  // For MVP, we track this client-side via Supabase realtime channel
  // and execute the swap server-side when both confirm

  // Swap the user/session IDs
  const { error } = await db
    .from("debates")
    .update({
      pro_user_id: debate.con_user_id,
      pro_session_id: debate.con_session_id,
      con_user_id: debate.pro_user_id,
      con_session_id: debate.pro_session_id,
    })
    .eq("id", debateId)
    .eq("phase", "prematch");

  if (error) return { swapped: false, reason: error.message };
  return { swapped: true };
}

/**
 * Leave the matchmaking queue.
 */
export async function leaveQueue(queueId) {
  const db = createServiceClient();
  await db
    .from("matchmaking_queue")
    .update({ status: "expired" })
    .eq("id", queueId)
    .eq("status", "waiting");
}
