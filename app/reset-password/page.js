"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useSession();

  const [token, setToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Get token from URL and validate it
  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("No reset token provided");
      setLoading(false);
      return;
    }

    setToken(tokenParam);
    validateToken(tokenParam);
  }, [searchParams]);

  const validateToken = async (tokenParam) => {
    try {
      const response = await fetch(
        `/api/auth/reset-password/validate?token=${tokenParam}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid or expired token");
        setLoading(false);
        return;
      }

      setMaskedEmail(data.email);
      setLoading(false);
    } catch (err) {
      setError("Failed to validate reset link");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setResetting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        setResetting(false);
        return;
      }

      // Session cookie is set automatically by the server response
      login(data.user);

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg">
        <p className="text-arena-muted">Validating reset link...</p>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg p-4">
        <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md">
          <h1 className="text-xl font-bold mb-4">Reset Password</h1>
          <p className="text-sm text-arena-con mb-4">{error}</p>
          <a href="/" className="text-arena-accent hover:underline text-sm">
            ← Return home
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg">
        <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md text-center">
          <p className="text-arena-accent font-medium mb-2">✓ Success!</p>
          <p className="text-sm text-arena-muted">
            Your password has been reset. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-arena-bg p-4">
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md">
        <h1 className="text-xl font-bold mb-2">Set New Password</h1>
        <p className="text-sm text-arena-muted mb-6">
          Enter a new password for {maskedEmail}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="text"
              value={maskedEmail}
              disabled
              className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm opacity-60"
            />
            <p className="text-xs text-arena-muted mt-1">
              (shown for confirmation, cannot be changed)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={resetting}
              className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent disabled:opacity-50"
              placeholder="••••••••"
            />
            <p className="text-xs text-arena-muted mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={resetting}
              className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-arena-con">{error}</p>}

          <div className="flex gap-3">
            <a
              href="/"
              className="flex-1 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors text-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={resetting}
              className="flex-1 px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50"
            >
              {resetting ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-arena-bg">
          <p className="text-arena-muted">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
