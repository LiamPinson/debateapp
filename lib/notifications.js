/**
 * Notification System for Custom Topics
 * Handles in-app and email notifications when users join custom debate topics.
 *
 * In-app notifications use the `notifications` table (same pattern as
 * pipeline.js notifyParticipants and matchmaking.js match_found).
 * Email uses the existing Resend integration from email.js.
 */

import { createServiceClient } from "./supabase.js";
import { sendTopicJoinedEmail } from "./email.js";

/**
 * Send in-app notification when someone joins a custom topic.
 * Inserts into the `notifications` table so Realtime picks it up
 * instantly on the creator's client.
 */
export async function notifyTopicCreatorInApp(creatorUserId, topicHeadline, participantUsername) {
  if (!creatorUserId) return;

  try {
    const db = createServiceClient();
    await db.from("notifications").insert({
      user_id: creatorUserId,
      type: "topic_joined",
      title: "Someone joined your topic!",
      body: `${participantUsername} is now debating on "${topicHeadline}".`,
      data: { topic_title: topicHeadline, participant: participantUsername },
    });
  } catch (err) {
    console.error("notifyTopicCreatorInApp failed:", err.message);
  }
}

/**
 * Send email notification when someone joins a custom topic.
 * Delegates to the existing sendTopicJoinedEmail in email.js (Resend).
 */
export async function notifyTopicCreatorByEmail(creatorEmail, topicHeadline, participantUsername) {
  if (!creatorEmail) return;

  try {
    const result = await sendTopicJoinedEmail(creatorEmail, topicHeadline, participantUsername);
    if (!result.success) {
      console.error("notifyTopicCreatorByEmail failed:", result.error);
    }
  } catch (err) {
    console.error("notifyTopicCreatorByEmail failed:", err.message);
  }
}
