'use client';

import { useState } from 'react';

export function CustomTopicModal({ isOpen, onClose, onSuccess, isSignedIn }) {
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [notificationPref, setNotificationPref] = useState('both');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headlineWords = headline.trim().split(/\s+/).filter(w => w).length;
  const descriptionWords = description.trim().split(/\s+/).filter(w => w).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('debate_auth_token');
      const response = await fetch('/api/custom-topics/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          headline,
          description,
          notificationPreference: notificationPref,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to submit topic');
        return;
      }

      // Success
      setHeadline('');
      setDescription('');
      setNotificationPref('both');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Guest unlock modal
  if (!isSignedIn) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
          <h2 className="text-2xl font-bold mb-4">Unlock This Feature</h2>
          <p className="text-gray-600 mb-6">
            Create a free account to submit your own debate topics and receive notifications when users join.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Navigate to signup
                window.location.href = '/signup';
              }}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Topic creation modal for signed-in users
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2">Create a Custom Debate Topic</h2>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6 text-sm text-yellow-800">
          <p>
            <strong>All topics are manually reviewed.</strong> Users may be deactivated for distasteful submissions at the owner's discretion.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Headline */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Headline Question <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g., Should AI be regulated by governments?"
              maxLength={200}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Max 20 words</span>
              <span>{headlineWords}/20 words</span>
            </div>
            {headlineWords > 20 && (
              <p className="text-red-600 text-sm mt-1">Headline exceeds 20 words</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              More Info <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Be specific and concise about what aspects of the topic you'd like debaters to focus on.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Focus on balancing innovation with public safety. Consider global coordination challenges."
              rows={5}
              maxLength={1500}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Max 150 words</span>
              <span>{descriptionWords}/150 words</span>
            </div>
            {descriptionWords > 150 && (
              <p className="text-red-600 text-sm mt-1">Description exceeds 150 words</p>
            )}
          </div>

          {/* Notification Preference */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              Notifications <span className="text-red-600">*</span>
            </label>
            <p className="text-xs text-gray-600 mb-3">
              How should we notify you when someone joins your debate?
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                     onClick={() => setNotificationPref('email')}>
                <input
                  type="radio"
                  name="notification"
                  value="email"
                  checked={notificationPref === 'email'}
                  onChange={(e) => setNotificationPref(e.target.value)}
                />
                <span className="font-medium">Email only</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                     onClick={() => setNotificationPref('in_app')}>
                <input
                  type="radio"
                  name="notification"
                  value="in_app"
                  checked={notificationPref === 'in_app'}
                  onChange={(e) => setNotificationPref(e.target.value)}
                />
                <span className="font-medium">In-app only</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-indigo-300 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100"
                     onClick={() => setNotificationPref('both')}>
                <input
                  type="radio"
                  name="notification"
                  value="both"
                  checked={notificationPref === 'both'}
                  onChange={(e) => setNotificationPref(e.target.value)}
                />
                <span className="font-medium">Both email and in-app (Recommended)</span>
              </label>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !headline.trim() ||
                !description.trim() ||
                headlineWords > 20 ||
                descriptionWords > 150
              }
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
