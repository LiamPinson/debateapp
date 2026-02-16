"use client";

export default function ScoreBar({ label, score = 0, maxScore = 100, color = "accent" }) {
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const colorClass = color === "pro" ? "bg-arena-pro" : color === "con" ? "bg-arena-con" : "bg-arena-accent";

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-arena-muted">{label}</span>
        <span className="font-mono font-medium">{score.toFixed(1)}</span>
      </div>
      <div className="h-2 bg-arena-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
