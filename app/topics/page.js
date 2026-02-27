'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/lib/SessionContext';
import TopicsFilter from "./TopicsFilter";
import { CustomTopicModal } from '@/components/CustomTopicModal';

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [customTopics, setCustomTopics] = useState([]);
  const [customTopicModalOpen, setCustomTopicModalOpen] = useState(false);
  const { user } = useSession();

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => setTopics(data.topics || []))
      .catch(err => console.error('Failed to fetch topics:', err));

    fetch('/api/custom-topics/approved')
      .then(r => r.json())
      .then(data => setCustomTopics(data.topics || []))
      .catch(err => console.error('Failed to refresh custom topics:', err));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Topics</h1>

      <button
        onClick={() => setCustomTopicModalOpen(true)}
        className="w-full mb-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition"
      >
        + Create Custom Topic
      </button>

      <div className="mb-4">
        <h2 className="text-xl font-bold mb-4">House Select Topics</h2>
        <TopicsFilter topics={topics} />
      </div>

      {customTopics.length > 0 && (
        <div className="mt-12 mb-8">
          <h2 className="text-2xl font-bold mb-6">User Submitted</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customTopics.map(topic => (
              <div
                key={topic.id}
                className="p-4 border border-gray-300 rounded-lg hover:border-indigo-500 hover:shadow-md transition cursor-pointer"
              >
                <h3 className="font-semibold text-lg mb-2">{topic.headline}</h3>
                <p className="text-gray-600 text-sm">{topic.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <CustomTopicModal
        isOpen={customTopicModalOpen}
        onClose={() => setCustomTopicModalOpen(false)}
        onSuccess={() => {
          fetch('/api/custom-topics/approved')
            .then(r => r.json())
            .then(data => setCustomTopics(data.topics || []))
            .catch(err => console.error('Failed to refresh custom topics:', err));
        }}
        isSignedIn={!!user}
      />
    </div>
  );
}
