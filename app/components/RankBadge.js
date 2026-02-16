"use client";

const RANK_STYLES = {
  Bronze: "bg-amber-900/30 text-amber-400 border-amber-700",
  Silver: "bg-gray-700/30 text-gray-300 border-gray-500",
  Gold: "bg-yellow-900/30 text-yellow-400 border-yellow-600",
  Platinum: "bg-cyan-900/30 text-cyan-400 border-cyan-600",
  Diamond: "bg-violet-900/30 text-violet-400 border-violet-600",
};

const RANK_THRESHOLDS = { Bronze: 0, Silver: 50, Gold: 70, Platinum: 85, Diamond: 95 };
const RANK_ORDER = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export default function RankBadge({ rank = "Bronze", size = "sm" }) {
  const style = RANK_STYLES[rank] || RANK_STYLES.Bronze;
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${style} ${sizeClass}`}>
      {rank}
    </span>
  );
}

export function RankProgress({ rank = "Bronze", score = 50 }) {
  const currentIdx = RANK_ORDER.indexOf(rank);
  const nextRank = RANK_ORDER[currentIdx + 1];
  if (!nextRank) return <p className="text-xs text-arena-muted">Max rank achieved</p>;

  const currentThreshold = RANK_THRESHOLDS[rank];
  const nextThreshold = RANK_THRESHOLDS[nextRank];
  const progress = ((score - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-arena-muted mb-1">
        <span>{rank}</span>
        <span>{nextRank} ({nextThreshold})</span>
      </div>
      <div className="h-2 bg-arena-border rounded-full overflow-hidden">
        <div
          className="h-full bg-arena-accent rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
