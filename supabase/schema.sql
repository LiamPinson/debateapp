-- ============================================================
-- DEBATE PLATFORM — Database Schema
-- ============================================================
-- Run this in your Supabase SQL Editor (supabase.com/dashboard → SQL Editor)
-- This creates all tables, indexes, RLS policies, and seed data.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. SESSIONS (unregistered users)
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash TEXT UNIQUE NOT NULL,
  debate_count INTEGER DEFAULT 0,
  strike_count INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- ============================================================
-- 2. USERS (registered)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- links to supabase auth.users
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  session_id UUID REFERENCES sessions(id), -- migrated from unregistered
  total_debates INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  quality_score_avg NUMERIC(5,2) DEFAULT 50.00,
  strike_count INTEGER DEFAULT 0,
  rank_tier TEXT DEFAULT 'Bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_quality_score ON users(quality_score_avg DESC);

-- ============================================================
-- 3. TOPICS
-- ============================================================
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  short_title TEXT,
  description TEXT,
  category TEXT NOT NULL, -- politics, economics, philosophy, science, culture, silly, fantasy
  is_official BOOLEAN DEFAULT TRUE,
  is_async_only BOOLEAN DEFAULT FALSE,
  creator_id UUID REFERENCES users(id),
  debate_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_category ON topics(category);

-- ============================================================
-- 4. MATCHMAKING QUEUE
-- ============================================================
CREATE TABLE matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  -- one of user_id or session_id must be set
  category TEXT NOT NULL, -- 'quick' or a topic category
  topic_id UUID REFERENCES topics(id), -- null for quick match
  time_limit INTEGER NOT NULL, -- minutes: 5, 15, 45
  stance TEXT NOT NULL DEFAULT 'either', -- pro, con, either
  ranked BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'waiting', -- waiting, matched, expired
  matched_with UUID REFERENCES matchmaking_queue(id),
  debate_id UUID, -- set when debate is created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  CONSTRAINT chk_user_or_session CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX idx_queue_status ON matchmaking_queue(status, category, time_limit);
CREATE INDEX idx_queue_waiting ON matchmaking_queue(status) WHERE status = 'waiting';

-- ============================================================
-- 5. DEBATES
-- ============================================================
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES topics(id),
  pro_user_id UUID REFERENCES users(id),
  pro_session_id UUID REFERENCES sessions(id),
  con_user_id UUID REFERENCES users(id),
  con_session_id UUID REFERENCES sessions(id),
  time_limit INTEGER NOT NULL, -- minutes
  debate_type TEXT DEFAULT 'live', -- live, async
  ranked BOOLEAN DEFAULT FALSE,

  -- Daily.co room
  daily_room_name TEXT,
  daily_room_url TEXT,

  -- Audio recordings (Daily.co recording URLs or storage paths)
  recording_id TEXT,
  audio_url_pro TEXT,
  audio_url_con TEXT,
  audio_url_combined TEXT,

  -- Transcription
  transcript JSONB, -- { segments: [{ speaker, start, end, text }] }
  transcript_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed

  -- AI Scoring
  ai_procedural_analysis JSONB, -- Tier 1: strike detection
  ai_qualitative_analysis JSONB, -- Tier 2: quality scores
  scoring_status TEXT DEFAULT 'pending', -- pending, processing, completed

  -- Results
  pro_quality_score NUMERIC(5,2),
  con_quality_score NUMERIC(5,2),
  winner TEXT, -- pro, con, draw, null (pending)
  winner_source TEXT, -- ai, community, forfeit

  -- Status
  status TEXT DEFAULT 'prematch', -- prematch, in_progress, completed, forfeited, cancelled
  phase TEXT DEFAULT 'prematch', -- prematch, opening_pro, opening_con, freeflow, closing_con, closing_pro, ended
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_topic ON debates(topic_id);
CREATE INDEX idx_debates_pro_user ON debates(pro_user_id);
CREATE INDEX idx_debates_con_user ON debates(con_user_id);

-- ============================================================
-- 6. ASYNC TURNS
-- ============================================================
CREATE TABLE async_turns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  speaker_side TEXT NOT NULL, -- pro, con
  audio_url TEXT,
  transcript_text TEXT,
  turn_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  response_deadline TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_async_turns_debate ON async_turns(debate_id, turn_number);

-- ============================================================
-- 7. VOTES
-- ============================================================
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES users(id),
  winner_choice TEXT NOT NULL, -- pro, con, draw
  better_arguments TEXT, -- pro, con, equal (optional)
  more_respectful TEXT, -- pro, con, equal (optional)
  changed_mind BOOLEAN, -- optional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(debate_id, voter_id)
);

CREATE INDEX idx_votes_debate ON votes(debate_id);

-- ============================================================
-- 8. CHALLENGES
-- ============================================================
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_id UUID REFERENCES users(id),
  target_id UUID REFERENCES users(id),
  topic_id UUID REFERENCES topics(id),
  time_limit INTEGER DEFAULT 15,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_challenges_target ON challenges(target_id, status);

-- ============================================================
-- 9. STRIKES
-- ============================================================
CREATE TABLE strikes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  debate_id UUID REFERENCES debates(id),
  reason TEXT NOT NULL, -- ad_hominem, slurs, profanity, non_participation, false_report
  ai_confidence NUMERIC(4,3),
  transcript_excerpt TEXT,
  admin_reviewed BOOLEAN DEFAULT FALSE,
  admin_decision TEXT DEFAULT 'pending', -- pending, confirmed, dismissed
  appealed BOOLEAN DEFAULT FALSE,
  appeal_status TEXT, -- pending, upheld, overturned
  appeal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_strike_user CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX idx_strikes_user ON strikes(user_id);
CREATE INDEX idx_strikes_pending ON strikes(admin_reviewed) WHERE admin_reviewed = FALSE;

-- ============================================================
-- 10. NOTIFICATIONS (in-app)
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL, -- match_found, debate_scored, challenge_received, strike_issued
  title TEXT NOT NULL,
  body TEXT,
  data JSONB, -- arbitrary payload (debate_id, etc.)
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Topics: public read
CREATE POLICY "Topics are publicly readable"
  ON topics FOR SELECT USING (true);

-- Debates: public read for completed, participants for in-progress
CREATE POLICY "Completed debates are publicly readable"
  ON debates FOR SELECT USING (
    status = 'completed'
    OR pro_user_id = auth.uid()
    OR con_user_id = auth.uid()
  );

-- Votes: authenticated users can read all, insert own
CREATE POLICY "Votes are readable by all authenticated users"
  ON votes FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can cast their own votes"
  ON votes FOR INSERT WITH CHECK (voter_id = auth.uid());

-- Notifications: users see their own
CREATE POLICY "Users see their own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Users: public read for profiles
CREATE POLICY "User profiles are publicly readable"
  ON users FOR SELECT USING (true);

-- Users can update their own record
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth_id = auth.uid());

-- Service role bypasses RLS for all server-side operations
-- (API routes use SUPABASE_SERVICE_ROLE_KEY)

-- ============================================================
-- 12. REALTIME SUBSCRIPTIONS
-- ============================================================
-- Enable realtime for matchmaking and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE debates;

-- ============================================================
-- 13. SEED DATA — Official Topics
-- ============================================================

-- Politics
INSERT INTO topics (title, short_title, category, description) VALUES
  ('Universal Basic Income is necessary for the modern economy', 'UBI', 'politics', 'Should governments provide unconditional cash payments to all citizens?'),
  ('Immigration restrictions do more harm than good', 'Immigration', 'politics', 'Are strict immigration policies net negative for society?'),
  ('The Electoral College should be abolished', 'Electoral College', 'politics', 'Should the US move to a popular vote system for presidential elections?'),
  ('Gun ownership is a fundamental right that should not be restricted', 'Gun Control', 'politics', 'Does the Second Amendment protect an individual right to bear arms without restriction?');

-- Economics
INSERT INTO topics (title, short_title, category, description) VALUES
  ('Cryptocurrency regulation will stifle innovation', 'Crypto Regulation', 'economics', 'Would government oversight of crypto markets do more harm than good?'),
  ('Rent control is an effective solution to housing affordability', 'Rent Control', 'economics', 'Do price controls on housing actually help renters long-term?'),
  ('Free trade agreements benefit all participating nations', 'Free Trade', 'economics', 'Are multilateral trade deals win-win or do they create losers?'),
  ('A 4-day work week would boost productivity', '4-Day Work Week', 'economics', 'Can we work less and produce more?');

-- Philosophy
INSERT INTO topics (title, short_title, category, description) VALUES
  ('Free will is an illusion', 'Free Will', 'philosophy', 'Are our choices determined by prior causes, or do we have genuine agency?'),
  ('Utilitarianism is the most ethical framework', 'Utilitarianism', 'philosophy', 'Should we always act to maximize overall happiness?'),
  ('AI systems can be genuinely conscious', 'AI Consciousness', 'philosophy', 'Is subjective experience possible in artificial systems?'),
  ('Moral relativism is intellectually bankrupt', 'Moral Relativism', 'philosophy', 'Are there universal moral truths, or is ethics culturally determined?');

-- Science
INSERT INTO topics (title, short_title, category, description) VALUES
  ('Nuclear energy is essential for combating climate change', 'Nuclear Energy', 'science', 'Is nuclear power a necessary part of the clean energy transition?'),
  ('GMOs are safe and necessary for food security', 'GMOs', 'science', 'Should we embrace genetic modification of crops?'),
  ('Mars colonization should be humanity''s top priority', 'Mars Colony', 'science', 'Should we invest trillions in becoming a multi-planetary species?'),
  ('Human gene editing should be permitted for enhancement', 'Gene Editing', 'science', 'Should CRISPR be used beyond treating disease?');

-- Culture
INSERT INTO topics (title, short_title, category, description) VALUES
  ('Social media has been a net negative for society', 'Social Media', 'culture', 'Has the rise of social platforms done more harm than good?'),
  ('Cancel culture is a healthy form of accountability', 'Cancel Culture', 'culture', 'Is public shaming an effective tool for social justice?'),
  ('Meritocracy is a myth', 'Meritocracy', 'culture', 'Does success truly reflect talent and effort, or structural advantages?'),
  ('Remote work is better than office work', 'Remote Work', 'culture', 'Should remote-first be the default for knowledge workers?');

-- Silly
INSERT INTO topics (title, short_title, category, description) VALUES
  ('A hot dog is a sandwich', 'Hot Dog Sandwich', 'silly', 'Bread on two sides, filling in the middle. Case closed?'),
  ('Cereal is soup', 'Cereal Is Soup', 'silly', 'Liquid + solid ingredients in a bowl. Soup.'),
  ('Pineapple belongs on pizza', 'Pineapple Pizza', 'silly', 'The great Hawaiian pizza debate.'),
  ('Water is wet', 'Water Is Wet', 'silly', 'Is water itself wet, or does it only make other things wet?'),
  ('A taco is a sandwich', 'Taco Sandwich', 'silly', 'Where does the sandwich end and the taco begin?');

-- Fantasy / Fandom
INSERT INTO topics (title, short_title, category, description) VALUES
  ('Thanos was morally justified', 'Thanos Did Nothing Wrong', 'fantasy', 'Was the snap a utilitarian necessity?'),
  ('The Jedi Order is an authoritarian cult', 'Jedi Are Authoritarian', 'fantasy', 'Child recruitment, emotional suppression, political manipulation.'),
  ('Aragorn would beat Jon Snow in single combat', 'Aragorn vs Jon Snow', 'fantasy', 'Numenorean king vs bastard of Winterfell.'),
  ('Gandalf should have used the eagles to fly to Mordor', 'Eagle Plot Hole', 'fantasy', 'The biggest plot hole in fantasy, or is there a good explanation?'),
  ('The Empire did more good than harm for the galaxy', 'Empire Apologia', 'fantasy', 'Infrastructure, order, and stability vs authoritarianism.'),
  ('Palpatine''s rise to power was morally defensible', 'Palpatine Morality', 'fantasy', 'Was he a political genius operating within the system?');

-- ============================================================
-- 14. HELPER FUNCTIONS
-- ============================================================

-- Function to calculate rank tier from quality score
CREATE OR REPLACE FUNCTION calculate_rank_tier(score NUMERIC)
RETURNS TEXT AS $$
BEGIN
  IF score >= 95 THEN RETURN 'Diamond';
  ELSIF score >= 85 THEN RETURN 'Platinum';
  ELSIF score >= 70 THEN RETURN 'Gold';
  ELSIF score >= 50 THEN RETURN 'Silver';
  ELSE RETURN 'Bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update rank_tier when quality_score changes
CREATE OR REPLACE FUNCTION update_rank_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.rank_tier := calculate_rank_tier(NEW.quality_score_avg);
  NEW.last_active := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rank_tier
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.quality_score_avg IS DISTINCT FROM NEW.quality_score_avg)
  EXECUTE FUNCTION update_rank_tier();

-- Function to expire stale queue entries
CREATE OR REPLACE FUNCTION expire_stale_queue()
RETURNS void AS $$
BEGIN
  UPDATE matchmaking_queue
  SET status = 'expired'
  WHERE status = 'waiting' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
