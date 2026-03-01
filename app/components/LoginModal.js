"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { loginWithPassword } from "@/lib/api-client";
import { createOAuthClient } from "@/lib/supabase";
import ForgotPasswordModal from "./ForgotPasswordModal";

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

export default function LoginModal({ open, onClose }) {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleClose = useCallback(() => {
    setEmail("");
    setPassword("");
    setError(null);
    onClose();
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!open) return null;

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
    setLoading(true);
    try {
      const result = await loginWithPassword(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        // Session cookie is set automatically by the server response
        login(result.user);
        handleClose();

        // Redirect based on admin status
        if (result.user?.isAdmin) {
          router.push("/admin/dashboard");
        } else {
          router.push("/");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="login-title" className="text-xl font-bold mb-2">Sign In</h2>
        <p className="text-sm text-arena-muted mb-4">Enter your email and password to sign in.</p>

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
            or
            <hr className="flex-1 border-arena-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-arena-accent hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
                placeholder="••••••••"
              />
            </div>

            {error && <p role="alert" className="text-sm text-arena-con">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>
        </div>

        <ForgotPasswordModal
          open={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
          onBackToLogin={() => setShowForgotPassword(false)}
        />
      </div>
    </div>
  );
}
