import { jwtVerify, SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-key');

/**
 * Create a time-limited JWT token for email links
 * Token expires in 15 minutes
 */
export async function createApprovalToken(topicId) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60; // 15 minutes

  const token = await new SignJWT({ topicId, action: 'approve' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return token;
}

/**
 * Create a time-limited JWT token for rejection
 * Token expires in 15 minutes
 */
export async function createRejectionToken(topicId) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60; // 15 minutes

  const token = await new SignJWT({ topicId, action: 'reject' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return token;
}

/**
 * Verify a token and extract payload
 */
export async function verifyToken(token) {
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload;
  } catch (error) {
    return null;
  }
}
