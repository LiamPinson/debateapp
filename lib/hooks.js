// ============================================================
// React Query Hooks
// ============================================================
// Wraps api-client functions with React Query for automatic
// caching, deduplication, background refetching, and retry.
// ============================================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDebateDetail,
  getVoteTally,
  getNotifications,
  markAllNotificationsRead,
  getProfile,
  getChallenges,
  getApprovedCustomTopics,
} from "./api-client";

// ── Query key factories ──────────────────────────────────────
// Centralized keys prevent stale-cache bugs.

export const queryKeys = {
  debate: (id) => ["debate", id],
  votes: (debateId) => ["votes", debateId],
  notifications: (userId) => ["notifications", userId],
  profile: (userId) => ["profile", userId],
  challenges: (userId, type) => ["challenges", userId, type],
  customTopics: () => ["customTopics"],
};

// ── Debate ───────────────────────────────────────────────────

export function useDebateDetail(debateId, options = {}) {
  return useQuery({
    queryKey: queryKeys.debate(debateId),
    queryFn: () => getDebateDetail(debateId),
    enabled: !!debateId,
    ...options,
  });
}

export function useVoteTally(debateId, options = {}) {
  return useQuery({
    queryKey: queryKeys.votes(debateId),
    queryFn: () => getVoteTally(debateId),
    enabled: !!debateId,
    ...options,
  });
}

// ── Notifications ────────────────────────────────────────────

export function useNotifications(userId, options = {}) {
  return useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: () => getNotifications(userId, { limit: 20 }),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // poll every minute
    ...options,
  });
}

export function useMarkAllRead(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  });
}

// ── Profile ──────────────────────────────────────────────────

export function useProfile(userId, options = {}) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => getProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

// ── Challenges ───────────────────────────────────────────────

export function useChallenges(userId, type = "received", options = {}) {
  return useQuery({
    queryKey: queryKeys.challenges(userId, type),
    queryFn: () => getChallenges(userId, type),
    enabled: !!userId,
    ...options,
  });
}

// ── Custom Topics ────────────────────────────────────────────

export function useApprovedTopics(options = {}) {
  return useQuery({
    queryKey: queryKeys.customTopics(),
    queryFn: getApprovedCustomTopics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}
