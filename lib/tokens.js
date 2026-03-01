import { jwtVerify, SignJWT } from 'jose';

// Token expiration: 15 minutes in seconds
const APPROVAL_TOKEN_EXPIRY_SECONDS = 15 * 60;

// Lazily initialized at call time (not build time) to avoid missing env var errors
function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

/**
 * Create a time-limited JWT token for email approval links
 * Internal factory function
 */
async function createToken(topicId, action) {
  // Validate input
  if (!topicId || typeof topicId !== 'string' || !topicId.trim()) {
    throw new Error('topicId must be a non-empty string');
  }
  if (!['approve', 'reject'].includes(action)) {
    throw new Error('action must be "approve" or "reject"');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + APPROVAL_TOKEN_EXPIRY_SECONDS;

  const token = await new SignJWT({ topicId, action })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('debate-platform')
    .setSubject(topicId)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return token;
}

/**
 * Create approval token for email link (15 minute expiry)
 */
export async function createApprovalToken(topicId) {
  return createToken(topicId, 'approve');
}

/**
 * Create rejection token for email link (15 minute expiry)
 */
export async function createRejectionToken(topicId) {
  return createToken(topicId, 'reject');
}

/**
 * Verify a token and extract payload
 * Throws error if token is invalid or expired
 */
export async function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    return verified.payload;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    throw new Error(`Token verification failed: ${error.message}`);
  }
}
