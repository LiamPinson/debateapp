"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOAuthClient } from "@/lib/supabase";
import { loginWithOAuth } from "@/lib/api-client";
import { useSession } from "@/lib/SessionContext";
import ProfileCustomizationModal from "@/app/components/ProfileCustomizationModal";

const SESSION_KEY = "debate_session_token";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useSession();
  const [error, setError] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [oauthData, setOauthData] = useState(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (!code) {
          setError("No authorization code found.");
          return;
        }

        const supabase = createOAuthClient();
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError || !data?.session) {
          setError(exchangeError?.message || "Failed to exchange code for session.");
          return;
        }

        const result = await loginWithOAuth(data.session.access_token);

        if (result.error) {
          setError(result.error);
          return;
        }

        localStorage.setItem(SESSION_KEY, result.sessionToken);
        login(result.user);

        // Check if new user - if so, show profile customization modal
        if (result.isNewUser) {
          setOauthData({
            user_name: data.session.user?.user_metadata?.user_name,
            avatar_url: data.session.user?.user_metadata?.avatar_url,
            access_token: data.session.access_token,
          });
          setShowProfileModal(true);
        } else {
          router.push("/");
        }
      } catch (err) {
        setError(err.message);
      }
    }

    handleCallback();
  }, []);

  if (showProfileModal && oauthData) {
    return (
      <ProfileCustomizationModal
        open={true}
        oauthData={oauthData}
        onClose={() => {
          setShowProfileModal(false);
          router.push("/");
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg">
        <div className="text-center">
          <p className="text-arena-con mb-4">{error}</p>
          <a href="/" className="text-arena-accent hover:underline text-sm">
            Return home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-arena-bg">
      <div className="text-center text-arena-muted text-sm">Signing you in...</div>
    </div>
  );
}
