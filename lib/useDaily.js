// ============================================================
// useDaily — React hook for Daily.co audio calls
// ============================================================
// Wraps daily-js to provide a simple interface for the debate room:
// - Join/leave a call
// - Mute/unmute
// - Track participant state (who's connected, who's speaking)
// - Audio level monitoring for volume bars
// ============================================================

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * @param {Object} opts
 * @param {string} opts.roomUrl - Full Daily.co room URL
 * @param {string} opts.token - Meeting token for this participant
 * @param {boolean} opts.autoJoin - Join immediately on mount
 * @returns {Object} Daily call state and controls
 */
export function useDaily({ roomUrl, token, autoJoin = false }) {
  const callRef = useRef(null);
  const [state, setState] = useState({
    status: "idle", // idle, joining, joined, left, error
    participants: {}, // { participantId: { user_name, audio, video, local } }
    localMuted: false,
    error: null,
    audioLevels: {}, // { participantId: number 0-1 }
  });

  // Dynamically import daily-js (it's a heavy client-side only lib)
  const getDaily = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const DailyIframe = (await import("@daily-co/daily-js")).default;
    return DailyIframe;
  }, []);

  const join = useCallback(async () => {
    if (callRef.current) return; // Already in a call

    const DailyIframe = await getDaily();
    if (!DailyIframe) return;

    setState((s) => ({ ...s, status: "joining" }));

    try {
      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false, // Audio only
      });
      callRef.current = call;

      // Event handlers
      call.on("joined-meeting", (ev) => {
        setState((s) => ({
          ...s,
          status: "joined",
          participants: mapParticipants(call.participants()),
        }));
      });

      call.on("participant-joined", () => {
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
      });

      call.on("participant-updated", () => {
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
      });

      call.on("participant-left", () => {
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
      });

      call.on("error", (ev) => {
        console.error("Daily error:", ev);
        setState((s) => ({ ...s, status: "error", error: ev.errorMsg }));
      });

      call.on("left-meeting", () => {
        setState((s) => ({ ...s, status: "left" }));
        callRef.current = null;
      });

      // Join the room
      await call.join({
        url: roomUrl,
        token,
        startVideoOff: true,
        startAudioOff: false,
      });

      // Start audio level monitoring
      startAudioLevelMonitoring(call, setState);
    } catch (err) {
      console.error("Join failed:", err);
      setState((s) => ({ ...s, status: "error", error: err.message }));
    }
  }, [roomUrl, token, getDaily]);

  const leave = useCallback(async () => {
    if (callRef.current) {
      await callRef.current.leave();
      await callRef.current.destroy();
      callRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const newMuted = !state.localMuted;
    callRef.current.setLocalAudio(!newMuted);
    setState((s) => ({ ...s, localMuted: newMuted }));
  }, [state.localMuted]);

  const setMuted = useCallback((muted) => {
    if (!callRef.current) return;
    callRef.current.setLocalAudio(!muted);
    setState((s) => ({ ...s, localMuted: muted }));
  }, []);

  // Auto-join on mount if requested
  useEffect(() => {
    if (autoJoin && roomUrl && token) {
      join();
    }
    return () => {
      if (callRef.current) {
        callRef.current.leave().then(() => callRef.current?.destroy());
      }
    };
  }, [autoJoin, roomUrl, token, join]);

  return {
    ...state,
    join,
    leave,
    toggleMute,
    setMuted,
    callObject: callRef.current,
  };
}

/**
 * Map Daily.co participants to a simpler format.
 */
function mapParticipants(dailyParticipants) {
  const mapped = {};
  for (const [id, p] of Object.entries(dailyParticipants || {})) {
    mapped[id] = {
      id,
      user_name: p.user_name || "Unknown",
      audio: p.audio,
      video: p.video,
      local: p.local,
      joined_at: p.joined_at,
    };
  }
  return mapped;
}

/**
 * Monitor audio levels for volume bar visualization.
 * Uses requestAnimationFrame for smooth updates.
 */
function startAudioLevelMonitoring(call, setState) {
  let active = true;

  const poll = () => {
    if (!active || !call) return;

    try {
      const participants = call.participants();
      const levels = {};
      for (const [id, p] of Object.entries(participants)) {
        // Daily.co doesn't expose raw audio levels directly in all cases.
        // We approximate: if audio is on and they're not muted, assume speaking.
        // For real volume bars, you'd use the Web Audio API on the MediaStream.
        levels[id] = p.audio ? 0.3 + Math.random() * 0.4 : 0; // Simulated for now
      }
      setState((s) => ({ ...s, audioLevels: levels }));
    } catch (_) {}

    setTimeout(() => requestAnimationFrame(poll), 150);
  };

  requestAnimationFrame(poll);

  // Return cleanup function
  call.on("left-meeting", () => {
    active = false;
  });
}

export default useDaily;
