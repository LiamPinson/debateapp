"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import Link from "next/link";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check authentication and admin status
    if (loading) return;

    if (!user?.id) {
      router.push("/");
      return;
    }

    // Fetch stats from API
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/stats?userId=${user.id}`);

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 403) {
            setError("You do not have admin access to this page.");
            return;
          }
          setError(data.error || "Failed to fetch stats");
          return;
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("An error occurred while fetching stats");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user, loading, router]);

  // Show loading state while checking session
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
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
              <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
              <p className="text-sm text-arena-muted">
                Logged in as: <span className="font-medium">{user.email}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/"
                className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Back to App
              </Link>
              <button
                onClick={() => {
                  // Logout functionality - clear session
                  localStorage.removeItem("debate_session_token");
                  router.push("/");
                }}
                className="px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {error && (
          <div className="mb-6 p-4 bg-arena-con/10 border border-arena-con/20 rounded-lg">
            <p className="text-sm text-arena-con">{error}</p>
          </div>
        )}

        {statsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Total Debates Card */}
            <div className="bg-arena-card border border-arena-border rounded-xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-arena-muted mb-2">Total Debates</p>
                  <p className="text-4xl font-bold text-arena-accent">
                    {stats.totalDebates}
                  </p>
                </div>
                <div className="w-12 h-12 bg-arena-accent/10 text-arena-accent rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Registered Users Card */}
            <div className="bg-arena-card border border-arena-border rounded-xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-arena-muted mb-2">
                    Registered Users
                  </p>
                  <p className="text-4xl font-bold text-arena-pro">
                    {stats.totalUsers}
                  </p>
                </div>
                <div className="w-12 h-12 bg-arena-pro/10 text-arena-pro rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6.5 20H12v-2a3 3 0 00-3-3H4a3 3 0 00-3 3v2h7.5z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Topics Pending Approval Card */}
            <div className="bg-arena-card border border-arena-border rounded-xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-arena-muted mb-2">
                    Topics Pending Approval
                  </p>
                  <p className="text-4xl font-bold text-arena-con">
                    {stats.pendingTopics}
                  </p>
                </div>
                <div className="w-12 h-12 bg-arena-con/10 text-arena-con rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
