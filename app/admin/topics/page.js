"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import Link from "next/link";

export default function AdminTopicsPage() {
  const router = useRouter();
  const { user, loading, logout } = useSession();

  const [activeTab, setActiveTab] = useState("pending");
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [tabCounts, setTabCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const LIMIT = 50;

  // Fetch topics
  useEffect(() => {
    if (loading) return;

    if (!user?.id) {
      router.push("/");
      return;
    }

    const fetchTopics = async () => {
      try {
        setTopicsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          userId: user.id,
          status: activeTab,
          page: page.toString(),
          limit: LIMIT.toString(),
        });

        const response = await fetch(`/api/admin/topics?${params}`);

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 403) {
            setError("You do not have admin access to this page.");
            return;
          }
          setError(data.error || "Failed to fetch topics");
          return;
        }

        const data = await response.json();
        setTopics(data.topics || []);
        setPagination(data.pagination || {});

        // Update tab counts
        if (page === 1) {
          setTabCounts((prev) => ({
            ...prev,
            [activeTab]: data.pagination?.total || 0,
          }));
        }
      } catch (err) {
        console.error("Error fetching topics:", err);
        setError("An error occurred while fetching topics");
      } finally {
        setTopicsLoading(false);
      }
    };

    fetchTopics();
  }, [user, loading, router, activeTab, page]);

  // Handle approve
  const handleApprove = async (topicId) => {
    if (!user?.id) return;

    try {
      setActionLoading(topicId);
      setError(null);

      const response = await fetch(`/api/admin/topics/${topicId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to approve topic");
        return;
      }

      // Remove from list and show success message
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      setMessage("Topic approved successfully");

      // Update pagination
      if (pagination) {
        setPagination((prev) => ({
          ...prev,
          total: Math.max(0, (prev?.total || 0) - 1),
          pages: Math.ceil(Math.max(0, (prev?.total || 0) - 1) / LIMIT),
        }));
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error approving topic:", err);
      setError("An error occurred while approving the topic");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reject
  const handleReject = async (topicId) => {
    if (!user?.id) return;

    try {
      setActionLoading(topicId);
      setError(null);

      const response = await fetch(`/api/admin/topics/${topicId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to reject topic");
        return;
      }

      // Remove from list and show success message
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      setMessage("Topic rejected successfully");

      // Update pagination
      if (pagination) {
        setPagination((prev) => ({
          ...prev,
          total: Math.max(0, (prev?.total || 0) - 1),
          pages: Math.ceil(Math.max(0, (prev?.total || 0) - 1) / LIMIT),
        }));
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error rejecting topic:", err);
      setError("An error occurred while rejecting the topic");
    } finally {
      setActionLoading(null);
    }
  };

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
          aria-label="Loading topics..."
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
              <h1 className="text-3xl font-bold mb-2">Topic Management</h1>
              <p className="text-sm text-arena-muted">
                Manage and approve custom topic submissions
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

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-arena-border">
          {["pending", "approved", "rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`px-4 py-3 font-medium text-sm capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-arena-accent text-arena-accent"
                  : "border-transparent text-arena-muted hover:text-arena-text"
              }`}
            >
              {tab} ({tabCounts[tab]})
            </button>
          ))}
        </div>

        {/* Topics List */}
        {topicsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Loading topics..."
            />
          </div>
        ) : topics.length > 0 ? (
          <>
            <div className="space-y-4 mb-8">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="bg-arena-card border border-arena-border rounded-lg p-6"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2 text-arena-text">
                        {topic.headline}
                      </h3>
                      <p className="text-sm text-arena-muted mb-4">
                        {topic.description}
                      </p>
                      <div className="text-xs text-arena-muted space-y-1">
                        <p>
                          Submitted by:{" "}
                          <span className="font-medium">
                            {topic.submitted_by?.username} ({topic.submitted_by?.email})
                          </span>
                        </p>
                        <p>
                          Submitted on:{" "}
                          <span className="font-medium">
                            {formatDate(topic.created_at)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons (only on pending tab) */}
                    {activeTab === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(topic.id)}
                          disabled={actionLoading === topic.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {actionLoading === topic.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleReject(topic.id)}
                          disabled={actionLoading === topic.id}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {actionLoading === topic.id ? "..." : "Reject"}
                        </button>
                      </div>
                    )}
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
            <p className="text-arena-muted">
              No {activeTab} topics found.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
