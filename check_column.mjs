import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkColumn() {
  try {
    // Try to check if column exists by attempting to select and update it
    const { data, error } = await db
      .from('users')
      .select('id, email, is_admin')
      .limit(1);
      
    if (error?.message?.includes('column')) {
      console.log('Column is_admin does NOT exist yet');
      console.log('Error:', error.message);
      
      // Try the alternative approach - use postgres.from with direct column addition
      console.log('\nAttempting to use Supabase admin API to apply migration...');
    } else if (data) {
      console.log('Column is_admin EXISTS');
      console.log('Sample data:', data[0]);
    }
  } catch (e) {
    console.error('Check error:', e.message);
  }
}

checkColumn();
