-- Add winner_source column to track how a debate was won
-- ai: AI decision
-- forfeit: opponent forfeited
-- community: community vote

ALTER TABLE debates
ADD COLUMN IF NOT EXISTS winner_source TEXT;

-- Set default to 'ai' for existing records
UPDATE debates SET winner_source = 'ai' WHERE winner_source IS NULL;

-- Add constraint or comment (optional)
COMMENT ON COLUMN debates.winner_source IS 'Source of win: ai (AI decision), forfeit (opponent forfeited), or community (community vote)';
