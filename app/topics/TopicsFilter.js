"use client";

import { useState } from "react";
import TopicCard from "../components/TopicCard";
import MatchmakingModal from "../components/MatchmakingModal";

const CATEGORIES = ["all", "politics", "economics", "philosophy", "science", "culture", "silly", "fantasy"];

export default function TopicsFilter({ topics }) {
  const [category, setCategory] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState(null);

  const filtered =
    category === "all" ? topics : topics.filter((t) => t.category === category);

  return (
    <>
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              category === cat
                ? "bg-arena-accent text-white"
                : "bg-arena-surface border border-arena-border text-arena-muted hover:text-arena-text"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Topic grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-arena-muted py-16">No topics in this category.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((topic) => (
            <TopicCard key={topic.id} topic={topic} onClick={setSelectedTopic} />
          ))}
        </div>
      )}

      <MatchmakingModal
        open={!!selectedTopic}
        onClose={() => setSelectedTopic(null)}
        topic={selectedTopic}
      />
    </>
  );
}
