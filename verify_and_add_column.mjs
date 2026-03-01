import { createClient } from '@supabase/supabase-js';

async function verifyAndAddColumn() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Checking if is_admin column exists...');
  
  try {
    // Try to select a user with is_admin field
    const { data, error } = await db
      .from('users')
      .select('id, email, is_admin')
      .limit(1);
    
    if (error) {
      console.error('Error:', error.message);
      if (error.message.includes('is_admin')) {
        console.log('\nColumn does NOT exist. Instructions to add it manually:');
        console.log('\n1. Go to: https://supabase.com/dashboard');
        console.log('2. Open your project for this URL:', supabaseUrl);
        console.log('3. Navigate to "SQL Editor" in the left sidebar');
        console.log('4. Click "New Query" and paste this SQL:\n');
        
        console.log(`
-- Add is_admin column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
        `);
        
        console.log('\n5. Click "Run" or press Ctrl+Enter');
        console.log('6. After success, re-run the set-admin.mjs script\n');
      }
    } else {
      console.log('Column EXISTS! Sample user:');
      console.log(data[0]);
    }
  } catch (e) {
    console.error('Unexpected error:', e.message);
  }
}

verifyAndAddColumn();
