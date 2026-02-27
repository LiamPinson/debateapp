import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@debatearena.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Escape HTML special characters to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

// Validate required environment variables at module load
if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production') {
  console.error('FATAL: RESEND_API_KEY environment variable is required in production');
}
if (!process.env.OWNER_EMAIL && process.env.NODE_ENV === 'production') {
  console.error('WARNING: OWNER_EMAIL not set; defaulting to owner@debatearena.com');
}

/**
 * Send email to owner when new custom topic is submitted
 */
export async function sendTopicSubmissionEmail(topicHeadline, approveToken, rejectToken) {
  // Validate inputs
  if (!topicHeadline?.trim()) {
    console.error('sendTopicSubmissionEmail: topicHeadline is required');
    return { success: false, error: 'Topic headline is required' };
  }
  if (!approveToken?.trim() || !rejectToken?.trim()) {
    console.error('sendTopicSubmissionEmail: tokens are required');
    return { success: false, error: 'Approval tokens are required' };
  }

  const approveUrl = `${APP_URL}/api/custom-topics/approve?token=${approveToken}`;
  const rejectUrl = `${APP_URL}/api/custom-topics/reject?token=${rejectToken}`;
  const escapedHeadline = escapeHtml(topicHeadline);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Sending topic submission email for "${topicHeadline}"`);
    console.log(`[DEV]   Approve URL: ${approveUrl}`);
    console.log(`[DEV]   Reject URL: ${rejectUrl}`);
    return { success: true, message: 'Email sent (dev mode)' };
  }

  try {
    const response = await resend.emails.send({
      from: 'Debate Arena <noreply@debatearena.com>',
      to: OWNER_EMAIL,
      subject: `New custom debate topic submitted: "${escapedHeadline}"`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="margin-bottom:8px">New Custom Topic Submitted</h2>
          <p style="color:#666;margin-bottom:24px">
            A user has submitted a new debate topic for approval.
          </p>

          <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
            <p style="margin:0 0 8px 0;font-weight:600">${escapedHeadline}</p>
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
    if (response.error) {
      return { success: false, error: response.error.message };
    }
    return { success: true, message: 'Email sent', data: response.data };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email to topic creator when topic is approved
 */
export async function sendTopicApprovedEmail(creatorEmail, topicHeadline) {
  // Validate inputs
  if (!creatorEmail?.trim()) {
    console.error('sendTopicApprovedEmail: creatorEmail is required');
    return { success: false, error: 'Creator email is required' };
  }
  if (!topicHeadline?.trim()) {
    console.error('sendTopicApprovedEmail: topicHeadline is required');
    return { success: false, error: 'Topic headline is required' };
  }

  const escapedHeadline = escapeHtml(topicHeadline);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Sending topic approved email to ${creatorEmail}`);
    console.log(`[DEV]   Topic: "${topicHeadline}"`);
    console.log(`[DEV]   View Topics URL: ${APP_URL}`);
    return { success: true, message: 'Email sent (dev mode)' };
  }

  try {
    const response = await resend.emails.send({
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
            <p style="margin:0;font-weight:600">${escapedHeadline}</p>
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
    if (response.error) {
      return { success: false, error: response.error.message };
    }
    return { success: true, message: 'Email sent', data: response.data };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification when someone joins a custom topic debate
 */
export async function sendTopicJoinedEmail(creatorEmail, topicHeadline, participantUsername) {
  // Validate inputs
  if (!creatorEmail?.trim()) {
    console.error('sendTopicJoinedEmail: creatorEmail is required');
    return { success: false, error: 'Creator email is required' };
  }
  if (!topicHeadline?.trim()) {
    console.error('sendTopicJoinedEmail: topicHeadline is required');
    return { success: false, error: 'Topic headline is required' };
  }
  if (!participantUsername?.trim()) {
    console.error('sendTopicJoinedEmail: participantUsername is required');
    return { success: false, error: 'Participant username is required' };
  }

  const escapedHeadline = escapeHtml(topicHeadline);
  const escapedUsername = escapeHtml(participantUsername);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Sending topic joined email to ${creatorEmail}`);
    console.log(`[DEV]   Participant: ${participantUsername}`);
    console.log(`[DEV]   Topic: "${topicHeadline}"`);
    console.log(`[DEV]   View Debate URL: ${APP_URL}`);
    return { success: true, message: 'Email sent (dev mode)' };
  }

  try {
    const response = await resend.emails.send({
      from: 'Debate Arena <noreply@debatearena.com>',
      to: creatorEmail,
      subject: `Someone joined your debate topic!`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin-bottom:8px">Topic Activity</h2>
          <p style="color:#666;margin-bottom:16px">
            <strong>${escapedUsername}</strong> is now debating on your custom topic:
          </p>

          <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
            <p style="margin:0;font-weight:600">${escapedHeadline}</p>
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
    if (response.error) {
      return { success: false, error: response.error.message };
    }
    return { success: true, message: 'Email sent', data: response.data };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}
