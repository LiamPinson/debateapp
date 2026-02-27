import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@debatearena.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Send email to owner when new custom topic is submitted
 */
export async function sendTopicSubmissionEmail(topicHeadline, approveToken, rejectToken) {
  const approveUrl = `${APP_URL}/api/custom-topics/approve?token=${approveToken}`;
  const rejectUrl = `${APP_URL}/api/custom-topics/reject?token=${rejectToken}`;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Topic submission: "${topicHeadline}"`);
    console.log(`[DEV] Approve: ${approveUrl}`);
    console.log(`[DEV] Reject: ${rejectUrl}`);
    return { success: true };
  }

  return resend.emails.send({
    from: 'Debate Arena <noreply@debatearena.com>',
    to: OWNER_EMAIL,
    subject: `New custom debate topic submitted: "${topicHeadline}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">New Custom Topic Submitted</h2>
        <p style="color:#666;margin-bottom:24px">
          A user has submitted a new debate topic for approval.
        </p>

        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0 0 8px 0;font-weight:600">${topicHeadline}</p>
        </div>

        <p style="color:#666;margin-bottom:16px">
          Review and approve or reject this topic:
        </p>

        <div style="display:flex;gap:12px;margin-bottom:24px">
          <a href="${approveUrl}"
             style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Approve Topic
          </a>
          <a href="${rejectUrl}"
             style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Reject Topic
          </a>
        </div>

        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #ddd;padding-top:16px">
          Links expire in 15 minutes.
        </p>
      </div>
    `,
  });
}

/**
 * Send email to topic creator when topic is approved
 */
export async function sendTopicApprovedEmail(creatorEmail, topicHeadline) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Topic approved email to ${creatorEmail}: "${topicHeadline}"`);
    return { success: true };
  }

  return resend.emails.send({
    from: 'Debate Arena <noreply@debatearena.com>',
    to: creatorEmail,
    subject: `Your debate topic is now live!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Topic Approved! 🎉</h2>
        <p style="color:#666;margin-bottom:16px">
          Your custom debate topic has been approved and is now live:
        </p>

        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-weight:600">${topicHeadline}</p>
        </div>

        <p style="color:#666;margin-bottom:16px">
          Users can now debate on your topic. You'll receive notifications when participants join.
        </p>

        <a href="${APP_URL}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          View Topics
        </a>

        <p style="color:#999;font-size:12px;margin-top:24px">
          Thanks for contributing to the community!
        </p>
      </div>
    `,
  });
}

/**
 * Send notification when someone joins a custom topic debate
 */
export async function sendTopicJoinedEmail(creatorEmail, topicHeadline, participantUsername) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Topic joined email to ${creatorEmail}: ${participantUsername} joined "${topicHeadline}"`);
    return { success: true };
  }

  return resend.emails.send({
    from: 'Debate Arena <noreply@debatearena.com>',
    to: creatorEmail,
    subject: `Someone joined your debate topic!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Topic Activity</h2>
        <p style="color:#666;margin-bottom:16px">
          <strong>${participantUsername}</strong> is now debating on your custom topic:
        </p>

        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-weight:600">${topicHeadline}</p>
        </div>

        <a href="${APP_URL}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          View Debate
        </a>

        <p style="color:#999;font-size:12px;margin-top:24px">
          You can manage notification settings in your account.
        </p>
      </div>
    `,
  });
}
