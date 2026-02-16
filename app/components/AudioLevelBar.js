"use client";

export default function AudioLevelBar({ level = 0, side = "pro" }) {
  const color = side === "pro" ? "bg-arena-pro" : "bg-arena-con";

  return (
    <div className="flex items-end gap-0.5 h-6">
      {[0.15, 0.3, 0.45, 0.6, 0.8].map((threshold, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-100 ${
            level >= threshold ? color : "bg-arena-border"
          }`}
          style={{ height: `${40 + i * 15}%` }}
        />
      ))}
    </div>
  );
}
