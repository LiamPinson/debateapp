# Admin Dashboard Interactivity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make admin dashboard stat cards clickable with full management pages for debates, members, and topics.

**Architecture:** Create three new management pages (`/admin/debates`, `/admin/members`, and use existing `/admin/topics`) following the same pattern as the Topics Management page. Build API routes for data fetching with pagination, add modals for transcript/activity viewing, and make stat cards clickable.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase, TailwindCSS (existing theme)

---

## Task 1: Create GET /api/admin/debates Route

**Files:**
- Create: `app/api/admin/debates/route.js`

**Step 1: Write the debates route**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debates
 * Returns paginated list of all debates with participants and winner
 * Requires authenticated admin user
 *
 * Query: { userId, page, limit }
 *
 * Returns: { debates: [...], pagination: { page, limit, total, pages } }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check admin status
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, is_admin')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (!user.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // Get total count
    const { count: total, error: countError } = await db
      .from('debates')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to fetch debates count: ${countError.message}`);
    }

    // Get paginated debates with participants
    const offset = (page - 1) * limit;
    const { data: debates, error: debatesError } = await db
      .from('debates')
      .select(`
        id,
        pro_user:pro_user_id(id, username),
        con_user:con_user_id(id, username),
        winner_side,
        transcript,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (debatesError) {
      throw new Error(`Failed to fetch debates: ${debatesError.message}`);
    }

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      debates: debates || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        pages,
      },
    });
  } catch (err) {
    console.error('Admin debates route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the route manually**

In your browser, navigate to (with a valid admin userId):
```
/api/admin/debates?userId=<admin-id>&page=1&limit=50
```

Expected: Returns JSON with debates array and pagination info.

**Step 3: Commit**

```bash
git add app/api/admin/debates/route.js
git commit -m "feat: create GET /api/admin/debates route with pagination"
```

---

## Task 2: Create GET /api/admin/members Route

**Files:**
- Create: `app/api/admin/members/route.js`

**Step 1: Write the members route**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/members
 * Returns paginated list of all registered users
 * Requires authenticated admin user
 *
 * Query: { userId, page, limit }
 *
 * Returns: { users: [...], pagination: { page, limit, total, pages } }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check admin status
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, is_admin')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (!user.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // Get total count
    const { count: total, error: countError } = await db
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to fetch users count: ${countError.message}`);
    }

    // Get paginated users
    const offset = (page - 1) * limit;
    const { data: users, error: usersError } = await db
      .from('users')
      .select('id, username, email, created_at, is_active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        pages,
      },
    });
  } catch (err) {
    console.error('Admin members route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the route**

Navigate to:
```
/api/admin/members?userId=<admin-id>&page=1&limit=50
```

Expected: Returns JSON with users array and pagination info.

**Step 3: Commit**

```bash
git add app/api/admin/members/route.js
git commit -m "feat: create GET /api/admin/members route with pagination"
```

---

## Task 3: Create GET /api/admin/members/:userId/activity Route

**Files:**
- Create: `app/api/admin/members/[userId]/activity/route.js`

**Step 1: Write the activity route**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/members/:userId/activity
 * Returns activity stats for a specific user
 * Requires authenticated admin user
 *
 * Query: { adminUserId }
 *
 * Returns: {
 *   user: { id, username, email, created_at },
 *   activity: { debatesParticipated, topicsSubmitted, topicsApproved, topicsRejected }
 * }
 */
export async function GET(request, { params }) {
  try {
    const { userId } = params;
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'adminUserId required' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check admin status
    const { data: admin, error: adminError } = await db
      .from('users')
      .select('id, is_admin')
      .eq('id', adminUserId)
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (!admin.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // Get user info
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, username, email, created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Count debates participated
    const { count: debatesParticipated, error: debatesError } = await db
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`);

    if (debatesError) {
      throw new Error(`Failed to fetch debates: ${debatesError.message}`);
    }

    // Count topics submitted
    const { count: topicsSubmitted, error: submittedError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', userId);

    if (submittedError) {
      throw new Error(`Failed to fetch submitted topics: ${submittedError.message}`);
    }

    // Count topics approved
    const { count: topicsApproved, error: approvedError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', userId)
      .eq('status', 'approved');

    if (approvedError) {
      throw new Error(`Failed to fetch approved topics: ${approvedError.message}`);
    }

    // Count topics rejected
    const { count: topicsRejected, error: rejectedError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', userId)
      .eq('status', 'rejected');

    if (rejectedError) {
      throw new Error(`Failed to fetch rejected topics: ${rejectedError.message}`);
    }

    return NextResponse.json({
      user,
      activity: {
        debatesParticipated: debatesParticipated || 0,
        topicsSubmitted: topicsSubmitted || 0,
        topicsApproved: topicsApproved || 0,
        topicsRejected: topicsRejected || 0,
      },
    });
  } catch (err) {
    console.error('Admin member activity route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the route**

Navigate to:
```
/api/admin/members/<user-id>/activity?adminUserId=<admin-id>
```

Expected: Returns JSON with user info and activity stats.

**Step 3: Commit**

```bash
git add app/api/admin/members/[userId]/activity/route.js
git commit -m "feat: create GET /api/admin/members/:userId/activity route"
```

---

## Task 4: Create DELETE /api/admin/members/:userId Route

**Files:**
- Create: `app/api/admin/members/[userId]/delete/route.js`

**Step 1: Write the delete route**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/members/:userId
 * Deletes a user account (soft delete via is_active flag)
 * Requires authenticated admin user
 *
 * Query: { adminUserId }
 *
 * Returns: { success: true }
 */
export async function DELETE(request, { params }) {
  try {
    const { userId } = params;
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'adminUserId required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === adminUserId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check admin status
    const { data: admin, error: adminError } = await db
      .from('users')
      .select('id, is_admin')
      .eq('id', adminUserId)
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (!admin.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await db
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Soft delete: set is_active to false
    const { error: updateError } = await db
      .from('users')
      .update({ is_active: false })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to delete user: ${updateError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin delete member route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the route**

Make a DELETE request to:
```
/api/admin/members/<user-id>/delete?adminUserId=<admin-id>
```

Expected: Returns `{ success: true }` and user's `is_active` flag is set to false.

**Step 3: Commit**

```bash
git add app/api/admin/members/[userId]/delete/route.js
git commit -m "feat: create DELETE /api/admin/members/:userId route with soft delete"
```

---

## Task 5: Create /admin/debates Management Page

**Files:**
- Create: `app/admin/debates/page.js`

**Step 1: Write the debates page**

```javascript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import Link from "next/link";

export default function AdminDebatesPage() {
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const [debates, setDebates] = useState([]);
  const [debatesLoading, setDebatesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedTranscript, setSelectedTranscript] = useState(null);

  const LIMIT = 50;

  // Fetch debates
  useEffect(() => {
    if (loading) return;

    if (!user?.id) {
      router.push("/");
      return;
    }

    const fetchDebates = async () => {
      try {
        setDebatesLoading(true);
        setError(null);

        const params = new URLSearchParams({
          userId: user.id,
          page: page.toString(),
          limit: LIMIT.toString(),
        });

        const response = await fetch(`/api/admin/debates?${params}`);

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 403) {
            setError("You do not have admin access to this page.");
            return;
          }
          setError(data.error || "Failed to fetch debates");
          return;
        }

        const data = await response.json();
        setDebates(data.debates || []);
        setPagination(data.pagination || {});
      } catch (err) {
        console.error("Error fetching debates:", err);
        setError("An error occurred while fetching debates");
      } finally {
        setDebatesLoading(false);
      }
    };

    fetchDebates();
  }, [user, loading, router, page]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get winner display
  const getWinnerDisplay = (debate) => {
    if (debate.winner_side === "pro") {
      return `${debate.pro_user?.username || "Unknown"} (Pro)`;
    } else if (debate.winner_side === "con") {
      return `${debate.con_user?.username || "Unknown"} (Con)`;
    }
    return "No Winner";
  };

  // Handle pagination
  const goToPrevious = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const goToNext = () => {
    if (pagination && page < pagination.pages) {
      setPage(page + 1);
    }
  };

  // Show loading state while checking session
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading debates..."
        />
      </div>
    );
  }

  // Redirect non-authenticated users
  if (!user?.id) {
    return null;
  }

  return (
    <main className="min-h-screen bg-arena-bg">
      {/* Header */}
      <div className="border-b border-arena-border bg-arena-surface">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Debates Management</h1>
              <p className="text-sm text-arena-muted">
                View all debates and their transcripts
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/dashboard"
                className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/"
                className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Back to App
              </Link>
              <button
                onClick={() => {
                  logout();
                }}
                className="px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-arena-con/10 border border-arena-con/20 rounded-lg">
            <p className="text-sm text-arena-con">{error}</p>
          </div>
        )}

        {/* Debates List */}
        {debatesLoading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Loading debates..."
            />
          </div>
        ) : debates.length > 0 ? (
          <>
            <div className="space-y-4 mb-8">
              {debates.map((debate) => (
                <div
                  key={debate.id}
                  className="bg-arena-card border border-arena-border rounded-lg p-6"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-sm font-medium text-arena-accent">
                          {debate.pro_user?.username || "Unknown"} (Pro)
                        </span>
                        <span className="text-arena-muted">vs</span>
                        <span className="text-sm font-medium text-arena-pro">
                          {debate.con_user?.username || "Unknown"} (Con)
                        </span>
                      </div>
                      <p className="text-sm text-arena-muted mb-2">
                        Date: {formatDate(debate.created_at)}
                      </p>
                      <p className="text-sm text-arena-text">
                        Winner: <span className="font-medium">{getWinnerDisplay(debate)}</span>
                      </p>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => setSelectedTranscript(debate)}
                      className="px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors whitespace-nowrap"
                    >
                      See Transcript
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPrevious}
                  disabled={page === 1}
                  className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                <p className="text-sm text-arena-muted">
                  Page {page} of {pagination.pages}
                </p>

                <button
                  onClick={goToNext}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-arena-muted">No debates found.</p>
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      {selectedTranscript && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedTranscript(null)}
        >
          <div
            className="bg-arena-surface rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-arena-surface border-b border-arena-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Debate Transcript</h2>
              <button
                onClick={() => setSelectedTranscript(null)}
                className="text-arena-muted hover:text-arena-text"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-arena-muted mb-2">Participants:</p>
                <p className="text-sm font-medium">
                  {selectedTranscript.pro_user?.username || "Unknown"} (Pro) vs{" "}
                  {selectedTranscript.con_user?.username || "Unknown"} (Con)
                </p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-arena-muted mb-2">Date:</p>
                <p className="text-sm font-medium">
                  {formatDate(selectedTranscript.created_at)}
                </p>
              </div>
              <div className="border-t border-arena-border pt-4">
                <p className="text-sm text-arena-muted mb-3">Transcript:</p>
                <div className="bg-arena-bg rounded p-4 text-sm whitespace-pre-wrap text-arena-text">
                  {selectedTranscript.transcript || "No transcript available"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

**Step 2: Test the page**

Navigate to `/admin/debates` and verify:
- List loads with pagination
- Clicking "See Transcript" opens modal
- Modal displays transcript correctly
- Pagination controls work

**Step 3: Commit**

```bash
git add app/admin/debates/page.js
git commit -m "feat: create admin debates management page with transcript modal"
```

---

## Task 6: Create /admin/members Management Page

**Files:**
- Create: `app/admin/members/page.js`

**Step 1: Write the members page**

```javascript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import Link from "next/link";

export default function AdminMembersPage() {
  const router = useRouter();
  const { user, loading, logout } = useSession();
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);

  const LIMIT = 50;

  // Fetch members
  useEffect(() => {
    if (loading) return;

    if (!user?.id) {
      router.push("/");
      return;
    }

    const fetchMembers = async () => {
      try {
        setMembersLoading(true);
        setError(null);

        const params = new URLSearchParams({
          userId: user.id,
          page: page.toString(),
          limit: LIMIT.toString(),
        });

        const response = await fetch(`/api/admin/members?${params}`);

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 403) {
            setError("You do not have admin access to this page.");
            return;
          }
          setError(data.error || "Failed to fetch members");
          return;
        }

        const data = await response.json();
        setMembers(data.users || []);
        setPagination(data.pagination || {});
      } catch (err) {
        console.error("Error fetching members:", err);
        setError("An error occurred while fetching members");
      } finally {
        setMembersLoading(false);
      }
    };

    fetchMembers();
  }, [user, loading, router, page]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fetch user activity
  const handleViewActivity = async (userId) => {
    try {
      setActivityLoading(true);
      setError(null);

      const params = new URLSearchParams({ adminUserId: user.id });
      const response = await fetch(`/api/admin/members/${userId}/activity?${params}`);

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to fetch activity");
        return;
      }

      const data = await response.json();
      setSelectedActivity(data);
    } catch (err) {
      console.error("Error fetching activity:", err);
      setError("An error occurred while fetching activity");
    } finally {
      setActivityLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleteLoading(deleteConfirm.id);
      setError(null);

      const params = new URLSearchParams({ adminUserId: user.id });
      const response = await fetch(
        `/api/admin/members/${deleteConfirm.id}/delete?${params}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete user");
        return;
      }

      // Remove from list
      setMembers((prev) => prev.filter((m) => m.id !== deleteConfirm.id));
      setMessage(`${deleteConfirm.username} has been deleted`);
      setDeleteConfirm(null);

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting user:", err);
      setError("An error occurred while deleting the user");
    } finally {
      setDeleteLoading(null);
    }
  };

  // Handle pagination
  const goToPrevious = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const goToNext = () => {
    if (pagination && page < pagination.pages) {
      setPage(page + 1);
    }
  };

  // Show loading state while checking session
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading members..."
        />
      </div>
    );
  }

  // Redirect non-authenticated users
  if (!user?.id) {
    return null;
  }

  return (
    <main className="min-h-screen bg-arena-bg">
      {/* Header */}
      <div className="border-b border-arena-border bg-arena-surface">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Members Management</h1>
              <p className="text-sm text-arena-muted">
                Manage all registered users
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/dashboard"
                className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/"
                className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Back to App
              </Link>
              <button
                onClick={() => {
                  logout();
                }}
                className="px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Success Message */}
        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-arena-con/10 border border-arena-con/20 rounded-lg">
            <p className="text-sm text-arena-con">{error}</p>
          </div>
        )}

        {/* Members List */}
        {membersLoading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Loading members..."
            />
          </div>
        ) : members.length > 0 ? (
          <>
            <div className="space-y-4 mb-8">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={`bg-arena-card border border-arena-border rounded-lg p-6 ${
                    !member.is_active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-2 text-arena-text">
                        {member.username}
                        {!member.is_active && (
                          <span className="ml-2 text-xs font-medium text-arena-con bg-arena-con/10 px-2 py-1 rounded">
                            DELETED
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-arena-muted mb-2">
                        Email: {member.email}
                      </p>
                      <p className="text-sm text-arena-muted">
                        Joined: {formatDate(member.created_at)}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {member.is_active && (
                        <button
                          onClick={() => handleViewActivity(member.id)}
                          disabled={activityLoading}
                          className="px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {activityLoading ? "..." : "View Activity"}
                        </button>
                      )}
                      {member.is_active && (
                        <button
                          onClick={() => setDeleteConfirm(member)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPrevious}
                  disabled={page === 1}
                  className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                <p className="text-sm text-arena-muted">
                  Page {page} of {pagination.pages}
                </p>

                <button
                  onClick={goToNext}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-arena-muted">No members found.</p>
          </div>
        )}
      </div>

      {/* Activity Modal */}
      {selectedActivity && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedActivity(null)}
        >
          <div
            className="bg-arena-surface rounded-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-arena-border p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">User Activity</h2>
              <button
                onClick={() => setSelectedActivity(null)}
                className="text-arena-muted hover:text-arena-text"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-arena-muted mb-1">User:</p>
                <p className="text-sm font-medium">
                  {selectedActivity.user.username}
                </p>
              </div>
              <div>
                <p className="text-sm text-arena-muted mb-1">Email:</p>
                <p className="text-sm font-medium">{selectedActivity.user.email}</p>
              </div>
              <div className="border-t border-arena-border pt-4">
                <p className="text-sm font-medium text-arena-accent mb-3">Activity:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-arena-muted">Debates Participated:</span>
                    <span className="font-medium">
                      {selectedActivity.activity.debatesParticipated}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-arena-muted">Topics Submitted:</span>
                    <span className="font-medium">
                      {selectedActivity.activity.topicsSubmitted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-arena-muted">Topics Approved:</span>
                    <span className="font-medium text-green-600">
                      {selectedActivity.activity.topicsApproved}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-arena-muted">Topics Rejected:</span>
                    <span className="font-medium text-arena-con">
                      {selectedActivity.activity.topicsRejected}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-arena-surface rounded-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">Delete User?</h2>
              <p className="text-sm text-arena-muted mb-6">
                Are you sure you want to delete{" "}
                <span className="font-medium">{deleteConfirm.username}</span>? This
                action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleteLoading === deleteConfirm.id}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading === deleteConfirm.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

**Step 2: Test the page**

Navigate to `/admin/members` and verify:
- List loads with pagination
- Clicking "View Activity" opens modal with stats
- Clicking "Delete" shows confirmation dialog
- Deleting removes user from list and shows success message
- Pagination controls work

**Step 3: Commit**

```bash
git add app/admin/members/page.js
git commit -m "feat: create admin members management page with activity and delete modals"
```

---

## Task 7: Make Dashboard Stat Cards Clickable

**Files:**
- Modify: `app/admin/dashboard/page.js:125-208`

**Step 1: Update the stat cards to be clickable buttons**

Replace the three stat card divs with button elements that navigate to the management pages:

```javascript
// Find the existing stat cards section (around line 124) and replace with:

{statsLoading ? (
  <div className="flex items-center justify-center py-20">
    <div
      className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin"
      role="status"
      aria-label="Loading stats..."
    />
  </div>
) : stats ? (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
    {/* Total Debates Card */}
    <Link
      href="/admin/debates"
      className="bg-arena-card border border-arena-border rounded-xl p-8 hover:border-arena-accent/50 transition-colors cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-arena-muted mb-2">Total Debates</p>
          <p className="text-4xl font-bold text-arena-accent group-hover:scale-105 transition-transform">
            {stats.totalDebates}
          </p>
        </div>
        <div className="w-12 h-12 bg-arena-accent/10 text-arena-accent rounded-full flex items-center justify-center group-hover:bg-arena-accent/20 transition-colors" aria-hidden="true">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </Link>

    {/* Registered Users Card */}
    <Link
      href="/admin/members"
      className="bg-arena-card border border-arena-border rounded-xl p-8 hover:border-arena-pro/50 transition-colors cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-arena-muted mb-2">
            Registered Users
          </p>
          <p className="text-4xl font-bold text-arena-pro group-hover:scale-105 transition-transform">
            {stats.totalUsers}
          </p>
        </div>
        <div className="w-12 h-12 bg-arena-pro/10 text-arena-pro rounded-full flex items-center justify-center group-hover:bg-arena-pro/20 transition-colors" aria-hidden="true">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6.5 20H12v-2a3 3 0 00-3-3H4a3 3 0 00-3 3v2h7.5z"
            />
          </svg>
        </div>
      </div>
    </Link>

    {/* Topics Pending Approval Card */}
    <Link
      href="/admin/topics"
      className="bg-arena-card border border-arena-border rounded-xl p-8 hover:border-arena-con/50 transition-colors cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-arena-muted mb-2">
            Topics Pending Approval
          </p>
          <p className="text-4xl font-bold text-arena-con group-hover:scale-105 transition-transform">
            {stats.pendingTopics}
          </p>
        </div>
        <div className="w-12 h-12 bg-arena-con/10 text-arena-con rounded-full flex items-center justify-center group-hover:bg-arena-con/20 transition-colors" aria-hidden="true">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </Link>
  </div>
) : null}
```

**Step 2: Test the dashboard**

Navigate to `/admin/dashboard` and verify:
- All three cards display correctly
- Clicking the Debates card navigates to `/admin/debates`
- Clicking the Members card navigates to `/admin/members`
- Clicking the Topics card navigates to `/admin/topics`
- Hover states show visual feedback (border color change, scale)

**Step 3: Commit**

```bash
git add app/admin/dashboard/page.js
git commit -m "feat: make admin dashboard stat cards clickable with navigation links"
```

---

## Task 8: Final Testing & Verification

**Step 1: Manual testing of entire flow**

1. Log in as admin and navigate to `/admin/dashboard`
2. Click each stat card and verify correct page loads
3. On `/admin/debates`:
   - Verify debates list loads
   - Click "See Transcript" and verify modal shows
   - Test pagination
4. On `/admin/members`:
   - Verify members list loads
   - Click "View Activity" and verify modal shows activity stats
   - Click "Delete" and verify confirmation dialog appears
   - Confirm deletion and verify member removed from list
5. On `/admin/topics` (existing page):
   - Verify it still works as before
   - Verify can navigate back from dashboard

**Step 2: Check for errors**

Run the application and check:
- Browser console for any JavaScript errors
- Network tab for failed API calls
- All loading states appear/disappear correctly

**Step 3: Commit final verification**

```bash
git status
# Should show clean working directory
git log --oneline -n 8
# Should show all your feature commits
```

**Step 4: Create final summary commit**

```bash
git commit --allow-empty -m "feat: complete admin dashboard interactivity feature

- Made stat cards clickable with navigation links
- Created debates management page with transcript viewing
- Created members management page with activity and delete functions
- Updated API routes for debates, members, and user activity
- All management pages follow existing design patterns
- Added confirmation dialogs for destructive actions
- Implemented soft delete for user accounts"
```

---

## Architecture Summary

```
Admin Dashboard (main page)
├── Stat Cards (now clickable Links)
│   ├── Debates → /admin/debates
│   ├── Members → /admin/members
│   └── Topics → /admin/topics (existing)
│
Debates Management Page
├── Debates List (paginated)
│   ├── Date, Participants, Winner
│   └── See Transcript button
│       └── Transcript Modal
│
Members Management Page
├── Members List (paginated)
│   ├── Username, Email, Registration Date
│   ├── View Activity button
│   │   └── Activity Modal
│   └── Delete button
│       └── Delete Confirmation Modal
│
API Routes
├── /api/admin/debates (GET)
├── /api/admin/members (GET)
├── /api/admin/members/:userId/activity (GET)
└── /api/admin/members/:userId/delete (DELETE)
```

---

Plan complete and saved to `docs/plans/2026-03-01-admin-dashboard-interactivity.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you prefer?**