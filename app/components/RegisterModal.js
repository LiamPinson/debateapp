"use client";

import { useState } from "react";
import { useSession } from "@/lib/SessionContext";

export default function RegisterModal({ open, onClose }) {
  const { register, session } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const debatesUsed = session?.debate_count || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await register(username, email);
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-2">Create Your Account</h2>
        <p className="text-sm text-arena-muted mb-4">
          {debatesUsed >= 5
            ? "You've used all 5 guest debates. Register to keep debating!"
            : `${5 - debatesUsed} guest debates remaining. Register for unlimited access.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={24}
              className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
              placeholder="Pick a username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
              placeholder="you@example.com"
            />
          </div>

          {error && (
            <p className="text-sm text-arena-con">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
