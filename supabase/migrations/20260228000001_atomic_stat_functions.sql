-- Atomic SQL functions for user stat updates.
-- Prevents lost writes from concurrent read-then-write patterns.

-- Increment wins + total_debates atomically
CREATE OR REPLACE FUNCTION increment_wins(user_uuid UUID)
RETURNS void AS $$
  UPDATE users
  SET wins = wins + 1,
      total_debates = total_debates + 1
  WHERE id = user_uuid;
$$ LANGUAGE sql;

-- Increment losses + total_debates atomically
CREATE OR REPLACE FUNCTION increment_losses(user_uuid UUID)
RETURNS void AS $$
  UPDATE users
  SET losses = losses + 1,
      total_debates = total_debates + 1
  WHERE id = user_uuid;
$$ LANGUAGE sql;

-- Increment draws atomically
CREATE OR REPLACE FUNCTION increment_draws(user_uuid UUID)
RETURNS void AS $$
  UPDATE users
  SET draws = draws + 1
  WHERE id = user_uuid;
$$ LANGUAGE sql;

-- Update quality score with recency-weighted rolling average (80/20).
-- Single atomic statement — no read-then-write race condition.
CREATE OR REPLACE FUNCTION update_quality_score(user_uuid UUID, new_score INTEGER)
RETURNS void AS $$
  UPDATE users
  SET quality_score_avg = CASE
        WHEN total_debates = 0 THEN new_score
        ELSE LEAST(100, GREATEST(0, ROUND(quality_score_avg * 0.8 + new_score * 0.2)))
      END,
      total_debates = total_debates + 1
  WHERE id = user_uuid;
$$ LANGUAGE sql;

-- Increment topic debate_count atomically
CREATE OR REPLACE FUNCTION increment_topic_debate_count(topic_uuid UUID)
RETURNS void AS $$
  UPDATE topics
  SET debate_count = debate_count + 1
  WHERE id = topic_uuid;
$$ LANGUAGE sql;
