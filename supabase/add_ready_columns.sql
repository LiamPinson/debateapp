-- Add per-side ready flags to debates table.
-- Run in Supabase SQL Editor before deploying the ready-flow fix.
ALTER TABLE debates ADD COLUMN IF NOT EXISTS pro_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE debates ADD COLUMN IF NOT EXISTS con_ready BOOLEAN NOT NULL DEFAULT FALSE;
