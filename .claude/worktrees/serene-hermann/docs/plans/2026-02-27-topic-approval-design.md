# Topic Approval Feature Design - 2026-02-27

## Overview

Add a topic management section to the admin dashboard where admins can review, approve, and reject pending custom debate topics submitted by users. Approved topics automatically become publicly visible on the user-facing topics page.

## Requirements

**User Story:** As an admin, I want to review pending user-submitted debate topics and approve/reject them so that only quality topics are made available to the platform.

**Key Features:**
- View pending topics with pagination (50 per page)
- See approved topics (audit trail)
- See rejected topics (audit trail)
- Approve topics → immediately visible on `/topics` page to all users
- Reject topics → status updated, not visible publicly
- Display submitted by (username + email), submission date, headline, description

## Technical Design

### Database

**No schema changes required.**

The `custom_topics` table already supports all needed fields:
- `status` (pending, approved, rejected)
- `created_at` (submission date)
- `user_id` (who submitted)
- `approved_at` (when approved, set on approval)
- `approved_by_user_id` (which admin approved, set on approval)

### API Endpoints

**New endpoints to create:**

1. **GET `/api/admin/topics`**
   - Query parameters: `status` (pending|approved|rejected), `page` (default 1), `limit` (default 50)
   - Returns: Array of topics with user info (username, email), pagination metadata
   - Requires: Admin authentication (is_admin = true)
   - Response:
     ```json
     {
       "topics": [
         {
           "id": "uuid",
           "headline": "string",
           "description": "string",
           "status": "pending|approved|rejected",
           "created_at": "2026-02-27T...",
           "approved_at": "2026-02-27T..." | null,
           "submitted_by": {
             "username": "string",
             "email": "string"
           }
         }
       ],
       "pagination": {
         "page": 1,
         "limit": 50,
         "total": 150,
         "pages": 3
       }
     }
     ```

2. **POST `/api/admin/topics/{id}/approve`**
   - Body: none required
   - Action: Set `status = 'approved'`, `approved_at = NOW()`, `approved_by_user_id = current_user_id`
   - Returns: Updated topic object
   - Requires: Admin authentication
   - Error handling: 404 if topic not found, 400 if already approved

3. **POST `/api/admin/topics/{id}/reject`**
   - Body: none required (or optional rejection reason in future)
   - Action: Set `status = 'rejected'`
   - Returns: Updated topic object
   - Requires: Admin authentication
   - Error handling: 404 if topic not found, 400 if already rejected

### Frontend Components

**New page component:** `/app/admin/topics/page.js`

**Features:**
- Three tabs: Pending, Approved, Rejected
- Default tab: Pending Topics
- Topic list with pagination (50 per page)
- Each topic displays:
  - Headline (large/bold)
  - Description (truncated to 3 lines or 150 chars)
  - Submitted by: `username (email)`
  - Submitted date: formatted (e.g., "Feb 27, 2026 at 10:30 AM")
  - Approve button (green, pending tab only)
  - Reject button (red, pending tab only)
- Pagination controls: Previous/Next buttons, showing "Page X of Y"
- Success messages after approve/reject (toast or alert)
- Error messages if action fails

**Simple styling:** No fancy CSS, just functional and readable

### Data Flow

1. Admin navigates to `/admin/topics` (new page within dashboard)
2. Default loads pending topics, page 1, 50 per page
3. API call to `GET /api/admin/topics?status=pending&page=1&limit=50` returns topics + user info
4. Topics rendered in list with approve/reject buttons
5. Admin clicks approve or reject
6. POST request to `/api/admin/topics/{id}/approve` or `/api/admin/topics/{id}/reject`
7. API updates database:
   - Approve: `status = 'approved'`, `approved_at = NOW()`, `approved_by_user_id = admin_id`
   - Reject: `status = 'rejected'`
8. Topic removed from pending list (or page refreshes)
9. Approved topics immediately visible on public `/topics` page
10. Admin sees success message

### Public Integration

**Existing functionality already supports this:**
- `/app/topics/page.js` displays topics
- `/api/custom-topics/approved/route.js` fetches approved topics
- When a topic is approved (status changed to 'approved'), it automatically appears in the public listing

**No additional work needed for public visibility.**

### Authentication & Authorization

- Require admin authentication on all new endpoints (check `is_admin = true`)
- Check that admin user exists and has proper permissions
- Return 403 Forbidden if non-admin attempts to access

### Error Handling

**API errors:**
- 400: Bad request (invalid page, limit, status)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not admin)
- 404: Topic not found
- 409: Conflict (topic already approved/rejected)
- 500: Server error

**User feedback:**
- Show toast/alert messages for success and error
- Clear error messages that explain what went wrong
- Disable buttons during API calls to prevent double-clicks

## Success Criteria

✅ Admin can view pending topics with pagination
✅ Admin can approve topics (status changes, visible publicly immediately)
✅ Admin can reject topics (status changes, not visible publicly)
✅ Approved/rejected topics appear in respective tabs
✅ Display shows: headline, description, submitted by (email + username), date
✅ 50 topics per page with pagination controls
✅ Security: Only admins can approve/reject
✅ No unauthorized data exposure
