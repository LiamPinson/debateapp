"use client";

import { useState } from "react";
import { useSession } from "@/lib/SessionContext";
import { createOAuthClient } from "@/lib/supabase";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M18.244 2.25h3.908l-8.514 9.729 10.025 13.267h-7.894l-6.259-8.617-7.738 8.617H1.126l9.079-10.386L.75 2.25h8.08l5.877 7.891 7.337-7.891zm-1.386 17.359h2.16L6.736 4.413H4.42l12.438 15.196z"/>
    </svg>
  );
}

export default function RegisterModal({ open, onClose }) {
  const { register, session } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const debatesUsed = session?.debate_count || 0;

  const handleGoogle = async () => {
    setError(null);
    const supabase = createOAuthClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleX = async () => {
    setError(null);
    const supabase = createOAuthClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "x",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await register(username, email, password);
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

        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              onClick={handleGoogle}
              className="flex-1 flex items-center justify-center gap-3 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              <GoogleIcon /> Google
            </button>
            <button
              onClick={handleX}
              className="flex-1 flex items-center justify-center gap-3 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              <XIcon /> X
            </button>
          </div>

          <div className="flex items-center gap-3 text-arena-muted text-xs">
            <hr className="flex-1 border-arena-border" />
            or register with email
            <hr className="flex-1 border-arena-border" />
          </div>

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

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
                placeholder="Repeat your password"
              />
            </div>

            {error && <p className="text-sm text-arena-con">{error}</p>}

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
    </div>
  );
}
