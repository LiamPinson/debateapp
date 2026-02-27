# Custom Topic Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable registered users to create persistent custom debate topics with owner approval workflow, per-topic notification preferences, and rate limiting.

**Architecture:** Custom topics are stored in a new `custom_topics` table with approval workflow via email links. Approved topics appear in a separate "User Submitted" section alongside "House Select Topics" and join the matchmaking queue. Notifications are sent when creators' topics are approved or when participants join their custom topics.

**Tech Stack:** Next.js 14 (API routes), Supabase Postgres, Resend email, JWT tokens for email links

---

## Task 1: Create Database Migration for Custom Topics

**Files:**
- Create: `supabase/migrations/20260226000000_create_custom_topics_table.sql`
- Modify: `supabase/schema.sql`

**Step 1: Write the migration file**

Create the migration file at `supabase/migrations/20260226000000_create_custom_topics_table.sql`:

```sql
-- Create custom_topics table
CREATE TABLE IF NOT EXISTS custom_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  notification_preference TEXT NOT NULL DEFAULT 'both'
    CHECK (notification_preference IN ('email', 'in_app', 'both')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by_email TEXT,
  CONSTRAINT headline_word_count CHECK (
    array_length(string_to_array(trim(headline), ' '), 1) <= 20
  ),
  CONSTRAINT description_word_count CHECK (
    array_length(string_to_array(trim(description), ' '), 1) <= 150
  ),
  CONSTRAINT non_empty_headline CHECK (trim(headline) != ''),
  CONSTRAINT non_empty_description CHECK (trim(description) != '')
);

-- Create indexes for common queries
CREATE INDEX idx_custom_topics_user_id ON custom_topics(user_id);
CREATE INDEX idx_custom_topics_status ON custom_topics(status);
CREATE INDEX idx_custom_topics_status_created ON custom_topics(status, created_at DESC);
CREATE INDEX idx_custom_topics_user_created ON custom_topics(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE custom_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own pending/approved topics
CREATE POLICY "users_view_own_topics" ON custom_topics
  FOR SELECT USING (
    (auth.uid()::text = user_id::text) OR (status = 'approved')
  );

-- RLS Policy: Only authenticated users can insert
CREATE POLICY "users_create_topics" ON custom_topics
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text
  );

-- RLS Policy: Only service role can update (for approval)
-- (This will be handled via service client in API routes)
```

**Step 2: Add custom_topic_id foreign key to debates table**

Append to migration file:

```sql
-- Add custom_topic_id to debates table to link debates to custom topics
ALTER TABLE IF EXISTS debates
ADD COLUMN IF NOT EXISTS custom_topic_id UUID REFERENCES custom_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debates_custom_topic ON debates(custom_topic_id);
```

**Step 3: Verify migration is syntactically correct**

Run in Supabase SQL Editor to test:
```
Check that no syntax errors occur and tables are created
```

**Step 4: Update schema.sql to include new table**

Add to `supabase/schema.sql` after the topics table definition (around line 68):

```sql
-- ============================================================
-- 3.5 CUSTOM TOPICS (user-submitted debate topics)
-- ============================================================
CREATE TABLE custom_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  notification_preference TEXT NOT NULL DEFAULT 'both'
    CHECK (notification_preference IN ('email', 'in_app', 'both')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by_email TEXT,
  CONSTRAINT headline_word_count CHECK (
    array_length(string_to_array(trim(headline), ' '), 1) <= 20
  ),
  CONSTRAINT description_word_count CHECK (
    array_length(string_to_array(trim(description), ' '), 1) <= 150
  ),
  CONSTRAINT non_empty_headline CHECK (trim(headline) != ''),
  CONSTRAINT non_empty_description CHECK (trim(description) != '')
);

CREATE INDEX idx_custom_topics_user_id ON custom_topics(user_id);
CREATE INDEX idx_custom_topics_status ON custom_topics(status);
CREATE INDEX idx_custom_topics_status_created ON custom_topics(status, created_at DESC);
CREATE INDEX idx_custom_topics_user_created ON custom_topics(user_id, created_at DESC);

ALTER TABLE custom_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_topics" ON custom_topics
  FOR SELECT USING (
    (auth.uid()::text = user_id::text) OR (status = 'approved')
  );

CREATE POLICY "users_create_topics" ON custom_topics
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text
  );

-- Modify debates table to add custom_topic_id (add after topic_id line)
-- ALTER TABLE debates ADD COLUMN custom_topic_id UUID REFERENCES custom_topics(id) ON DELETE SET NULL;
-- CREATE INDEX idx_debates_custom_topic ON debates(custom_topic_id);
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260226000000_create_custom_topics_table.sql supabase/schema.sql
git commit -m "feat: add custom_topics table and debates.custom_topic_id column"
```

---

## Task 2: Create Email Utility Module

**Files:**
- Create: `lib/email.js`

**Step 1: Write the email utility**

```javascript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@debatearena.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Send email to owner when new custom topic is submitted
 */
export async function sendTopicSubmissionEmail(topicHeadline, approveToken, rejectToken) {
  const approveUrl = `${APP_URL}/api/custom-topics/approve?token=${approveToken}`;
  const rejectUrl = `${APP_URL}/api/custom-topics/reject?token=${rejectToken}`;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Topic submission: "${topicHeadline}"`);
    console.log(`[DEV] Approve: ${approveUrl}`);
    console.log(`[DEV] Reject: ${rejectUrl}`);
    return { success: true };
  }

  return resend.emails.send({
    from: 'Debate Arena <noreply@debatearena.com>',
    to: OWNER_EMAIL,
    subject: `New custom debate topic submitted: "${topicHeadline}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">New Custom Topic Submitted</h2>
        <p style="color:#666;margin-bottom:24px">
          A user has submitted a new debate topic for approval.
        </p>

        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0 0 8px 0;font-weight:600">${topicHeadline}</p>
        </div>

        <p style="color:#666;margin-bottom:16px">
          Review and approve or reject this topic:
        </p>

        <div style="display:flex;gap:12px;margin-bottom:24px">
          <a href="${approveUrl}"
             style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Approve Topic
          </a>
          <a href="${rejectUrl}"
             style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Reject Topic
          </a>
        </div>

        <p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #ddd;padding-top:16px">
          Links expire in 15 minutes.
        </p>
      </div>
    `,
  });
}

/**
 * Send email to topic creator when topic is approved
 */
export async function sendTopicApprovedEmail(creatorEmail, topicHeadline) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Topic approved email to ${creatorEmail}: "${topicHeadline}"`);
    return { success: true };
  }

  return resend.emails.send({
    from: 'Debate Arena <noreply@debatearena.com>',
    to: creatorEmail,
    subject: `Your debate topic is now live!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Topic Approved! 🎉</h2>
        <p style="color:#666;margin-bottom:16px">
          Your custom debate topic has been approved and is now live:
        </p>

        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-weight:600">${topicHeadline}</p>
        </div>

        <p style="color:#666;margin-bottom:16px">
          Users can now debate on your topic. You'll receive notifications when participants join.
        </p>

        <a href="${APP_URL}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          View Topics
        </a>

        <p style="color:#999;font-size:12px;margin-top:24px">
          Thanks for contributing to the community!
        </p>
      </div>
    `,
  });
}

/**
 * Send notification when someone joins a custom topic debate
 */
export async function sendTopicJoinedEmail(creatorEmail, topicHeadline, participantUsername) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Topic joined email to ${creatorEmail}: ${participantUsername} joined "${topicHeadline}"`);
    return { success: true };
  }

  return resend.emails.send({
    from: 'Debate Arena <noreply@debatearena.com>',
    to: creatorEmail,
    subject: `Someone joined your debate topic!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Topic Activity</h2>
        <p style="color:#666;margin-bottom:16px">
          <strong>${participantUsername}</strong> is now debating on your custom topic:
        </p>

        <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-weight:600">${topicHeadline}</p>
        </div>

        <a href="${APP_URL}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          View Debate
        </a>

        <p style="color:#999;font-size:12px;margin-top:24px">
          You can manage notification settings in your account.
        </p>
      </div>
    `,
  });
}
```

**Step 2: Commit**

```bash
git add lib/email.js
git commit -m "feat: add email utility functions"
```

---

## Task 3: Create Token Utility Module for Email Links

**Files:**
- Create: `lib/tokens.js`

**Step 1: Write the token utility**

```javascript
import { jwtVerify, SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-key');

/**
 * Create a time-limited JWT token for email links
 * Token expires in 15 minutes
 */
export async function createApprovalToken(topicId) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60; // 15 minutes

  const token = await new SignJWT({ topicId, action: 'approve' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return token;
}

/**
 * Create a time-limited JWT token for rejection
 * Token expires in 15 minutes
 */
export async function createRejectionToken(topicId) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60; // 15 minutes

  const token = await new SignJWT({ topicId, action: 'reject' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return token;
}

/**
 * Verify a token and extract payload
 */
export async function verifyToken(token) {
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload;
  } catch (error) {
    return null;
  }
}
```

**Step 2: Update package.json to add jose for JWT**

Check if jose is installed:
```bash
grep "jose" /Users/l/Desktop/debate-app/.claude/worktrees/naughty-noether/package.json
```

If not present, add to dependencies:
```bash
npm install jose
```

**Step 3: Commit**

```bash
git add lib/tokens.js package.json package-lock.json
git commit -m "feat: add JWT token utilities for email approval links"
```

---

## Task 4: Create POST /api/custom-topics/create Endpoint

**Files:**
- Create: `app/api/custom-topics/create/route.js`

**Step 1: Write the endpoint**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendTopicSubmissionEmail } from '@/lib/email';
import { createApprovalToken, createRejectionToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-topics/create
 * Create a new custom debate topic submission
 *
 * Body: {
 *   headline: string (max 20 words),
 *   description: string (max 150 words),
 *   notificationPreference: 'email' | 'in_app' | 'both'
 * }
 *
 * Returns: { success: true, message: "..." }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { headline, description, notificationPreference } = body;

    // Validate inputs
    if (!headline || !description || !notificationPreference) {
      return NextResponse.json(
        { error: 'headline, description, and notificationPreference required' },
        { status: 400 }
      );
    }

    // Validate headline word count
    const headlineWords = headline.trim().split(/\s+/).length;
    if (headlineWords > 20) {
      return NextResponse.json(
        { error: `Headline must be 20 words or fewer (${headlineWords} provided)` },
        { status: 400 }
      );
    }

    if (headlineWords === 0) {
      return NextResponse.json(
        { error: 'Headline cannot be empty' },
        { status: 400 }
      );
    }

    // Validate description word count
    const descriptionWords = description.trim().split(/\s+/).length;
    if (descriptionWords > 150) {
      return NextResponse.json(
        { error: `Description must be 150 words or fewer (${descriptionWords} provided)` },
        { status: 400 }
      );
    }

    // Validate notification preference
    if (!['email', 'in_app', 'both'].includes(notificationPreference)) {
      return NextResponse.json(
        { error: 'Invalid notification preference' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Get authenticated user from request header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await db.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check rate limiting: max 1 topic per user per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTopics, error: checkError } = await db
      .from('custom_topics')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1);

    if (checkError) {
      console.error('Rate limit check failed:', checkError);
      return NextResponse.json(
        { error: 'Failed to validate submission' },
        { status: 500 }
      );
    }

    if (recentTopics && recentTopics.length > 0) {
      return NextResponse.json(
        { error: 'You can only create one topic per day. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    // Create custom topic submission
    const { data: topic, error: insertError } = await db
      .from('custom_topics')
      .insert({
        user_id: user.id,
        headline,
        description,
        notification_preference: notificationPreference,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Topic creation failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to create topic submission' },
        { status: 500 }
      );
    }

    // Generate approval/rejection tokens
    const approveToken = await createApprovalToken(topic.id);
    const rejectToken = await createRejectionToken(topic.id);

    // Send email to owner
    try {
      await sendTopicSubmissionEmail(headline, approveToken, rejectToken);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the submission if email fails in dev
      if (process.env.NODE_ENV !== 'development') {
        throw emailError;
      }
    }

    return NextResponse.json(
      { success: true, message: 'Submission received, check back soon' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Custom topic creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/custom-topics/create/route.js
git commit -m "feat: add POST /api/custom-topics/create endpoint with rate limiting"
```

---

## Task 5: Create POST /api/custom-topics/approve Endpoint

**Files:**
- Create: `app/api/custom-topics/approve/route.js`

**Step 1: Write the endpoint**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendTopicApprovedEmail } from '@/lib/email';
import { verifyToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-topics/approve
 * Owner approves a custom topic via email link
 *
 * Query: { token: jwt_token }
 *
 * Returns: { success: true, message: "..." }
 */
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Approval token required' },
        { status: 400 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload || payload.action !== 'approve') {
      return NextResponse.json(
        { error: 'Invalid or expired approval link' },
        { status: 400 }
      );
    }

    const topicId = payload.topicId;
    const db = createServiceClient();

    // Get topic
    const { data: topic, error: selectError } = await db
      .from('custom_topics')
      .select('id, headline, user_id')
      .eq('id', topicId)
      .single();

    if (selectError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    if (topic.status !== 'pending') {
      return NextResponse.json(
        { error: 'Topic has already been processed' },
        { status: 400 }
      );
    }

    // Approve topic
    const { error: updateError } = await db
      .from('custom_topics')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by_email: process.env.OWNER_EMAIL || 'owner@debatearena.com',
      })
      .eq('id', topicId);

    if (updateError) {
      console.error('Topic approval failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve topic' },
        { status: 500 }
      );
    }

    // Get creator email
    const { data: { users }, error: userError } = await db.auth.admin.listUsers();
    const creator = users.find(u => u.id === topic.user_id);

    if (creator && creator.email) {
      try {
        await sendTopicApprovedEmail(creator.email, topic.headline);
      } catch (emailError) {
        console.error('Failed to send approval email to creator:', emailError);
        // Don't fail the approval if email fails
      }
    }

    return NextResponse.json(
      { success: true, message: 'Topic approved and published!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Topic approval error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/custom-topics/approve/route.js
git commit -m "feat: add POST /api/custom-topics/approve endpoint"
```

---

## Task 6: Create POST /api/custom-topics/reject Endpoint

**Files:**
- Create: `app/api/custom-topics/reject/route.js`

**Step 1: Write the endpoint**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-topics/reject
 * Owner rejects a custom topic via email link
 *
 * Query: { token: jwt_token }
 *
 * Returns: { success: true, message: "..." }
 */
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Rejection token required' },
        { status: 400 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload || payload.action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid or expired rejection link' },
        { status: 400 }
      );
    }

    const topicId = payload.topicId;
    const db = createServiceClient();

    // Get topic
    const { data: topic, error: selectError } = await db
      .from('custom_topics')
      .select('id, status')
      .eq('id', topicId)
      .single();

    if (selectError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    if (topic.status !== 'pending') {
      return NextResponse.json(
        { error: 'Topic has already been processed' },
        { status: 400 }
      );
    }

    // Reject topic
    const { error: updateError } = await db
      .from('custom_topics')
      .update({
        status: 'rejected',
        approved_at: new Date().toISOString(), // Track when decision was made
      })
      .eq('id', topicId);

    if (updateError) {
      console.error('Topic rejection failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject topic' },
        { status: 500 }
      );
    }

    // No email sent to creator on rejection
    return NextResponse.json(
      { success: true, message: 'Topic rejected' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Topic rejection error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/custom-topics/reject/route.js
git commit -m "feat: add POST /api/custom-topics/reject endpoint"
```

---

## Task 7: Create GET /api/custom-topics/approved Endpoint

**Files:**
- Create: `app/api/custom-topics/approved/route.js`

**Step 1: Write the endpoint**

```javascript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/custom-topics/approved
 * Get all approved custom topics (for topics page)
 *
 * Returns: { topics: [ { id, headline, description, createdAt } ] }
 */
export async function GET() {
  try {
    const db = createServiceClient();

    const { data: topics, error } = await db
      .from('custom_topics')
      .select('id, headline, description, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch approved custom topics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch topics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      topics: (topics || []).map(t => ({
        id: t.id,
        headline: t.headline,
        description: t.description,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Approved topics fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/custom-topics/approved/route.js
git commit -m "feat: add GET /api/custom-topics/approved endpoint"
```

---

## Task 8: Create Topic Creation Modal Component

**Files:**
- Create: `components/CustomTopicModal.jsx`

**Step 1: Write the modal component**

```javascript
'use client';

import { useState } from 'react';

export function CustomTopicModal({ isOpen, onClose, onSuccess, isSignedIn }) {
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [notificationPref, setNotificationPref] = useState('both');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headlineWords = headline.trim().split(/\s+/).filter(w => w).length;
  const descriptionWords = description.trim().split(/\s+/).filter(w => w).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('debate_auth_token');
      const response = await fetch('/api/custom-topics/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          headline,
          description,
          notificationPreference: notificationPref,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to submit topic');
        return;
      }

      // Success
      setHeadline('');
      setDescription('');
      setNotificationPref('both');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Guest unlock modal
  if (!isSignedIn) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
          <h2 className="text-2xl font-bold mb-4">Unlock This Feature</h2>
          <p className="text-gray-600 mb-6">
            Create a free account to submit your own debate topics and receive notifications when users join.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Navigate to signup
                window.location.href = '/signup';
              }}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Topic creation modal for signed-in users
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2">Create a Custom Debate Topic</h2>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6 text-sm text-yellow-800">
          <p>
            <strong>All topics are manually reviewed.</strong> Users may be deactivated for distasteful submissions at the owner's discretion.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Headline */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Headline Question <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g., Should AI be regulated by governments?"
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Max 20 words</span>
              <span>{headlineWords}/20 words</span>
            </div>
            {headlineWords > 20 && (
              <p className="text-red-600 text-sm mt-1">Headline exceeds 20 words</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              More Info <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Be specific and concise about what aspects of the topic you'd like debaters to focus on.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Focus on balancing innovation with public safety. Consider global coordination challenges."
              rows={5}
              maxLength={1500}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Max 150 words</span>
              <span>{descriptionWords}/150 words</span>
            </div>
            {descriptionWords > 150 && (
              <p className="text-red-600 text-sm mt-1">Description exceeds 150 words</p>
            )}
          </div>

          {/* Notification Preference */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              Notifications <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-3">
              How should we notify you when someone joins your debate?
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                     onClick={() => setNotificationPref('email')}>
                <input
                  type="radio"
                  name="notification"
                  value="email"
                  checked={notificationPref === 'email'}
                  onChange={(e) => setNotificationPref(e.target.value)}
                />
                <span className="font-medium">Email only</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                     onClick={() => setNotificationPref('in_app')}>
                <input
                  type="radio"
                  name="notification"
                  value="in_app"
                  checked={notificationPref === 'in_app'}
                  onChange={(e) => setNotificationPref(e.target.value)}
                />
                <span className="font-medium">In-app only</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-indigo-300 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100"
                     onClick={() => setNotificationPref('both')}>
                <input
                  type="radio"
                  name="notification"
                  value="both"
                  checked={notificationPref === 'both'}
                  onChange={(e) => setNotificationPref(e.target.value)}
                />
                <span className="font-medium">Both email and in-app (Recommended)</span>
              </label>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !headline.trim() ||
                !description.trim() ||
                headlineWords > 20 ||
                descriptionWords > 150
              }
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/CustomTopicModal.jsx
git commit -m "feat: add CustomTopicModal component for topic creation"
```

---

## Task 9: Integrate Modal into Topics Page

**Files:**
- Modify: `app/topics/page.jsx` (or wherever the topics page is)

**Step 1: Read the existing topics page to understand its structure**

Run: `find /Users/l/Desktop/debate-app/.claude/worktrees/naughty-noether -name "*topics*" -o -name "*Topics*" | grep -E "\.(jsx?|tsx?)$"`

**Step 2: Update the page to include modal and "User Submitted" section**

Add imports at top:
```javascript
import { useState } from 'react';
import { CustomTopicModal } from '@/components/CustomTopicModal';
import { useSession } from '@/lib/SessionContext';
```

Add state in component:
```javascript
const [customTopicModalOpen, setCustomTopicModalOpen] = useState(false);
const [customTopics, setCustomTopics] = useState([]);
const { user } = useSession();

useEffect(() => {
  // Fetch approved custom topics
  fetch('/api/custom-topics/approved')
    .then(r => r.json())
    .then(data => setCustomTopics(data.topics || []))
    .catch(err => console.error('Failed to fetch custom topics:', err));
}, []);
```

Add button before official topics:
```javascript
<button
  onClick={() => setCustomTopicModalOpen(true)}
  className="w-full mb-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
>
  + Create Custom Topic
</button>
```

Add custom topics section:
```javascript
{customTopics.length > 0 && (
  <div className="mb-8">
    <h2 className="text-xl font-bold mb-4">User Submitted</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {customTopics.map(topic => (
        <div key={topic.id} className="p-4 border border-gray-300 rounded-lg hover:border-indigo-500 cursor-pointer">
          <h3 className="font-semibold text-lg mb-2">{topic.headline}</h3>
          <p className="text-gray-600 text-sm">{topic.description}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

Add modal component at bottom of page:
```javascript
<CustomTopicModal
  isOpen={customTopicModalOpen}
  onClose={() => setCustomTopicModalOpen(false)}
  onSuccess={() => {
    // Refresh custom topics list
    fetch('/api/custom-topics/approved')
      .then(r => r.json())
      .then(data => setCustomTopics(data.topics || []))
      .catch(err => console.error('Failed to refresh topics:', err));
  }}
  isSignedIn={!!user}
/>
```

**Step 3: Commit**

```bash
git add app/topics/page.jsx
git commit -m "feat: integrate custom topic modal and user-submitted topics section"
```

---

## Task 10: Update API Client Library

**Files:**
- Modify: `lib/api-client.js`

**Step 1: Add custom topic functions**

Add these exports to `lib/api-client.js`:

```javascript
/**
 * Create a custom debate topic
 */
export async function createCustomTopic(headline, description, notificationPreference) {
  const token = localStorage.getItem('debate_auth_token');
  const response = await fetch('/api/custom-topics/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      headline,
      description,
      notificationPreference,
    }),
  });

  return response.json();
}

/**
 * Get all approved custom topics
 */
export async function getApprovedCustomTopics() {
  const response = await fetch('/api/custom-topics/approved');
  return response.json();
}
```

**Step 2: Commit**

```bash
git add lib/api-client.js
git commit -m "feat: add custom topic API client functions"
```

---

## Task 11: Add Environment Variables

**Files:**
- Modify: `.env.local` and `.env.example`

**Step 1: Add to .env.example**

```
# Custom Topic Email Notifications
OWNER_EMAIL=your-email@example.com
JWT_SECRET=your-jwt-secret-key-min-32-chars
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add custom topic environment variables to template"
```

---

## Task 12: Integration with Matchmaking

**Files:**
- Modify: `app/api/matchmaking/queue/route.js`

**Step 1: Update matchmaking to support custom topics**

When creating a debate from a custom topic submission, ensure the `custom_topic_id` is stored in debates table. Modify the matchmaking logic to:

```javascript
// When creating debate from custom topic
const { data: debate } = await db
  .from('debates')
  .insert({
    topic_id: officialTopicId, // or null
    custom_topic_id: customTopicId, // add this
    pro_user_id: userA.id,
    con_user_id: userB.id,
    // ... rest of debate creation
  })
  .select()
  .single();
```

**Step 2: Commit**

```bash
git add app/api/matchmaking/queue/route.js
git commit -m "feat: add custom_topic_id support to debate creation"
```

---

## Task 13: Add Notification System (Deferred Implementation - Skeleton)

**Files:**
- Create: `lib/notifications.js` (skeleton)

**Step 1: Create notification utility skeleton**

```javascript
/**
 * Send in-app notification when someone joins custom topic
 * Deferred: Implement based on existing notification system
 */
export async function notifyTopicCreatorInApp(creatorUserId, topicHeadline, participantUsername) {
  // TODO: Implement using existing notification system
  // Should use Supabase realtime or existing notification table
  console.log(`[TODO] Notify ${creatorUserId} that ${participantUsername} joined "${topicHeadline}"`);
}

/**
 * Send email notification when someone joins custom topic
 * Deferred: Only if creator has email preference
 */
export async function notifyTopicCreatorByEmail(creatorEmail, topicHeadline, participantUsername) {
  // TODO: Implement email sending
  // Check creator's notification_preference before sending
  console.log(`[TODO] Email ${creatorEmail} that ${participantUsername} joined "${topicHeadline}"`);
}
```

**Step 2: Commit**

```bash
git add lib/notifications.js
git commit -m "feat: add notification system skeleton (deferred)"
```

---

## Success Criteria

- ✅ Users can create custom topics with headline + description via modal on topics page
- ✅ Guest users see unlock modal directing them to signup
- ✅ Rate limiting prevents users from creating more than 1 topic per 24 hours
- ✅ Owner receives email with approve/reject links when new topic submitted
- ✅ Approved topics appear in "User Submitted" section of topics page
- ✅ Creators receive email notification when topic is approved
- ✅ Custom topics join matchmaking queue like regular topics
- ✅ Per-topic notification preferences stored (email, in-app, or both)
- ✅ Content guidelines displayed during creation
- ✅ Word limits enforced (20 for headline, 150 for description)
- ✅ Database schema supports custom topics with proper RLS policies
- ✅ No email sent to creators when topics are rejected
- ✅ Approval/rejection links expire in 15 minutes

---

## Deferred for Phase 2

- Admin dashboard for topic management
- In-app notifications when someone joins custom topic
- Topic reporting/flagging system
- Creator profile page showing their topics
- Search/filter for custom topics

---

## Testing Checklist

- [ ] Create custom topic as signed-in user
- [ ] Verify rate limiting (try creating 2nd topic within 24 hours)
- [ ] Check that owner received approval email
- [ ] Click approve link and verify topic goes live
- [ ] Click reject link and verify topic is removed
- [ ] Verify creator receives approval email (not rejection)
- [ ] Test guest user sees unlock modal
- [ ] Verify custom topics appear in "User Submitted" section
- [ ] Verify joinable as regular topic in matchmaking
- [ ] Test notification preferences (email, in-app, both)
