'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import TopicsFilter from "./TopicsFilter";
import { CustomTopicModal } from '@/components/CustomTopicModal';

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [customTopics, setCustomTopics] = useState([]);
  const [customTopicModalOpen, setCustomTopicModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        // Fetch official topics
        const response = await fetch('/api/topics');
        const data = await response.json();
        setTopics(data.topics || []);
      } catch (err) {
        console.error('Failed to fetch topics:', err);
      }
    };

    fetchTopics();
  }, []);

  useEffect(() => {
    const fetchCustomTopics = async () => {
      try {
        const response = await fetch('/api/custom-topics/approved');
        const data = await response.json();
        setCustomTopics(data.topics || []);
      } catch (err) {
        console.error('Failed to fetch custom topics:', err);
      }
    };

    fetchCustomTopics();
  }, []);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Topics</h1>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading topics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Topics</h1>

      <button
        onClick={() => setCustomTopicModalOpen(true)}
        className="w-full mb-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition"
      >
        + Create Custom Topic
      </button>

      <TopicsFilter topics={topics} />

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
            .catch(err => console.error('Failed to refresh topics:', err));
        }}
        isSignedIn={!!session?.user}
      />
    </div>
  );
}
