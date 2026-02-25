# Apply winner_source Column Migration

The forfeit functionality requires a `winner_source` column in the `debates` table. This column tracks whether a win came from an AI decision, opponent forfeit, or community vote.

## Quick Fix: Run in Supabase SQL Editor

1. **Go to your Supabase project**: https://supabase.com/dashboard
2. **Navigate to SQL Editor** in the left sidebar
3. **Create a new query** and paste this SQL:

```sql
-- Add winner_source column to track how a debate was won
-- ai: AI decision
-- forfeit: opponent forfeited
-- community: community vote

ALTER TABLE debates
ADD COLUMN IF NOT EXISTS winner_source TEXT;

-- Set default to 'ai' for existing records
UPDATE debates SET winner_source = 'ai' WHERE winner_source IS NULL;

-- Add comment
COMMENT ON COLUMN debates.winner_source IS 'Source of win: ai (AI decision), forfeit (opponent forfeited), or community (community vote)';
```

4. **Click "Run"** (or press Ctrl+Enter)
5. **Verify success**: You should see "No results" and no errors

## After Migration

✅ The forfeit flow will now work correctly
✅ Start a debate and try the forfeit button
✅ The opponent will see the forfeit within 1 second
✅ The winner_source will be recorded as "forfeit"

## If You Encounter Errors

**Error: "Column already exists"**
- This means the column was already added - you're good to go! Test forfeit now.

**Error: "Column 'winner_source' does not exist"**
- The migration didn't run. Check the SQL syntax and try again.

**Other errors**
- Check your Supabase project permissions and try the SQL in a fresh query.

## Verify the Column Exists

Run this query to confirm:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'debates' AND column_name = 'winner_source';
```

You should see one row with `column_name: winner_source` and `data_type: text`.
