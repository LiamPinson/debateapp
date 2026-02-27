import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';

async function applyMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Applying migration: add_is_admin_to_users.sql');

  // Read the migration file
  const migrationContent = fs.readFileSync('/Users/l/Desktop/debate-app/.claude/worktrees/serene-hermann/supabase/migrations/20260227103153_add_is_admin_to_users.sql', 'utf-8');
  
  console.log('Migration SQL:');
  console.log(migrationContent);
  
  // Try to execute via psql if available, otherwise use Supabase client
  try {
    // Split and execute each statement
    const statements = migrationContent.split(';').filter(s => s.trim());
    
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`\nExecuting: ${statement.trim().substring(0, 50)}...`);
        // Note: Supabase JS client doesn't support raw SQL execution
        // This would need to be done via Postgres connection
      }
    }
    
    console.log('\nNote: Migration execution requires direct database access');
    console.log('Please apply this migration via Supabase dashboard SQL editor');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

applyMigration();
