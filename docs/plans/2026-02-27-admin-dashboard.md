# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a lightweight admin dashboard accessible only to specified admin emails, displaying platform statistics (total debates, registered users, pending topics).

**Architecture:** Add `isAdmin` boolean to User model, create protected `/admin/dashboard` page with server-side auth check, create stats API endpoint, implement post-login redirect for admins, add setup script to grant admin status.

**Tech Stack:** Next.js, Prisma/Supabase, Node.js script

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add isAdmin field to User model**

Open `prisma/schema.prisma` and locate the User model. Add this field after the `email` field:

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  username  String    @unique
  password  String
  isAdmin   Boolean   @default(false)
  // ... rest of fields
}
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`

Expected: "✔ Generated Prisma Client to ./.prisma/client"

**Step 3: Create and run migration**

Run: `npx prisma migrate dev --name add_is_admin_to_user`

When prompted for name, use: `add_is_admin_to_user`

Expected: Migration created and applied to database

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add isAdmin field to User model"
```

---

## Task 2: Create Admin Setup Script

**Files:**
- Create: `scripts/set-admin.mjs`

**Step 1: Create scripts directory if missing**

Run: `mkdir -p scripts`

**Step 2: Write the admin setup script**

Create `scripts/set-admin.mjs`:

```javascript
#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/set-admin.mjs <email>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  try {
    const { data, error } = await supabase
      .from('User')
      .update({ isAdmin: true })
      .eq('email', email)
      .select();

    if (error) {
      console.error('Error updating user:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.error(`User with email "${email}" not found`);
      process.exit(1);
    }

    console.log(`✓ Successfully set ${email} as admin`);
  } catch (err) {
    console.error('Script error:', err.message);
    process.exit(1);
  }
}

setAdmin();
```

**Step 3: Test the script (without executing yet)**

We'll test this after other tasks, but verify file is created:

Run: `test -f scripts/set-admin.mjs && echo "✓ Script file created"`

Expected: "✓ Script file created"

**Step 4: Commit**

```bash
git add scripts/set-admin.mjs
git commit -m "feat: add admin setup script"
```

---

## Task 3: Create Admin Stats API Endpoint

**Files:**
- Create: `app/api/admin/stats/route.js`

**Step 1: Create the stats API route**

Create `app/api/admin/stats/route.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: request.headers.get('authorization') || '' } }
  });

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: userData, error: checkError } = await supabase
      .from('User')
      .select('isAdmin')
      .eq('id', user.id)
      .single();

    if (checkError || !userData?.isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch stats
    const [debatesRes, usersRes, topicsRes] = await Promise.all([
      supabase.from('Debate').select('id', { count: 'exact', head: true }),
      supabase.from('User').select('id', { count: 'exact', head: true }),
      supabase.from('Topic').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    const totalDebates = debatesRes.count || 0;
    const totalUsers = usersRes.count || 0;
    const pendingTopics = topicsRes.count || 0;

    return new Response(JSON.stringify({
      totalDebates,
      totalUsers,
      pendingTopics
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/admin/stats/route.js
git commit -m "feat: add admin stats API endpoint"
```

---

## Task 4: Create Admin Dashboard Page

**Files:**
- Create: `app/admin/dashboard/page.js`

**Step 1: Create the dashboard page**

Create `app/admin/dashboard/page.js`:

```javascript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuthAndFetchStats = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Get session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          router.push('/');
          return;
        }

        setUser(session.user);

        // Fetch stats
        const res = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!res.ok) {
          if (res.status === 403) {
            router.push('/');
            return;
          }
          throw new Error('Failed to fetch stats');
        }

        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchStats();
  }, [router]);

  const handleLogout = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Logged in as: {user?.email}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to App
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Debates Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-gray-600 text-sm font-medium mb-2">Total Debates</h2>
            <p className="text-4xl font-bold text-gray-900">{stats?.totalDebates || 0}</p>
          </div>

          {/* Registered Users Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-gray-600 text-sm font-medium mb-2">Registered Users</h2>
            <p className="text-4xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
          </div>

          {/* Pending Topics Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-gray-600 text-sm font-medium mb-2">Topics Pending Approval</h2>
            <p className="text-4xl font-bold text-gray-900">{stats?.pendingTopics || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/admin/dashboard/page.js
git commit -m "feat: create admin dashboard page with stats display"
```

---

## Task 5: Update Login to Include isAdmin and Handle Redirect

**Files:**
- Modify: `app/api/auth/login/route.js` (return isAdmin flag)
- Modify: `app/components/LoginModal.js` (redirect after login)

**Step 1: Update login API to return isAdmin**

Open `app/api/auth/login/route.js` and find where the session is created/returned. Add `isAdmin` to the user object in the response. The exact location depends on your current code, but the response should include:

```javascript
// After successful authentication, include isAdmin in response
const { data: userData } = await supabase
  .from('User')
  .select('isAdmin')
  .eq('email', email)
  .single();

// Return response with isAdmin included
return Response.json({
  session: {
    // ... existing session data
    user: {
      // ... existing user data
      isAdmin: userData?.isAdmin || false
    }
  }
});
```

**Step 2: Update LoginModal to redirect admins**

Open `app/components/LoginModal.js` and find the login success handler. After receiving the response, add:

```javascript
// After successful login
if (response.session?.user?.isAdmin) {
  router.push('/admin/dashboard');
} else {
  // Existing redirect logic
  router.push('/');
}
```

**Step 3: Test login flow**

- Log in with a non-admin email
- Expected: Redirects to home page `/`
- (After setting admin, test with admin email to verify redirect to `/admin/dashboard`)

**Step 4: Commit**

```bash
git add app/api/auth/login/route.js app/components/LoginModal.js
git commit -m "feat: add isAdmin to login response and redirect admins to dashboard"
```

---

## Task 6: Set Your Email Addresses as Admin

**Files:**
- No new files (using existing script)

**Step 1: Run the admin setup script for first email**

Run: `NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY node scripts/set-admin.mjs adaptivebodydesign@gmail.com`

Expected: "✓ Successfully set adaptivebodydesign@gmail.com as admin"

**Step 2: Run the admin setup script for second email**

Run: `NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY node scripts/set-admin.mjs adaptivebodydesign@protonmail.com`

Expected: "✓ Successfully set adaptivebodydesign@protonmail.com as admin"

**Step 3: Verify in database (optional)**

You can verify in Supabase dashboard that both users now have `isAdmin = true`

---

## Task 7: Test the Full Admin Flow

**Files:**
- No modifications (testing only)

**Step 1: Build and run the app**

Run: `npm run build && npm run start`

Expected: Build succeeds, server starts

**Step 2: Test non-admin login**

- Navigate to home page
- Log in with any non-admin email
- Expected: Redirects to home page, no access to `/admin/dashboard`

**Step 3: Test admin login**

- Log out
- Log in with `adaptivebodydesign@gmail.com`
- Expected: Automatically redirected to `/admin/dashboard`
- Verify stats are displayed correctly

**Step 4: Test direct access attempt**

- Log out completely
- Navigate directly to `/admin/dashboard`
- Expected: Redirects to login or home page

**Step 5: Commit (no code changes, just confirmation)**

All tests passed, ready for merge.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-27-admin-dashboard.md`.

Ready to implement? Choose your approach:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks

**2. Parallel Session (separate)** - You open new session with executing-plans, batch execution

Which approach would you prefer?
