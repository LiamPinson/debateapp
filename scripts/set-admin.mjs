import { createClient } from '@supabase/supabase-js';

/**
 * Admin Setup Script
 *
 * Usage: node scripts/set-admin.mjs <email>
 * Example: node scripts/set-admin.mjs user@example.com
 *
 * Sets is_admin = true for a user by email address.
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable.
 */

async function setAdmin(email) {
  // Validate email argument
  if (!email) {
    console.error('Error: Email argument required');
    console.log('Usage: node scripts/set-admin.mjs <email>');
    process.exit(1);
  }

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('Check .env.local or your environment setup');
    process.exit(1);
  }

  try {
    // Create Supabase service client (bypasses RLS)
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user exists
    const { data: user, error: selectError } = await db
      .from('users')
      .select('id, email, is_admin')
      .eq('email', email)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        console.error(`Error: User with email "${email}" not found`);
      } else {
        console.error('Database error:', selectError.message);
      }
      process.exit(1);
    }

    if (!user) {
      console.error(`Error: User with email "${email}" not found`);
      process.exit(1);
    }

    // Check if already admin
    if (user.is_admin) {
      console.log(`Info: User "${email}" is already an admin`);
      process.exit(0);
    }

    // Update is_admin to true
    const { error: updateError } = await db
      .from('users')
      .update({ is_admin: true })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update user:', updateError.message);
      process.exit(1);
    }

    console.log(`Success: Admin status granted to "${email}"`);
    process.exit(0);
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];
setAdmin(email);
