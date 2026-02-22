-- ============================================================
-- RLS FIX — Run this in Supabase SQL Editor
-- ============================================================
-- The app uses a custom session system (not Supabase auth), so
-- auth.uid() is always NULL for all browser clients. Policies
-- that rely on auth.uid() silently block all realtime events
-- and direct client queries.
--
-- These fixes make matchmaking_queue and debates publicly
-- readable so that:
--   1. Realtime postgres_changes events are delivered
--   2. The browser polling fallback can read queue status
-- ============================================================

-- 1. Allow all users to read matchmaking_queue entries.
--    Previously there was no SELECT policy → default DENY ALL.
--    The polling fallback in useMatchPolling needs this.
CREATE POLICY "Queue entries are publicly readable"
  ON matchmaking_queue FOR SELECT USING (true);

-- 2. Fix debates SELECT policy.
--    Old policy: status='completed' OR pro_user_id=auth.uid() OR con_user_id=auth.uid()
--    auth.uid() is always NULL (custom auth), so only completed debates were ever readable.
--    In-progress/prematch debates were invisible to the browser → no realtime events.
DROP POLICY IF EXISTS "Completed debates are publicly readable" ON debates;
CREATE POLICY "Debates are publicly readable"
  ON debates FOR SELECT USING (true);
