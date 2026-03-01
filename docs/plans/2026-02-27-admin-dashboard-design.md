# Admin Dashboard Design - 2026-02-27

## Overview

Create a lightweight admin dashboard accessible only to specified admin emails. When an admin user logs in with their designated email, they are automatically redirected to a dashboard showing platform statistics.

## Requirements

- **Access Control**: Only two specific emails can access the admin dashboard:
  - adaptivebodydesign@gmail.com
  - adaptivebodydesign@protonmail.com
- **Auto-redirect**: Admin users are automatically redirected to the dashboard after login
- **Initial Setup**: A script allows setting admin status for emails
- **Dashboard Stats**: Display three key metrics:
  - All-time total debates (count)
  - Registered account count
  - Topics pending approval (count)

## Technical Design

### Database Changes

**Prisma Schema Update:**
- Add `isAdmin: Boolean @default(false)` field to the `User` model
- This flag determines dashboard access and future admin capabilities

### File Structure

```
scripts/
  set-admin.mjs          (new) - Script to mark users as admin

app/admin/
  dashboard/
    page.js              (new) - Admin dashboard page

app/api/admin/
  stats/route.js         (new) - API endpoint for dashboard statistics
```

### Core Implementation

#### 1. Admin Setup Script (`scripts/set-admin.mjs`)
- Command: `node scripts/set-admin.mjs <email>`
- Validates user exists by email
- Sets `isAdmin = true`
- Returns success/error messages
- Example: `node scripts/set-admin.mjs adaptivebodydesign@gmail.com`

#### 2. Admin Dashboard Page (`app/admin/dashboard/page.js`)
- Server-side rendering
- Checks if user is authenticated and `isAdmin = true`
- Redirects to home page if not admin
- Fetches statistics via API call to `/api/admin/stats`
- Displays stats in clean card layout with basic styling
- Includes logout/return to app navigation

#### 3. Statistics API (`app/api/admin/stats/route.js`)
- Requires admin authentication
- Returns JSON with three metrics:
  - `totalDebates`: COUNT(*) from debates table
  - `totalUsers`: COUNT(*) from users table
  - `pendingTopics`: COUNT(*) where topics.status = 'pending'

#### 4. Login Flow Changes
- Login API (`app/api/auth/login/route.js`) returns `user.isAdmin` in session response
- Client-side check: If `isAdmin === true`, redirect to `/admin/dashboard` after login
- Can be implemented in auth provider or login modal logic

## User Flow

1. User logs in with admin email (adaptivebodydesign@gmail.com or adaptivebodydesign@protonmail.com)
2. Login API validates credentials and returns session with `isAdmin: true`
3. Client detects `isAdmin` flag and redirects to `/admin/dashboard`
4. Dashboard page loads, server-side verifies admin status
5. If verified, dashboard fetches stats and displays metrics
6. User can logout or navigate back to main app

## Future Extensibility

This framework supports future admin features:
- Individual topic approval/rejection endpoints
- User management (suspend, delete accounts)
- System configuration panel
- Analytics dashboards
- Audit logs

The `isAdmin` flag and protected `/admin` route structure provide the foundation for these features.

## Success Criteria

- ✅ isAdmin field added to User model
- ✅ Admin setup script works correctly
- ✅ Dashboard auto-redirects after login for admin users
- ✅ Non-admin users cannot access `/admin/dashboard`
- ✅ Dashboard displays accurate counts for debates, users, and pending topics
- ✅ Dashboard has logout/navigation option
