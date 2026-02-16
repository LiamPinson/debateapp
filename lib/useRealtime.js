// ============================================================
// useRealtimeMatch — Supabase realtime for matchmaking
// ============================================================
// Subscribes to queue updates and notifications so the client
// knows instantly when a match is found.
// ============================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "./supabase";

/**
 * Subscribe to matchmaking queue changes for a specific queue entry.
 * Fires callback when status changes to 'matched'.
 *
 * @param {string} queueId - The queue entry to watch
 * @param {Function} onMatch - Called with match data when matched
 */
export function useRealtimeMatch(queueId, onMatch) {
  const supabaseRef = useRef(null);

  useEffect(() => {
    if (!queueId) return;

    const supabase = createBrowserClient();
    supabaseRef.current = supabase;

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
          if (payload.new.status === "matched") {
            onMatch({
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
  }, [queueId, onMatch]);
}

/**
 * Subscribe to debate state changes (phase transitions, completion).
 *
 * @param {string} debateId
 * @param {Function} onChange - Called with updated debate data
 */
export function useRealtimeDebate(debateId, onChange) {
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
          onChange(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debateId, onChange]);
}

/**
 * Subscribe to user notifications (match found, scoring complete, etc.)
 *
 * @param {string} userId
 * @param {Function} onNotification - Called with new notification
 */
export function useRealtimeNotifications(userId, onNotification) {
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
          onNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNotification]);
}

/**
 * Poll-based matchmaking fallback.
 * In case realtime subscription misses an update, poll every few seconds.
 * This is a safety net — realtime should handle 99% of cases.
 */
export function useMatchPolling(queueId, onMatch, intervalMs = 3000) {
  useEffect(() => {
    if (!queueId) return;

    const supabase = createBrowserClient();
    let active = true;

    const poll = async () => {
      if (!active) return;

      const { data } = await supabase
        .from("matchmaking_queue")
        .select("status, debate_id, matched_with")
        .eq("id", queueId)
        .single();

      if (data?.status === "matched") {
        onMatch({
          debateId: data.debate_id,
          matchedWith: data.matched_with,
        });
        return; // Stop polling
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
  }, [queueId, onMatch, intervalMs]);
}
