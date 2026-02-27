/**
 * Notification System for Custom Topics
 * Handles in-app and email notifications when users join custom debate topics
 */

/**
 * Send in-app notification when someone joins custom topic
 * Deferred: Implement based on existing notification system
 */
export async function notifyTopicCreatorInApp(creatorUserId, topicHeadline, participantUsername) {
  // TODO: Implement using existing notification system
  // Should use Supabase realtime or existing notification table
  console.log(`[TODO] Notify ${creatorUserId} that ${participantUsername} joined "${topicHeadline}"`);
}

/**
 * Send email notification when someone joins custom topic
 * Deferred: Only if creator has email preference
 */
export async function notifyTopicCreatorByEmail(creatorEmail, topicHeadline, participantUsername) {
  // TODO: Implement email sending
  // Check creator's notification_preference before sending
  console.log(`[TODO] Email ${creatorEmail} that ${participantUsername} joined "${topicHeadline}"`);
}
