"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/SessionContext";
import NotificationDropdown from "./NotificationDropdown";
import RegisterModal from "./RegisterModal";
import RankBadge from "./RankBadge";

export default function Nav() {
  const { user, session, loading } = useSession();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isGuest = !user;
  const debatesRemaining = 5 - (session?.debate_count || 0);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-arena-bg/90 backdrop-blur-md border-b border-arena-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-arena-accent">Arena</span>
            <span className="text-arena-muted">.gg</span>
          </Link>

          {/* Center: Nav links */}
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/" className="text-sm text-arena-muted hover:text-arena-text transition-colors">
              Home
            </Link>
            <Link href="/topics" className="text-sm text-arena-muted hover:text-arena-text transition-colors">
              Topics
            </Link>
            <Link href="/leaderboard" className="text-sm text-arena-muted hover:text-arena-text transition-colors">
              Leaderboard
            </Link>
          </div>

          {/* Right: User area */}
          <div className="flex items-center gap-3">
            {!loading && (
              <>
                {user && <NotificationDropdown />}

                {isGuest ? (
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline text-xs text-arena-muted">
                      {debatesRemaining > 0
                        ? `${debatesRemaining} debates remaining`
                        : "No debates remaining"}
                    </span>
                    <button
                      onClick={() => setRegisterOpen(true)}
                      className="px-3 py-1.5 bg-arena-accent text-white text-sm rounded-lg font-medium hover:bg-arena-accent/80 transition-colors"
                    >
                      Register
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={(el) => {
                    // Close menu on outside click
                    if (!el) return;
                    const handler = (e) => {
                      if (!el.contains(e.target)) setMenuOpen(false);
                    };
                    document.addEventListener("mousedown", handler);
                  }}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="flex items-center gap-2 text-sm hover:text-arena-accent transition-colors"
                    >
                      <span>{user.username}</span>
                      <RankBadge rank={user.rank_tier} />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-arena-surface border border-arena-border rounded-lg shadow-xl py-1">
                        <Link
                          href={`/profile/${user.id}`}
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2 text-sm hover:bg-arena-border/30"
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            // logout handled elsewhere if needed
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-arena-con hover:bg-arena-border/30"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden p-2 text-arena-muted hover:text-arena-text"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <RegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </>
  );
}
