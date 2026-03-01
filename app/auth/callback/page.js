"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOAuthClient } from "@/lib/supabase";
import { loginWithOAuth } from "@/lib/api-client";
import { useSession } from "@/lib/SessionContext";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useSession();
  const [error, setError] = useState(null);

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

        // Session cookie is set automatically by the server response
        login(result.user);
        router.push("/");
      } catch (err) {
        setError(err.message);
      }
    }

    handleCallback();
  }, []);

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
