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
