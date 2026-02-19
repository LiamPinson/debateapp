"use client";

const CATEGORY_COLORS = {
  politics: "bg-blue-100 text-blue-700",
  economics: "bg-emerald-100 text-emerald-700",
  philosophy: "bg-amber-100 text-amber-700",
  science: "bg-cyan-100 text-cyan-700",
  culture: "bg-pink-100 text-pink-700",
  silly: "bg-yellow-100 text-yellow-700",
  fantasy: "bg-violet-100 text-violet-700",
};

export default function TopicCard({ topic, onClick }) {
  const catColor = CATEGORY_COLORS[topic.category] || "bg-arena-border text-arena-muted";

  return (
    <button
      onClick={() => onClick?.(topic)}
      className="w-full text-left bg-arena-card border border-arena-border rounded-xl p-4 hover:border-arena-accent hover:shadow-sm transition-all group"
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
