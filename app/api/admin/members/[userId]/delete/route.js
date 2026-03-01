import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/admin/members/:userId
 * Deletes a user account (soft delete via is_active flag)
 * Requires authenticated admin user
 *
 * Path Params: { userId } - The user ID to delete
 * Query Params: { userId } - The authenticated admin user ID (must have is_admin=true)
 *
 * Returns: { success: true }
 * Errors:
 *   - 400 Bad Request: userId query param not provided or userId matches admin userId
 *   - 401 Unauthorized: Admin user not found or session invalid
 *   - 403 Forbidden: User exists but is not an admin
 *   - 404 Not Found: Target user not found
 *   - 500 Internal Server Error: Database query failure
 */
export async function DELETE(request, { params }) {
  try {
    const { userId } = params;
    const searchParams = request.nextUrl.searchParams;
    const adminId = searchParams.get('userId');

    if (!adminId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required in path' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === adminId) {
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
      .eq('id', adminId)
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

    // Check if target user exists
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
