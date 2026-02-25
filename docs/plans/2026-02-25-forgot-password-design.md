# Forgot Password Feature Design

## Overview
Add a password reset flow that allows users to regain access to their account via email. Users click "Forgot Password?" in the login modal, enter their email, receive a reset link (valid for 1 hour), confirm their email, set a new password twice, and are automatically logged in.

## Database Schema

### `password_reset_tokens` table
```sql
CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

## API Endpoints

### POST `/api/auth/forgot-password`
**Request:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{ "success": true, "message": "If an account exists, a reset link will be sent to your email." }
```

**Response (400/500):**
```json
{ "error": "Invalid request" }
```

**Behavior:**
- Validates email is provided
- Looks up user by email in Supabase auth
- If user exists: generates 32-byte random token, stores in DB with 1-hour expiry, sends email
- If user doesn't exist: returns success anyway (security best practice)
- Email contains: subject line, reset link with token, 1-hour expiration notice
- Email link format: `{origin}/reset-password?token={token}`

### GET `/api/auth/reset-password/validate`
**Query params:** `?token={token}`

**Response (200):**
```json
{ "valid": true, "email": "u***@example.com" }
```

**Response (400):**
```json
{ "error": "Invalid or expired token" }
```

**Behavior:**
- Validates token exists in DB
- Checks `expires_at > now()`
- Returns masked email (first char + asterisks + domain)

### POST `/api/auth/reset-password`
**Request:**
```json
{
  "token": "abc123...",
  "email": "user@example.com",
  "password": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "user": { "id", "username", "email", ... },
  "sessionToken": "abc123..."
}
```

**Response (400/401):**
```json
{ "error": "Invalid token, expired token, or email mismatch" }
```

**Behavior:**
- Validates token exists and not expired
- Validates email matches token's email
- Validates password (minimum 8 chars, meets Supabase requirements)
- Updates user password in Supabase auth via `admin.auth.updateUserById()`
- Deletes token from DB
- Generates session token
- Returns user data + session token for auto-login

## UI Components

### ForgotPasswordModal (new)
- Modal overlay with form
- Email input
- Submit button with loading state
- Success message: "Check your email for a reset link"
- Error display if email lookup fails
- Link to return to login modal
- Auto-closes on success after 3 seconds, returns to LoginModal

### ResetPasswordPage (new, `/reset-password`)
- Full page (not modal)
- URL param: `?token={token}`
- Shows email as read-only (retrieved from validation endpoint)
- Password input field 1
- Password input field 2 (confirm)
- Password strength indicator (visual feedback)
- Submit button with loading state
- Error messages for: invalid token, expired token, password mismatch, weak password
- Success message with 2-second auto-redirect to home
- Link to return to login if token is invalid

### LoginModal (updated)
- Add "Forgot password?" link below password input
- Link opens ForgotPasswordModal instead of navigating
- Styling consistent with existing modal

## Error Handling

| Scenario | HTTP Status | User Message |
|----------|-------------|--------------|
| Email not provided | 400 | "Email is required" |
| Email not found | 200 | (Generic success for security) |
| Token invalid | 400 | "Reset link is invalid or has expired" |
| Token expired | 400 | "Reset link has expired. Request a new one." |
| Email mismatch on reset | 401 | "Email does not match the reset request" |
| Password too weak | 400 | "Password must be at least 8 characters" |
| Passwords don't match | 400 | "Passwords do not match" |
| Network/server error | 500 | "Something went wrong. Please try again." |

## Security Considerations

- **Token generation:** Use `crypto.randomBytes(32).toString('hex')` for 64-char hex tokens
- **Token storage:** Never log tokens or include in error messages
- **Token location:** Only in email links, never in logs or URLs visible to client-side code
- **Expiration:** 1 hour TTL, checked on every validation/reset attempt
- **Email verification:** User must confirm email on reset page (prevents typos on forgot-password step)
- **Password update:** Use Supabase auth admin API to ensure proper hashing
- **Session:** Generate new session token on successful reset (fresh login)
- **Rate limiting:** Consider rate limiting `/api/auth/forgot-password` to prevent email spam (future enhancement)

## Data Flow

```
1. User clicks "Forgot password?" in LoginModal
   ↓
2. ForgotPasswordModal opens
   ↓
3. User enters email, clicks submit
   ↓
4. POST /api/auth/forgot-password { email }
   ↓
5. Backend: validate email, generate token, send email
   ↓
6. User sees success message, returns to login modal
   ↓
7. User clicks link in email
   ↓
8. Redirects to /reset-password?token=xyz
   ↓
9. ResetPasswordPage loads, validates token via GET /api/auth/reset-password/validate
   ↓
10. Shows form with (read-only email, password, confirm password)
    ↓
11. User enters email, password twice, clicks submit
    ↓
12. POST /api/auth/reset-password { token, email, password }
    ↓
13. Backend: validate all, update password, delete token, return sessionToken
    ↓
14. Client: store sessionToken, login user context, redirect to home
```

## Testing Strategy

- **Unit:** Token generation, validation logic, expiration checks
- **Integration:** Full flow from forgot-password request to auto-login
- **Edge cases:** Expired tokens, wrong email, mismatched passwords, network failures
- **Security:** Tokens not logged, emails work correctly, auth endpoints reject invalid attempts

## Success Criteria

✅ User can reset password via email link
✅ Reset link expires after 1 hour
✅ User auto-logs in after successful reset
✅ Email confirmation prevents typos
✅ Tokens are cryptographically secure
✅ Clear error messages for all failure scenarios
✅ Consistent styling with existing auth UI
