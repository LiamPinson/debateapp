"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileCustomizationModal({ open, oauthData, onClose }) {
  const router = useRouter();
  const [username, setUsername] = useState(oauthData?.user_name || "");
  const [avatarPreview, setAvatarPreview] = useState(oauthData?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState(null);

  if (!open) return null;

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    setUsernameError(null);

    // Basic validation: 3-20 chars, alphanumeric + underscore
    if (value && (value.length < 3 || value.length > 20)) {
      setUsernameError("Username must be 3-20 characters");
    } else if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError("Username can only contain letters, numbers, and underscores");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result);
        setAvatarFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || username.length < 3 || username.length > 20) {
      setUsernameError("Username must be 3-20 characters");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("username", username);
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      } else if (avatarPreview) {
        formData.append("avatarUrl", avatarPreview);
      }

      const response = await fetch("/api/auth/oauth-profile-complete", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to create account");
        return;
      }

      // Success - redirect home
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Clear session and redirect to home
    localStorage.removeItem("debate_session_token");
    onClose();
    router.push("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-2">Complete Your Profile</h2>
        <p className="text-sm text-arena-muted mb-6">Customize your username and profile picture for the platform.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            {avatarPreview && (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover border border-arena-border"
              />
            )}
            <label className="cursor-pointer">
              <div className="px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors">
                {avatarPreview ? "Change Picture" : "Upload Picture"}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
            {!avatarPreview && oauthData?.avatar_url && (
              <p className="text-xs text-arena-muted">X profile image shown as default</p>
            )}
          </div>

          {/* Username Section */}
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={handleUsernameChange}
              maxLength={20}
              required
              autoFocus
              className="w-full bg-arena-bg border border-arena-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-arena-accent"
              placeholder="Choose a username"
            />
            {usernameError && (
              <p className="text-xs text-arena-con mt-1">{usernameError}</p>
            )}
            <p className="text-xs text-arena-muted mt-1">3-20 characters, letters/numbers/underscores only</p>
          </div>

          {error && <p className="text-sm text-arena-con">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username || usernameError}
              className="flex-1 px-4 py-2 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
