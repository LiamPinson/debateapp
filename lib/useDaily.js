// ============================================================
// useDaily — React hook for Daily.co audio calls
// ============================================================
// Wraps daily-js to provide a simple interface for the debate room:
// - Join/leave a call
// - Mute/unmute local mic
// - Mute/unmute remote audio output (via audio element .muted)
// - Track participant state (who's connected, who's speaking)
// - Real audio level monitoring via Web Audio API
//
// IMPORTANT: Daily.co's createCallObject() does NOT auto-play remote audio.
// We must manually create <audio> elements and call .play() for each remote
// participant's track. This hook handles that via playRemoteAudio().
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
  const audioElementsRef = useRef({}); // { participantId: HTMLAudioElement } — remote playback
  const remoteMutedRef = useRef(false); // Mirror of state.remoteMuted for use in event handlers

  const [state, setState] = useState({
    status: "idle", // idle, joining, joined, left, error
    participants: {}, // { participantId: { user_name, audio, video, local } }
    localMuted: false, // Starts UNMUTED (audio enabled)
    remoteMuted: false, // Starts UNMUTED (remote audio enabled)
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
   * Create an <audio> element for a remote participant's track and call .play().
   *
   * In createCallObject mode, Daily.co does NOT auto-play remote audio.
   * We must create audio elements manually and attach the MediaStreamTrack.
   * Audio elements are appended to document.body (off-screen) so they keep
   * playing regardless of scroll position or component visibility.
   */
  const playRemoteAudio = useCallback((participantId, track) => {
    if (!track) return;

    // Remove any existing audio element for this participant (track may have changed)
    if (audioElementsRef.current[participantId]) {
      const existing = audioElementsRef.current[participantId];
      existing.srcObject = null;
      existing.remove();
      delete audioElementsRef.current[participantId];
    }

    try {
      const audioEl = document.createElement("audio");
      audioEl.id = `daily-audio-${participantId}`;
      audioEl.autoplay = true;
      audioEl.muted = remoteMutedRef.current; // Respect current speaker mute state
      audioEl.srcObject = new MediaStream([track]);
      document.body.appendChild(audioEl);

      audioEl.play().catch((err) => {
        // This can happen due to browser autoplay policies.
        // The audio element will still play once the user interacts with the page.
        console.warn("[Daily] audio.play() blocked (autoplay policy):", err.message);
      });

      audioElementsRef.current[participantId] = audioEl;
      console.log(`[Daily] 🔊 Playing remote audio for ${participantId}`);
    } catch (err) {
      console.warn("[Daily] Failed to create audio element for", participantId, err);
    }
  }, []);

  /**
   * Set up a Web Audio AnalyserNode for audio level visualization.
   * This is separate from playback — it does NOT connect to speakers.
   */
  const setupAnalyser = useCallback((participantId, audioTrack) => {
    if (!audioTrack) return;

    try {
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

      const stream = new MediaStream([audioTrack]);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      // NOT connected to ctx.destination — analyser only, no extra audio output

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analysersRef.current[participantId] = { analyser, source, dataArray };
    } catch (err) {
      console.warn("Audio analyser setup failed for", participantId, err);
    }
  }, []);

  /**
   * Poll all analysers and update audioLevels state (~15fps).
   */
  const pollAudioLevels = useCallback(() => {
    const levels = {};
    for (const [id, { analyser, dataArray }] of Object.entries(
      analysersRef.current
    )) {
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      levels[id] = Math.min(1, rms * 4);
    }

    setState((s) => ({ ...s, audioLevels: levels }));

    animFrameRef.current = requestAnimationFrame(() => {
      setTimeout(() => pollAudioLevels(), 66); // ~15fps
    });
  }, []);

  /**
   * Scan all current participants and ensure:
   * - analysers are set up for level visualization
   * - remote participants have audio elements for playback
   */
  const attachTrackAnalyser = useCallback(
    (call) => {
      const participants = call.participants();
      for (const [id, p] of Object.entries(participants)) {
        const track = p.tracks?.audio?.persistentTrack || p.tracks?.audio?.track;
        if (track && track.readyState === "live") {
          if (!analysersRef.current[id]) {
            setupAnalyser(id, track);
          }
          if (!p.local && !audioElementsRef.current[id]) {
            playRemoteAudio(id, track);
          }
        }
      }
    },
    [setupAnalyser, playRemoteAudio]
  );

  const join = useCallback(async () => {
    if (callRef.current) return; // Already in a call

    const DailyIframe = await getDaily();
    if (!DailyIframe) return;

    setState((s) => ({ ...s, status: "joining" }));

    try {
      // Destroy any lingering global instance
      const existing = DailyIframe.getCallInstance?.();
      if (existing) {
        await existing.destroy();
      }

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      });
      callRef.current = call;

      // ── Event handlers ──────────────────────────────────────────────

      call.on("joined-meeting", () => {
        console.log("[Daily] ✅ joined-meeting");
        setState((s) => ({
          ...s,
          status: "joined",
          participants: mapParticipants(call.participants()),
        }));
        attachTrackAnalyser(call);
        pollAudioLevels();
      });

      call.on("participant-joined", (ev) => {
        console.log("[Daily] 👤 participant-joined:", ev.participant?.user_name);
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
        attachTrackAnalyser(call);
      });

      call.on("participant-updated", () => {
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
        attachTrackAnalyser(call);
      });

      call.on("participant-left", (ev) => {
        const leftId = ev?.participant?.session_id;
        if (leftId) {
          // Clean up analyser
          if (analysersRef.current[leftId]) {
            try { analysersRef.current[leftId].source.disconnect(); } catch (_) {}
            delete analysersRef.current[leftId];
          }
          // Clean up audio element
          if (audioElementsRef.current[leftId]) {
            audioElementsRef.current[leftId].srcObject = null;
            audioElementsRef.current[leftId].remove();
            delete audioElementsRef.current[leftId];
          }
        }
        setState((s) => ({
          ...s,
          participants: mapParticipants(call.participants()),
        }));
      });

      // track-started fires when a remote participant's track becomes available.
      // This is the KEY moment to create the <audio> element for remote playback.
      call.on("track-started", (ev) => {
        console.log("[Daily] 🎵 track-started:", {
          kind: ev.track?.kind,
          participant: ev.participant?.user_name,
          local: ev.participant?.local,
        });
        if (ev.track?.kind === "audio" && ev.participant) {
          const pid =
            ev.participant.session_id || ev.participant.user_id || "unknown";

          // Set up analyser for level indicator (works for local + remote)
          setupAnalyser(pid, ev.track);

          // For REMOTE participants: create <audio> element and play the track.
          // createCallObject mode requires this — Daily.co will NOT play it automatically.
          if (!ev.participant.local) {
            console.log(`[Daily] 🔊 Creating audio element for remote participant ${pid}`);
            playRemoteAudio(pid, ev.track);
          }
        }
      });

      // Clean up audio element when a track stops
      call.on("track-stopped", (ev) => {
        if (ev.track?.kind === "audio" && ev.participant && !ev.participant.local) {
          const pid = ev.participant.session_id || ev.participant.user_id || "unknown";
          if (audioElementsRef.current[pid]) {
            audioElementsRef.current[pid].srcObject = null;
            audioElementsRef.current[pid].remove();
            delete audioElementsRef.current[pid];
            console.log(`[Daily] 🔇 Removed audio element for ${pid}`);
          }
        }
      });

      call.on("error", (ev) => {
        console.error("❌ [Daily] error:", ev.errorMsg);
        setState((s) => ({ ...s, status: "error", error: ev.errorMsg }));
      });

      call.on("left-meeting", () => {
        setState((s) => ({ ...s, status: "left" }));
        cleanupAudio();
        callRef.current = null;
      });

      // ── Join the room ────────────────────────────────────────────────
      console.log("[Daily] 📍 Joining room:", roomUrl);
      await call.join({
        url: roomUrl,
        token,
        startVideoOff: true,
        startAudioOff: false,
      });
      console.log("[Daily] ✅ Join succeeded");

      // Explicitly enable local audio transmission
      await call.setLocalAudio(true);
      console.log("[Daily] 🎤 Local audio enabled");

    } catch (err) {
      console.error("[Daily] Join failed:", err);
      setState((s) => ({ ...s, status: "error", error: err.message }));
    }
  }, [roomUrl, token, getDaily, attachTrackAnalyser, pollAudioLevels, setupAnalyser, playRemoteAudio]);

  /**
   * Clean up all Web Audio resources and audio elements.
   */
  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    for (const [, { source }] of Object.entries(analysersRef.current)) {
      try { source.disconnect(); } catch (_) {}
    }
    analysersRef.current = {};
    for (const [, audioEl] of Object.entries(audioElementsRef.current)) {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (_) {}
    }
    audioElementsRef.current = {};
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

  const toggleRemoteMute = useCallback(() => {
    const newRemoteMuted = !remoteMutedRef.current;
    remoteMutedRef.current = newRemoteMuted;
    // Mute/unmute all remote audio elements directly
    for (const [, audioEl] of Object.entries(audioElementsRef.current)) {
      audioEl.muted = newRemoteMuted;
    }
    setState((s) => ({ ...s, remoteMuted: newRemoteMuted }));
  }, []);

  const setRemoteMuted = useCallback((muted) => {
    remoteMutedRef.current = muted;
    for (const [, audioEl] of Object.entries(audioElementsRef.current)) {
      audioEl.muted = muted;
    }
    setState((s) => ({ ...s, remoteMuted: muted }));
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
    toggleRemoteMute,
    setRemoteMuted,
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
