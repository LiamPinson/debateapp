"use client";

import { useState, useRef, useCallback } from "react";
import { getUserStats } from "@/lib/api-client";

/**
 * Wraps any username with a hover card showing W/L/D/Total stats.
 *
 * Usage:
 *   <UsernameHoverCard username="alice">alice</UsernameHoverCard>
 *
 * The card appears after a 300ms debounce to avoid flicker on fast mouse-overs.
 */
export default function UsernameHoverCard({ username, children, className = "" }) {
  const [stats, setStats] = useState(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const fetchedRef = useRef(false);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(async () => {
      setVisible(true);
      if (!fetchedRef.current && username) {
        setLoading(true);
        fetchedRef.current = true;
        try {
          const data = await getUserStats(username);
          if (!data.error) setStats(data);
        } catch (_) {}
        setLoading(false);
      }
    }, 300);
  }, [username]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  if (!username) return <span className={className}>{children}</span>;

  return (
    <span
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-arena-surface border border-arena-border rounded-lg shadow-xl p-3 text-sm pointer-events-none">
          <p className="font-semibold text-arena-text mb-2 truncate">{username}</p>

          {loading ? (
            <p className="text-arena-muted text-xs">Loading…</p>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-1.5">
              <Stat label="Wins" value={stats.wins} cls="text-arena-pro" />
              <Stat label="Losses" value={stats.losses} cls="text-arena-con" />
              <Stat label="Draws" value={stats.draws} />
              <Stat label="Total" value={stats.total_debates} />
            </div>
          ) : (
            <p className="text-arena-muted text-xs">Stats unavailable</p>
          )}

          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-arena-border" />
        </div>
      )}
    </span>
  );
}

function Stat({ label, value, cls = "" }) {
  return (
    <div className="text-center">
      <p className={`font-bold ${cls || "text-arena-text"}`}>{value ?? 0}</p>
      <p className="text-xs text-arena-muted">{label}</p>
    </div>
  );
}
