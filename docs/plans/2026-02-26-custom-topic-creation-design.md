# Custom Debate Topic Creation & Approval — Design Doc

**Date:** 2026-02-26
**Status:** Approved

## Overview

Registered users can create persistent custom debate topics that go live after owner approval. Each topic is moderatable, subject to rate limits, and includes per-topic notification preferences.

## Requirements

### Topic Creation (User Side)
- Registered users only can create custom topics
- Guest users see unlock modal directing them to signup
- Topic creation modal asks for:
  - Headline (max 20 words)
  - Description (max 150 words)
  - Notification preference (email, in-app, or both) — **per-topic choice**
  - Content guidelines warning displayed
- Rate limiting: Max 1 topic per user per 24 hours
- After submission: User sees "Submission received, check back soon" message
- User receives email notification **only when topic is approved**

### Topic Approval (Owner Side)
- Owner receives email with approve/reject links when new topic submitted
- Email links trigger API endpoints with time-limited tokens
- Approved topics go live in "User Submitted" section of topics page
- Rejected topics are silently deleted (no notification to creator)
- Admin dashboard deferred for later implementation

### Topic Lifecycle
- Persistent topics: Multiple debates can happen on same custom topic
- No creator attribution shown on topics page
- Custom topics appear in separate "User Submitted" section (vs "House Select Topics")
- Approved custom topics join matchmaking queue like regular topics

### Notifications When Someone Joins Custom Topic
- Creator receives notification based on per-topic preference
- Email: Async email after debate created
- In-App: Realtime via Supabase realtime subscriptions
- User choice: Can select email, in-app, or both per topic

## Database Schema

### New Table: `custom_topics`
```sql
CREATE TABLE custom_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  notification_preference TEXT NOT NULL CHECK (notification_preference IN ('email', 'in_app', 'both')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by_email TEXT,
  CONSTRAINT headline_max_words CHECK (array_length(string_to_array(headline, ' '), 1) <= 20),
  CONSTRAINT description_max_words CHECK (array_length(string_to_array(description, ' '), 1) <= 150)
);

CREATE INDEX idx_custom_topics_user_id ON custom_topics(user_id);
CREATE INDEX idx_custom_topics_status ON custom_topics(status);
CREATE INDEX idx_custom_topics_created_at ON custom_topics(created_at DESC);
```

### Modification to `debates` Table
Add optional foreign key to link debates to custom topics:
```sql
ALTER TABLE debates ADD COLUMN custom_topic_id UUID REFERENCES custom_topics(id) ON DELETE SET NULL;
```

## API Endpoints

### 1. POST /api/topics/create
**Purpose:** Submit a new custom topic for approval
**Authentication:** Required (JWT)
**Rate Limit:** 1 per user per 24 hours

**Request:**
```json
{
  "headline": "Should AI be regulated by governments?",
  "description": "Focus on balancing innovation with public safety. Consider global coordination challenges.",
  "notificationPreference": "both"
}
```

**Validations:**
- User is authenticated
- Headline ≤ 20 words
- Description ≤ 150 words
- User has not created topic in last 24 hours

**Response (Success 201):**
```json
{
  "success": true,
  "message": "Submission received, check back soon"
}
```

**Side Effects:**
- Inserts `custom_topics` row with `status='pending'`
- Sends email to owner with approve/reject links

### 2. POST /api/topics/approve
**Purpose:** Owner approves topic (via email link)
**Authentication:** None (uses signed token from email link)

**Request:**
```json
{
  "topicId": "uuid",
  "token": "signed-jwt-token"
}
```

**Validations:**
- Token is valid and not expired (15 min TTL)
- Token signature matches topic ID

**Response (200):**
```json
{
  "success": true,
  "message": "Topic approved and published!"
}
```

**Side Effects:**
- Updates `custom_topics` set `status='approved'`, `approved_at=NOW()`
- Sends email to creator: "Your topic is now live!"
- Topic now appears in "User Submitted" section on topics page

### 3. POST /api/topics/reject
**Purpose:** Owner rejects topic (via email link)
**Authentication:** None (uses signed token from email link)

**Request:**
```json
{
  "topicId": "uuid",
  "token": "signed-jwt-token"
}
```

**Validations:**
- Token is valid and not expired (15 min TTL)

**Response (200):**
```json
{
  "success": true,
  "message": "Topic rejected"
}
```

**Side Effects:**
- Updates `custom_topics` set `status='rejected'` (or soft-delete)
- No email sent to creator

### 4. GET /api/topics/approved
**Purpose:** Get all approved custom topics (for topics page)
**Authentication:** Optional (public)

**Response (200):**
```json
{
  "topics": [
    {
      "id": "uuid",
      "headline": "Should AI be regulated by governments?",
      "description": "Focus on balancing innovation...",
      "createdAt": "2026-02-26T10:00:00Z"
    }
  ]
}
```

## Frontend Changes

### Topics Page
- Add "+ Create Custom Topic" button (visible to signed-in users only)
- Reorganize topics into two sections:
  - **House Select Topics** (existing pre-made topics)
  - **User Submitted** (custom topics where status='approved')
- Guest users clicking button see unlock modal

### Topic Creation Modal
- Headline input with 20-word live counter
- Description textarea with 150-word live counter
- Notification preference checkboxes (Email / In-App / Both)
- Content guidelines warning text displayed
- Submit button
- Success toast: "Submission received, check back soon"

### Guest User Modal
- "Unlock this feature by creating a free account"
- Link to signup flow

## Notification System

When someone joins a custom topic debate:
1. Match is created via existing matchmaking flow
2. Debate record created with `custom_topic_id` reference
3. Based on creator's `notification_preference`:
   - **Email:** Async email sent (can use existing email service)
   - **In-App:** Realtime notification via Supabase (existing system)

## Implementation Phases

### Phase 1: Core (This Session)
- Database schema: `custom_topics` table + `debates.custom_topic_id` column
- API: /api/topics/create, /api/topics/approve, /api/topics/reject
- Email: Owner approval notification, creator approval notification
- Frontend: Topic creation modal + topics page reorganization
- Rate limiting: 1 topic per 24 hours

### Phase 2: Deferred
- Admin dashboard for topic management
- Enhanced moderation controls
- Topic flagging/reporting system

## Security Considerations

- **RLS Policies:** Only topic creator can see their pending topics
- **Email Tokens:** Time-limited, signed JWT tokens prevent tampering
- **Rate Limiting:** Prevent spam topic creation
- **Input Validation:** Strict word limits, no HTML/script injection
- **Authentication:** Require login for topic creation

## Success Criteria

- ✅ Users can create custom topics with headline + description
- ✅ Owner receives email with approve/reject links
- ✅ Approved topics appear in "User Submitted" section
- ✅ Custom topics join matchmaking like regular topics
- ✅ Creators get email when topic approved
- ✅ Per-topic notification preferences stored and respected
- ✅ Rate limiting prevents spam (1 topic/day)
- ✅ Guest users see unlock modal
