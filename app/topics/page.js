"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import TopicCard from "../components/TopicCard";
import MatchmakingModal from "../components/MatchmakingModal";

const CATEGORIES = ["all", "politics", "economics", "philosophy", "science", "culture", "silly", "fantasy"];

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from("topics")
      .select("*")
      .order("category")
      .order("title")
      .then(({ data }) => {
        setTopics(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = category === "all" ? topics : topics.filter((t) => t.category === category);

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Topics</h1>

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
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-arena-surface border border-arena-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-arena-muted py-16">No topics in this category.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onClick={setSelectedTopic} />
            ))}
          </div>
        )}
      </div>

      <MatchmakingModal
        open={!!selectedTopic}
        onClose={() => setSelectedTopic(null)}
        topic={selectedTopic}
      />
    </>
  );
}
