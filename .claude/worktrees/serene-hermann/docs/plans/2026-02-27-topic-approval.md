# Topic Approval Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build an admin interface to review, approve, and reject user-submitted debate topics, with approved topics automatically appearing publicly.

**Architecture:** Create three API endpoints (fetch topics with pagination, approve, reject) and a new admin topics page with tabs for pending/approved/rejected topics. Uses existing database schema without modifications.

**Tech Stack:** Next.js API routes, Supabase, React, Tailwind CSS

---

## Task 1: Create Topics Fetch API Endpoint

**Files:**
- Create: `app/api/admin/topics/route.js`

**Step 1: Create the API route with admin authentication**

Create `app/api/admin/topics/route.js`:

```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 50;

  try {
    // Get authenticated user
    const userId = searchParams.get('userId');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check admin status
    const { data: userData, error: userError } = await createServiceClient()
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (userError || !userData?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Fetch total count
    const { count: totalCount } = await createServiceClient()
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);

    // Fetch topics with user info
    const { data: topics, error: topicsError } = await createServiceClient()
      .from('custom_topics')
      .select(`
        id,
        headline,
        description,
        status,
        created_at,
        approved_at,
        approved_by_user_id,
        user_id
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (topicsError) {
      throw topicsError;
    }

    // Fetch user info for each topic
    const topicsWithUsers = await Promise.all(
      topics.map(async (topic) => {
        const { data: user } = await createServiceClient()
          .from('users')
          .select('username, email')
          .eq('id', topic.user_id)
          .single();

        return {
          ...topic,
          submitted_by: {
            username: user?.username || 'Unknown',
            email: user?.email || 'Unknown'
          }
        };
      })
    );

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return new Response(JSON.stringify({
      topics: topicsWithUsers,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: totalPages
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Topics API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Step 2: Test the endpoint**

Test by visiting: `http://localhost:3000/api/admin/topics?userId=YOUR_ADMIN_ID&status=pending&page=1&limit=50`

Expected: JSON response with topics array and pagination metadata

**Step 3: Commit**

```bash
git add app/api/admin/topics/route.js
git commit -m "feat: create admin topics fetch API endpoint"
```

---

## Task 2: Create Approve Topic API Endpoint

**Files:**
- Create: `app/api/admin/topics/[id]/approve/route.js`

**Step 1: Create the approve endpoint**

Create `app/api/admin/topics/[id]/approve/route.js`:

```javascript
export async function POST(request, { params }) {
  const { id } = params;
  const { userId } = await request.json().catch(() => ({}));

  try {
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check admin status
    const { data: userData, error: userError } = await createServiceClient()
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (userError || !userData?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if topic exists and is pending
    const { data: topic, error: checkError } = await createServiceClient()
      .from('custom_topics')
      .select('id, status')
      .eq('id', id)
      .single();

    if (checkError || !topic) {
      return new Response(JSON.stringify({ error: 'Topic not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (topic.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Topic is already ${topic.status}` }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Approve the topic
    const { data: updated, error: updateError } = await createServiceClient()
      .from('custom_topics')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by_user_id: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, topic: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Approve topic error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Step 2: Test the endpoint**

Test by posting to: `http://localhost:3000/api/admin/topics/TOPIC_ID/approve`
Body: `{ "userId": "YOUR_ADMIN_ID" }`

Expected: Returns updated topic with status='approved'

**Step 3: Commit**

```bash
git add app/api/admin/topics/[id]/approve/route.js
git commit -m "feat: create approve topic endpoint"
```

---

## Task 3: Create Reject Topic API Endpoint

**Files:**
- Create: `app/api/admin/topics/[id]/reject/route.js`

**Step 1: Create the reject endpoint**

Create `app/api/admin/topics/[id]/reject/route.js`:

```javascript
export async function POST(request, { params }) {
  const { id } = params;
  const { userId } = await request.json().catch(() => ({}));

  try {
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check admin status
    const { data: userData, error: userError } = await createServiceClient()
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (userError || !userData?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if topic exists
    const { data: topic, error: checkError } = await createServiceClient()
      .from('custom_topics')
      .select('id, status')
      .eq('id', id)
      .single();

    if (checkError || !topic) {
      return new Response(JSON.stringify({ error: 'Topic not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (topic.status === 'rejected') {
      return new Response(JSON.stringify({ error: 'Topic is already rejected' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Reject the topic
    const { data: updated, error: updateError } = await createServiceClient()
      .from('custom_topics')
      .update({
        status: 'rejected'
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, topic: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Reject topic error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Step 2: Test the endpoint**

Test by posting to: `http://localhost:3000/api/admin/topics/TOPIC_ID/reject`
Body: `{ "userId": "YOUR_ADMIN_ID" }`

Expected: Returns updated topic with status='rejected'

**Step 3: Commit**

```bash
git add app/api/admin/topics/[id]/reject/route.js
git commit -m "feat: create reject topic endpoint"
```

---

## Task 4: Create Admin Topics Page Component

**Files:**
- Create: `app/admin/topics/page.js`

**Step 1: Create the topics management page**

Create `app/admin/topics/page.js`:

```javascript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function AdminTopicsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pending');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [message, setMessage] = useState(null);

  const limit = 50;

  useEffect(() => {
    const checkAuthAndFetchTopics = async () => {
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

        // Fetch topics
        const params = new URLSearchParams({
          userId: session.user.id,
          status: activeTab,
          page,
          limit
        });

        const res = await fetch(`/api/admin/topics?${params}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!res.ok) {
          if (res.status === 403) {
            router.push('/');
            return;
          }
          throw new Error('Failed to fetch topics');
        }

        const data = await res.json();
        setTopics(data.topics || []);
        setPagination(data.pagination);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchTopics();
  }, [activeTab, page, router]);

  const handleApprove = async (topicId) => {
    if (!user) return;

    try {
      setMessage(null);
      const res = await fetch(`/api/admin/topics/${topicId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to approve topic');
      }

      setMessage({ type: 'success', text: 'Topic approved!' });
      setTopics(topics.filter(t => t.id !== topicId));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleReject = async (topicId) => {
    if (!user) return;

    try {
      setMessage(null);
      const res = await fetch(`/api/admin/topics/${topicId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to reject topic');
      }

      setMessage({ type: 'success', text: 'Topic rejected!' });
      setTopics(topics.filter(t => t.id !== topicId));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading topics...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Topic Management</h1>
        <p className="text-gray-600">Review and approve user-submitted debate topics</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b">
        {['pending', 'approved', 'rejected'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
              setMessage(null);
            }}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({pagination?.total || 0})
          </button>
        ))}
      </div>

      {/* Topics List */}
      {topics.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No {activeTab} topics found
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => (
            <div key={topic.id} className="border rounded-lg p-6 bg-white shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{topic.headline}</h3>
                  <p className="text-gray-700 mb-3 line-clamp-3">{topic.description}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Submitted by:</strong> {topic.submitted_by.username} ({topic.submitted_by.email})
                    </p>
                    <p>
                      <strong>Submitted on:</strong> {new Date(topic.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {activeTab === 'pending' && (
                <div className="flex gap-4 pt-4 border-t">
                  <button
                    onClick={() => handleApprove(topic.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(topic.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center gap-4 mt-8 pt-8 border-t">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.pages, page + 1))}
            disabled={page === pagination.pages}
            className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Test the page**

Visit: `http://localhost:3000/admin/topics` (as admin user)

Expected: See pending topics with approve/reject buttons

**Step 3: Commit**

```bash
git add app/admin/topics/page.js
git commit -m "feat: create admin topic management page"
```

---

## Task 5: Test Full Workflow

**Files:**
- No new files (testing only)

**Step 1: Manual testing**

1. Log in as admin user
2. Navigate to `/admin/topics`
3. Should see pending topics with pagination
4. Click "Approve" on a topic
5. Topic should disappear from pending list
6. Approved topic should now appear on public `/topics` page
7. Click "Rejected" tab, should be empty
8. Go back to "Pending" tab, approve another
9. Click "Rejected" tab to see rejected topics

**Step 2: Verify public visibility**

1. Open `/topics` page (public)
2. Approved topics from admin dashboard should appear here
3. Pending/rejected topics should NOT appear

**Step 3: Commit (no code changes)**

All tests passed, workflow complete.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-27-topic-approval.md`.

Ready to implement? Choose your approach:

**1. Subagent-Driven (this session)** - Fresh subagent per task, review between tasks

**2. Parallel Session (separate)** - Open new session with executing-plans

Which approach would you prefer?
