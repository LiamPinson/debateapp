-- Add user_id column to sessions table so session tokens can be resolved
-- to a specific user. This closes the auth gap where the server had to
-- trust client-supplied userId in request bodies.

ALTER TABLE sessions ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_sessions_user_id ON sessions(user_id) WHERE user_id IS NOT NULL;
