"use client";

import Link from "next/link";
import RankBadge from "./RankBadge";

export default function DebateCard({ debate }) {
  const isCompleted = debate.status === "completed";

  return (
    <Link
      href={`/debate/${debate.id}`}
      className="block bg-arena-surface border border-arena-border rounded-lg p-4 hover:border-arena-accent transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-arena-muted">
          {new Date(debate.created_at).toLocaleDateString()}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isCompleted ? "bg-emerald-900/30 text-emerald-400" : "bg-yellow-900/30 text-yellow-400"
        }`}>
          {debate.status}
        </span>
      </div>

      <p className="font-medium text-sm mb-2">{debate.topic_title || "Quick Match"}</p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-arena-pro">PRO</span>
          <span>{debate.pro_username || "Guest"}</span>
        </div>
        <span className="text-arena-muted">vs</span>
        <div className="flex items-center gap-2">
          <span>{debate.con_username || "Guest"}</span>
          <span className="text-arena-con">CON</span>
        </div>
      </div>

      {isCompleted && debate.winner && (
        <div className="mt-2 text-xs text-center">
          Winner: <span className={debate.winner === "pro" ? "text-arena-pro" : debate.winner === "con" ? "text-arena-con" : "text-arena-muted"}>
            {debate.winner === "draw" ? "Draw" : debate.winner.toUpperCase()}
          </span>
        </div>
      )}
    </Link>
  );
}
