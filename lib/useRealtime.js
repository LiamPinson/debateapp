// ============================================================
// useRealtime hooks — Supabase realtime subscriptions
// ============================================================
// All hooks share the singleton browser client so there is only
// one WebSocket connection to Supabase.  Callbacks are held in
// refs so the subscription never tears down when the parent
// re-renders with a new closure.
// ============================================================

"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "./supabase";

// ── helpers ──────────────────────────────────────────────────
// Keep the latest callback in a ref so the subscription channel
// doesn't re-subscribe every time the parent renders.
function useStableCallback(cb) {
  const ref = useRef(cb);
  ref.current = cb;
  return ref;
}

/**
 * Subscribe to matchmaking queue changes for a specific queue entry.
 * Fires callback when status changes to 'matched'.
 */
export function useRealtimeMatch(queueId, onMatch) {
  const cbRef = useStableCallback(onMatch);

  useEffect(() => {
    if (!queueId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`queue:${queueId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matchmaking_queue",
          filter: `id=eq.${queueId}`,
        },
        (payload) => {
          if (payload.new.status === "matched" && payload.new.debate_id) {
            cbRef.current({
              debateId: payload.new.debate_id,
              matchedWith: payload.new.matched_with,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueId]); // cbRef is stable — no need in deps
}

/**
 * Subscribe to debate state changes (phase transitions, completion).
 */
export function useRealtimeDebate(debateId, onChange) {
  const cbRef = useStableCallback(onChange);

  useEffect(() => {
    if (!debateId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`debate:${debateId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "debates",
          filter: `id=eq.${debateId}`,
        },
        (payload) => {
          cbRef.current(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debateId]); // cbRef is stable — no need in deps
}

/**
 * Subscribe to user notifications (match found, scoring complete, etc.)
 */
export function useRealtimeNotifications(userId, onNotification) {
  const cbRef = useStableCallback(onNotification);

  useEffect(() => {
    if (!userId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          cbRef.current(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]); // cbRef is stable — no need in deps
}

/**
 * Poll-based matchmaking fallback.
 * Polls via the API route (service role) instead of direct Supabase,
 * so it works for guest users regardless of RLS policies.
 */
export function useMatchPolling(queueId, onMatch, intervalMs = 3000) {
  const cbRef = useStableCallback(onMatch);

  useEffect(() => {
    if (!queueId) return;

    let active = true;

    const poll = async () => {
      if (!active) return;

      try {
        const res = await fetch(`/api/matchmaking/queue?queueId=${queueId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.status === "matched" && data?.debate_id) {
            cbRef.current({
              debateId: data.debate_id,
              matchedWith: data.matched_with,
            });
            return; // Stop polling
          }
        }
      } catch {
        // Ignore transient network errors — keep polling
      }

      if (active) {
        setTimeout(poll, intervalMs);
      }
    };

    // Start polling after a short delay (give realtime a chance first)
    const timeout = setTimeout(poll, intervalMs);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [queueId, intervalMs]); // cbRef is stable — no need in deps
}
