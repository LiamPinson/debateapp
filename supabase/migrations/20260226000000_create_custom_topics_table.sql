-- Create custom_topics table
CREATE TABLE IF NOT EXISTS custom_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  notification_preference TEXT NOT NULL DEFAULT 'both'
    CHECK (notification_preference IN ('email', 'in_app', 'both')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by_email TEXT,
  CONSTRAINT headline_word_count CHECK (
    array_length(string_to_array(trim(headline), ' '), 1) <= 20
  ),
  CONSTRAINT description_word_count CHECK (
    array_length(string_to_array(trim(description), ' '), 1) <= 150
  ),
  CONSTRAINT non_empty_headline CHECK (trim(headline) != ''),
  CONSTRAINT non_empty_description CHECK (trim(description) != '')
);

-- Create indexes for common queries
CREATE INDEX idx_custom_topics_user_id ON custom_topics(user_id);
CREATE INDEX idx_custom_topics_status ON custom_topics(status);
CREATE INDEX idx_custom_topics_status_created ON custom_topics(status, created_at DESC);
CREATE INDEX idx_custom_topics_user_created ON custom_topics(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE custom_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own pending/approved topics
CREATE POLICY "users_view_own_topics" ON custom_topics
  FOR SELECT USING (
    (auth.uid()::text = user_id::text) OR (status = 'approved')
  );

-- RLS Policy: Only authenticated users can insert
CREATE POLICY "users_create_topics" ON custom_topics
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text
  );

-- RLS Policy: Only service role can update (for approval)
-- (This will be handled via service client in API routes)

-- Add custom_topic_id to debates table to link debates to custom topics
ALTER TABLE IF EXISTS debates
ADD COLUMN IF NOT EXISTS custom_topic_id UUID REFERENCES custom_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debates_custom_topic ON debates(custom_topic_id);
