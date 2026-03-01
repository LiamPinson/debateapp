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
  const [activityLoading, setActivityLoading] = useState(null);
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
      setActivityLoading(userId);
      setError(null);

      const params = new URLSearchParams({ userId: user.id });
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
      setActivityLoading(null);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleteLoading(deleteConfirm.id);
      setError(null);

      const params = new URLSearchParams({ userId: user.id });
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
                          disabled={activityLoading === member.id}
                          className="px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {activityLoading === member.id ? "..." : "View Activity"}
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
                aria-label="Close activity modal"
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
