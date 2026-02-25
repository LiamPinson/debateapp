"use client";

import { useState } from "react";

export default function ForgotPasswordModal({ open, onClose, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setEmail("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to send reset link");
        return;
      }

      setSuccess(true);
      setEmail("");
      // Auto-close after 3 seconds
      setTimeout(handleClose, 3000);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    handleClose();
    if (onBackToLogin) onBackToLogin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-2">Reset Password</h2>
        <p className="text-sm text-arena-muted mb-4">
          Enter your email and we'll send you a link to reset your password.
        </p>

        {success ? (
          <div className="text-center">
            <p className="text-sm text-arena-accent mb-4">
              ✓ Check your email for a reset link. It expires in 1 hour.
            </p>
            <p className="text-xs text-arena-muted">Closing...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={loading}
                className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-arena-con">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex-1 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Back to Login
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
