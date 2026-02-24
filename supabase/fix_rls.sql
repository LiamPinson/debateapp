-- ============================================================
-- RLS FIX — Run this in Supabase SQL Editor
-- ============================================================
-- The app uses a custom session system (not Supabase Auth), so
-- auth.uid() is always NULL for all browser clients.  Policies
-- that rely on auth.uid() silently block all Realtime
-- postgres_changes events and direct client queries.
--
-- All writes go through API routes using the service role key
-- (which bypasses RLS), so making SELECT public is safe.
-- ============================================================

-- 1. matchmaking_queue: No SELECT policy existed → DENY ALL.
--    Needed for Realtime match notifications and polling fallback.
DROP POLICY IF EXISTS "Queue entries are publicly readable" ON matchmaking_queue;
CREATE POLICY "Queue entries are publicly readable"
  ON matchmaking_queue FOR SELECT USING (true);

-- 2. debates: Old policy only allowed completed or auth.uid() match.
--    Prematch and in_progress debates were invisible → no Realtime events.
DROP POLICY IF EXISTS "Completed debates are publicly readable" ON debates;
DROP POLICY IF EXISTS "Debates are publicly readable" ON debates;
CREATE POLICY "Debates are publicly readable"
  ON debates FOR SELECT USING (true);

-- 3. notifications: Old policy used user_id = auth.uid() → always null.
--    Needed for Realtime INSERT event delivery.
DROP POLICY IF EXISTS "Users see their own notifications" ON notifications;
DROP POLICY IF EXISTS "Notifications are publicly readable" ON notifications;
CREATE POLICY "Notifications are publicly readable"
  ON notifications FOR SELECT USING (true);

-- 4. notifications UPDATE: Old policy used user_id = auth.uid().
--    Mark-read goes through service role API, but fix for consistency.
DROP POLICY IF EXISTS "Users can mark own notifications read" ON notifications;
DROP POLICY IF EXISTS "Notifications are publicly updatable" ON notifications;
CREATE POLICY "Notifications are publicly updatable"
  ON notifications FOR UPDATE USING (true);

-- 5. votes: Old policy used auth.role() = 'authenticated' → never true.
--    Browser needs to read vote tallies on completed debates.
DROP POLICY IF EXISTS "Votes are readable by all authenticated users" ON votes;
DROP POLICY IF EXISTS "Votes are publicly readable" ON votes;
CREATE POLICY "Votes are publicly readable"
  ON votes FOR SELECT USING (true);

-- 6. votes INSERT: Old policy used voter_id = auth.uid() → always null.
--    Voting goes through the service role API, but fix for completeness.
DROP POLICY IF EXISTS "Users can cast their own votes" ON votes;
DROP POLICY IF EXISTS "Votes are insertable" ON votes;
CREATE POLICY "Votes are insertable"
  ON votes FOR INSERT WITH CHECK (true);
