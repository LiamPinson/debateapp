"use client";

const CATEGORY_COLORS = {
  politics: "bg-blue-900/40 text-blue-400",
  economics: "bg-emerald-900/40 text-emerald-400",
  philosophy: "bg-orange-900/40 text-orange-400",
  science: "bg-cyan-900/40 text-cyan-400",
  culture: "bg-pink-900/40 text-pink-400",
  silly: "bg-yellow-900/40 text-yellow-400",
  fantasy: "bg-orange-900/40 text-orange-400",
};

export default function TopicCard({ topic, onClick }) {
  const catColor = CATEGORY_COLORS[topic.category] || "bg-arena-border text-arena-muted";

  return (
    <button
      onClick={() => onClick?.(topic)}
      className="w-full text-left bg-arena-surface border border-arena-border rounded-lg p-4 hover:border-arena-accent transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColor}`}>
          {topic.category}
        </span>
        {topic.debate_count > 0 && (
          <span className="text-xs text-arena-muted">{topic.debate_count} debates</span>
        )}
      </div>
      <h3 className="font-semibold text-sm group-hover:text-arena-accent transition-colors leading-snug">
        {topic.short_title || topic.title}
      </h3>
      {topic.description && (
        <p className="text-xs text-arena-muted mt-1 line-clamp-2">{topic.description}</p>
      )}
    </button>
  );
}
