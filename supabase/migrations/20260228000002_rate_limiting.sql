-- Rate limiting table for auth endpoints.
-- Tracks attempts per key (email or IP) within sliding windows.
-- Works across Vercel serverless instances since state is in Postgres.

CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,           -- e.g. "login:user@example.com" or "register:1.2.3.4"
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_key_time ON rate_limits(key, attempted_at DESC);

-- Check rate limit and record attempt atomically.
-- Returns true if the request is ALLOWED, false if rate-limited.
-- Cleans up old entries for this key in the same call.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max_attempts INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Clean up entries older than the window for this key
  DELETE FROM rate_limits
  WHERE key = p_key
    AND attempted_at < NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Count recent attempts
  SELECT COUNT(*) INTO recent_count
  FROM rate_limits
  WHERE key = p_key
    AND attempted_at >= NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- If over limit, reject
  IF recent_count >= p_max_attempts THEN
    RETURN FALSE;
  END IF;

  -- Record this attempt
  INSERT INTO rate_limits (key) VALUES (p_key);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
