// ============================================================
// useDaily — React hook for Daily.co audio calls
// ============================================================
// Wraps daily-js to provide a simple interface for the debate room:
// - Join/leave a call
// - Mute/unmute
// - Track participant state (who's connected, who's speaking)
// - Real audio level monitoring via Web Audio API
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
  const audioContextRef = useRef(null);
  const analysersRef = useRef({}); // { participantId: { analyser, source, dataArray } }
  const animFrameRef = useRef(null);

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

  /**
   * Set up a Web Audio AnalyserNode for a participant's audio track.
   * Returns cleanup function.
   */
  const setupAnalyser = useCallback((participantId, audioTrack) => {
    if (!audioTrack) return;

    try {
      // Create AudioContext lazily (one per hook instance)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      // Clean up existing analyser for this participant
      if (analysersRef.current[participantId]) {
        try {
          analysersRef.current[participantId].source.disconnect();
        } catch (_) {}
        delete analysersRef.current[participantId];
      }

      // Create MediaStream from the track and connect to analyser
      const stream = new MediaStream([audioTrack]);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      // Don't connect to destination — we only want to analyze, not play through speakers
      // (Daily.co handles playback separately)

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analysersRef.current[participantId] = { analyser, source, dataArray };
    } catch (err) {
      console.warn("Audio analyser setup failed for", participantId, err);
    }
  }, []);

  /**
   * Poll all analysers and update audioLevels state.
   * Runs on requestAnimationFrame loop.
   */
  const pollAudioLevels = useCallback(() => {
    const levels = {};
    for (const [id, { analyser, dataArray }] of Object.entries(
      analysersRef.current
    )) {
      analyser.getByteTimeDomainData(dataArray);
      // Compute RMS (root mean square) for a true volume level
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128; // center around 0
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      // Scale to 0-1 range; typical speech RMS is 0.05-0.3
      levels[id] = Math.min(1, rms * 4);
    }

    setState((s) => ({ ...s, audioLevels: levels }));

    // Continue loop
    animFrameRef.current = requestAnimationFrame(() => {
      // Throttle to ~15fps for performance
      setTimeout(() => pollAudioLevels(), 66);
    });
  }, []);

  /**
   * Attach audio analyser when participant tracks become available.
   */
  const attachTrackAnalyser = useCallback(
    (call) => {
      const participants = call.participants();
      for (const [id, p] of Object.entries(participants)) {
        // Get the audio track
        const track = p.tracks?.audio?.persistentTrack || p.tracks?.audio?.track;
        if (track && track.readyState === "live") {
          if (!analysersRef.current[id]) {
            setupAnalyser(id, track);
          }
        }
      }
    },
    [setupAnalyser]
  );

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
      call.on("joined-meeting", () => {
        setState((s) => ({
          ...s,
          status: "joined",
          participants: mapParticipants(call.participants()),
        }));
        // Set up audio analysers for all current participants
        attachTrackAnalyser(call);
        // Start the audio level polling loop
        pollAudioLevels();
      });

      call.on("participant-joined", () => {
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
        // New participant — try to attach analyser
        attachTrackAnalyser(call);
      });

      call.on("participant-updated", () => {
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
        // Track may have changed — re-check
        attachTrackAnalyser(call);
      });

      call.on("participant-left", (ev) => {
        // Clean up analyser for departed participant
        const leftId = ev?.participant?.session_id;
        if (leftId && analysersRef.current[leftId]) {
          try {
            analysersRef.current[leftId].source.disconnect();
          } catch (_) {}
          delete analysersRef.current[leftId];
        }
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
      });

      // Track started — reliable moment to set up analyser
      call.on("track-started", (ev) => {
        if (ev.track?.kind === "audio" && ev.participant) {
          const pid =
            ev.participant.session_id || ev.participant.user_id || "unknown";
          setupAnalyser(pid, ev.track);
        }
      });

      call.on("error", (ev) => {
        console.error("Daily error:", ev);
        setState((s) => ({ ...s, status: "error", error: ev.errorMsg }));
      });

      call.on("left-meeting", () => {
        setState((s) => ({ ...s, status: "left" }));
        // Clean up all audio resources
        cleanupAudio();
        callRef.current = null;
      });

      // Join the room
      await call.join({
        url: roomUrl,
        token,
        startVideoOff: true,
        startAudioOff: false,
      });
    } catch (err) {
      console.error("Join failed:", err);
      setState((s) => ({ ...s, status: "error", error: err.message }));
    }
  }, [roomUrl, token, getDaily, attachTrackAnalyser, pollAudioLevels, setupAnalyser]);

  /**
   * Clean up all Web Audio resources.
   */
  const cleanupAudio = useCallback(() => {
    // Stop animation frame loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    // Disconnect all analysers
    for (const [, { source }] of Object.entries(analysersRef.current)) {
      try {
        source.disconnect();
      } catch (_) {}
    }
    analysersRef.current = {};
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const leave = useCallback(async () => {
    if (callRef.current) {
      await callRef.current.leave();
      await callRef.current.destroy();
      callRef.current = null;
    }
    cleanupAudio();
  }, [cleanupAudio]);

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
        callRef.current
          .leave()
          .then(() => callRef.current?.destroy())
          .catch(() => {});
      }
      cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, roomUrl, token]);

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

export default useDaily;
