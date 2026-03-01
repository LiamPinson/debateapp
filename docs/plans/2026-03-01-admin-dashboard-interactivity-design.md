# Admin Dashboard Interactivity Design

**Date:** 2026-03-01
**Feature:** Make admin dashboard stats clickable with full management pages

## Overview

Enhance the admin dashboard by making the three stat cards (Total Debates, Registered Users, Topics Pending Approval) clickable. Each navigates to an interactive management page where admins can perform full CRUD and monitoring operations.

## Requirements

### User Stories
1. As an admin, I want to click on "Total Debates" to view all debates with details (date, participants, winner, transcript)
2. As an admin, I want to click on "Registered Users" to view all members with actions (view activity, delete account)
3. As an admin, I want to click on "Topics Pending Approval" to view pending topics (already exists, just needs to be clickable from dashboard)

## Architecture

### New Pages
- `/admin/debates` — List all debates with pagination
- `/admin/members` — List all members with pagination
- `/admin/topics` — Already exists, will be made clickable from dashboard

### New API Routes

#### `GET /api/admin/debates`
```
Query: { userId, page, limit }
Returns: {
  debates: [
    { id, pro_user, con_user, winner_side, created_at, transcript },
    ...
  ],
  pagination: { page, limit, total, pages }
}
```

#### `GET /api/admin/members`
```
Query: { userId, page, limit }
Returns: {
  users: [
    { id, username, email, created_at, is_active },
    ...
  ],
  pagination: { page, limit, total, pages }
}
```

#### `GET /api/admin/members/:userId/activity`
```
Query: { adminUserId }
Returns: {
  user: { id, username, email, created_at },
  activity: {
    debatesParticipated: number,
    topicsSubmitted: number,
    topicsApproved: number,
    topicsRejected: number
  }
}
```

#### `DELETE /api/admin/members/:userId`
```
Body: { adminUserId }
Returns: { success: true } or error
```

### Component Structure

All pages follow the existing Topics Management pattern:
- Header with title, back/dashboard link, logout
- Alert sections for errors/success messages
- Main content area (loading, empty, list with pagination)
- Client-side components with session auth checks

## UI/UX Patterns

### Dashboard Changes
- Convert stat cards to `<button>` elements with click handlers
- Add visual hover state to indicate clickability
- Maintain existing styling/colors

### Debates Page
- Card or table layout showing: Date | Pro vs Con | Winner | Transcript button
- Transcript button opens modal with full transcript
- Pagination for large datasets
- Format date consistently with Topics page

### Members Page
- Card or table layout showing: Username | Email | Joined | View Activity | Delete
- "View Activity" opens modal showing user stats
- "Delete" shows confirmation dialog before action
- Format dates consistently
- Gray out deleted users or remove from list

## Data Flow

1. User clicks stat card on dashboard
2. Navigation to respective `/admin/*` page
3. Page fetches list via API (admin auth checked)
4. Display with pagination controls
5. User clicks action (view transcript, view activity, delete)
6. Action is performed (modal opens or API call made)
7. Success/error message shown, UI updated

## Error Handling

- **403 Forbidden**: Non-admin users redirected with error message
- **Network failures**: Generic error message with retry option
- **Action failures**: Show error alert, don't remove item from list
- **Empty states**: Display "No [items] found" message
- **Confirmation dialogs**: Prevent accidental deletions

## Testing Considerations

- Admin can navigate from dashboard to all management pages
- All pages show correct data with pagination working
- Modal/dialog interactions work (transcript, activity, delete confirmation)
- API calls include proper admin auth checks
- Error states display correctly
- Responsive on mobile/tablet

## Implementation Priority

1. Create API routes (debates, members, activity, delete)
2. Create debates management page
3. Create members management page
4. Update dashboard cards to be clickable
5. Add modals/dialogs (transcript, activity, delete confirmation)
6. Test and polish
