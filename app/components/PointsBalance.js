"use client";

import { useState, useEffect } from "react";
import { getProfile } from "@/lib/api-client";

/**
 * Displays the current user's points balance in the nav.
 * Fetches fresh data from /api/profile/me on mount so the balance
 * reflects any points earned since the last login.
 */
export default function PointsBalance({ userId, initialBalance = 0 }) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    if (!userId) return;
    getProfile(userId).then((data) => {
      const pts = data?.user?.points_balance ?? data?.points_balance;
      if (pts !== undefined) setBalance(pts);
    }).catch(() => {});
  }, [userId]);

  return (
    <span className="flex items-center gap-1 text-sm text-arena-muted" title="Your points balance">
      <span className="text-arena-accent font-semibold">⬡</span>
      <span className="font-medium text-arena-text">{balance}</span>
      <span className="hidden sm:inline text-xs">pts</span>
    </span>
  );
}
