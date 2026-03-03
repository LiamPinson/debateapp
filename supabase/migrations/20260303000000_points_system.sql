-- ============================================================
-- Points System Migration
-- ============================================================
-- Adds a spendable points currency for registered users.
-- Points are earned by completing debates and spent by submitting
-- custom topic proposals.
-- ============================================================

-- 1. Add points_balance to users table
ALTER TABLE users ADD COLUMN points_balance INTEGER NOT NULL DEFAULT 0;

-- 2. Create point_transactions table
CREATE TABLE point_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL, -- positive = earned, negative = spent
  type             TEXT NOT NULL CHECK (type IN ('debate_completed', 'topic_submitted')),
  debate_id        UUID REFERENCES debates(id) ON DELETE SET NULL,
  custom_topic_id  UUID REFERENCES custom_topics(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_transactions_user ON point_transactions(user_id, created_at DESC);
CREATE INDEX idx_point_transactions_debate ON point_transactions(debate_id) WHERE debate_id IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transactions
CREATE POLICY "Users can view own transactions"
  ON point_transactions FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Service role handles all writes via API routes (no INSERT policy needed for anon/authenticated)

-- 4. award_points: inserts a positive transaction and increments user balance atomically
CREATE OR REPLACE FUNCTION award_points(
  p_user_id   UUID,
  p_amount    INT,
  p_type      TEXT,
  p_debate_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Insert transaction record
  INSERT INTO point_transactions (user_id, amount, type, debate_id)
  VALUES (p_user_id, p_amount, p_type, p_debate_id);

  -- Increment user balance
  UPDATE users
  SET points_balance = points_balance + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. spend_points: inserts a negative transaction and decrements balance, raises if insufficient
CREATE OR REPLACE FUNCTION spend_points(
  p_user_id         UUID,
  p_amount          INT,
  p_type            TEXT,
  p_custom_topic_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT points_balance INTO v_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', v_balance, p_amount;
  END IF;

  -- Insert transaction record
  INSERT INTO point_transactions (user_id, amount, type, custom_topic_id)
  VALUES (p_user_id, -p_amount, p_type, p_custom_topic_id);

  -- Decrement user balance
  UPDATE users
  SET points_balance = points_balance - p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
