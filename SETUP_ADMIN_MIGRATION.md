# Setup Admin Column Migration

The admin dashboard implementation requires an `is_admin` column in the `users` table. This column tracks which users have admin privileges.

## Status

The migration file has been created (`supabase/migrations/20260227103153_add_is_admin_to_users.sql`), but the actual database column needs to be added manually through the Supabase dashboard.

## Manual Setup: Add is_admin Column

### Step 1: Open Supabase Dashboard

Navigate to: https://supabase.com/dashboard

### Step 2: Open SQL Editor

In the left sidebar, click **"SQL Editor"**

### Step 3: Create New Query

Click the **"New Query"** button

### Step 4: Paste and Run Migration SQL

Copy and paste this SQL into the editor:

```sql
-- Add is_admin column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
```

### Step 5: Execute

Click **"Run"** or press `Ctrl+Enter`

Expected result: "No results" with no errors

### Step 6: Verify Success

Run this query to confirm the column exists:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'is_admin';
```

You should see one row with:
- `column_name: is_admin`
- `data_type: boolean`
- `column_default: false`

## After Migration: Set Admin Users

Once the column has been added, you can run the admin setup script:

```bash
# First email
node scripts/set-admin.mjs adaptivebodydesign@gmail.com

# Second email
node scripts/set-admin.mjs adaptivebodydesign@protonmail.com
```

Expected output:
```
Success: Admin status granted to "adaptivebodydesign@gmail.com"
Success: Admin status granted to "adaptivebodydesign@protonmail.com"
```

## Troubleshooting

**Error: "column 'is_admin' already exists"**
- The column has already been added. Proceed to running the admin setup script.

**Error: "Column 'is_admin' does not exist"** (when running the script)
- The migration hasn't been applied yet. Go back and run the SQL from Step 4.

**Other SQL errors**
- Check that you're using the correct Supabase project
- Verify your account has the necessary permissions
- Try the SQL in a fresh query window

## Related Files

- Migration file: `supabase/migrations/20260227103153_add_is_admin_to_users.sql`
- Admin setup script: `scripts/set-admin.mjs`
- Admin dashboard page: `app/admin/dashboard/page.js`
- Admin stats API: `app/api/admin/stats/route.js`
