"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { createBrowserClient } from "@/lib/supabase";
import { useRealtimeDebate } from "@/lib/useRealtime";
import { useDaily } from "@/lib/useDaily";
import {
  getDebateDetail,
  getDailyToken,
  requestSideSwap,
  setReady,
  advancePhase,
  completeDebate,
  forfeitDebate,
  cancelDebate,
  castVote,
  getVoteTally,
} from "@/lib/api-client";
import PhaseTimer, { getPhaseDuration } from "../../components/PhaseTimer";
import AudioLevelBar from "../../components/AudioLevelBar";
import RankBadge from "../../components/RankBadge";
import ScoreBar from "../../components/ScoreBar";
import VoteBar from "../../components/VoteBar";

const PHASE_ORDER = [
  "prematch",
  "opening_pro",
  "opening_con",
  "freeflow",
  "closing_con",
  "closing_pro",
  "ended",
];

// Status priority for rejecting stale Realtime events that would regress state.
// When a postgres_changes event arrives with an earlier status than the client
// already has, the update is dropped to prevent infinite prematch↔in_progress loops.
const STATUS_PRIORITY = {
  prematch: 0,
  in_progress: 1,
  forfeiting: 2,
  completed: 3,
  forfeited: 3,
  cancelled: 3,
  pipeline_failed: 3,
};

export default function DebateClient({ initialDebate, params }) {
  const { id: debateId } = params;
  const router = useRouter();
  const { user, session } = useSession();
  const [debate, setDebateRaw] = useState(initialDebate || null);

  // Guarded setter — NEVER allows status to regress (e.g. in_progress → prematch).
  // Every external data merge must use this instead of setDebateRaw.
  const setDebate = useCallback((updater) => {
    setDebateRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!next || !prev) return next;
      const prevP = STATUS_PRIORITY[prev.status] ?? -1;
      const nextP = STATUS_PRIORITY[next.status] ?? -1;
      if (nextP < prevP) {
        // Block regression — keep current status/phase, merge everything else
        return { ...next, status: prev.status, phase: prev.phase };
      }
      return next;
    });
  }, []);
  const [loading, setLoading] = useState(!initialDebate);
  const [dailyToken, setDailyToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [votes, setVotes] = useState(null);
  const [voted, setVoted] = useState(false);

  // ── Mutual readiness state ──
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const readyChannelRef = useRef(null);

  // ── Prematch countdown ──
  const [prematchSecondsLeft, setPrematchSecondsLeft] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // ── Forfeiting stuck detection ──
  const [forfeitingStuck, setForfeitingStuck] = useState(false);
  const forfeitingTimerRef = useRef(null);

  // Determine which side the current user is on
  const mySide =
    debate?.pro_user_id === user?.id ||
    debate?.pro_session_id === session?.session_id
      ? "pro"
      : debate?.con_user_id === user?.id ||
        debate?.con_session_id === session?.session_id
      ? "con"
      : null;

  // Always fetch latest state on mount — SSR data may be stale (e.g. debate
  // transitioned to in_progress between SSR and client hydration).
  useEffect(() => {
    getDebateDetail(debateId)
      .then((data) => {
        const fresh = data?.debate || data;
        if (fresh) {
          setDebate((prev) => ({ ...prev, ...fresh }));
          // Sync ready flags from DB
          if (fresh.pro_ready && fresh.con_ready) {
            setMyReady(true);
            setOpponentReady(true);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Initial debate fetch failed:", err);
        setLoading(false);
      });
  }, [debateId]);

  // Realtime debate updates — guard against stale events that would regress status.
  // When both players ready up, the server does two sequential DB updates:
  // (1) mark ready (status stays "prematch"), (2) start debate (status → "in_progress").
  // Both fire postgres_changes events. If event (1) arrives after the client already
  // has the "in_progress" state, blindly merging would reset to "prematch" and create
  // an infinite loop (prematch poll restarts, auto-cancel fires, ready channel cycles).
  const onDebateChange = useCallback((updated) => {
    console.log("[Realtime] debate change received:", {
      newStatus: updated?.status,
      newPhase: updated?.phase,
      readyFlags: { pro: updated?.pro_ready, con: updated?.con_ready }
    });
    setDebate((prev) => {
      const prevPriority = STATUS_PRIORITY[prev?.status] ?? -1;
      const newPriority = STATUS_PRIORITY[updated?.status] ?? -1;
      if (updated?.status && newPriority < prevPriority) {
        // Stale event — keep current status/phase but merge other fields (e.g. ready flags)
        console.log("[Realtime] BLOCKED stale event:", {
          prevStatus: prev?.status,
          attemptedStatus: updated?.status
        });
        const { status, phase, ...rest } = updated;
        return { ...prev, ...rest };
      }
      return { ...prev, ...updated };
    });
  }, []);
  useRealtimeDebate(debateId, onDebateChange);

  // ── FIX 3: Pre-fetch Daily.co token as soon as we know our side ──
  // Don't wait for in_progress — fetch during prematch so audio connects instantly on start.
  useEffect(() => {
    if (!debate || dailyToken || tokenLoading) return;
    if (!mySide) return;
    // Fetch token for prematch or in_progress (not completed/forfeited)
    if (debate.status !== "prematch" && debate.status !== "in_progress") return;

    setTokenLoading(true);
    getDailyToken(debateId, user?.id, session?.session_id, mySide)
      .then((data) => {
        if (data && !data.error) {
          setDailyToken(data);
        } else {
          console.error("Token fetch error:", data?.error);
        }
      })
      .catch((err) => console.error("Token fetch failed:", err))
      .finally(() => setTokenLoading(false));
  }, [debate?.status, debateId, user?.id, session?.session_id, mySide, dailyToken, tokenLoading]);

  // Daily.co audio — auto-join when we have a token AND debate is in_progress
  // During prematch we hold the token but don't join yet (no need to burn Daily minutes).
  const daily = useDaily({
    roomUrl: dailyToken?.room_url || "",
    token: dailyToken?.token || "",
    autoJoin: !!dailyToken?.token && debate?.status === "in_progress",
  });

  // Load votes for completed debates
  useEffect(() => {
    if (debate?.status === "completed") {
      getVoteTally(debateId).then((data) => setVotes(data));
    }
  }, [debate?.status, debateId]);

  // ── Mutual readiness via Supabase Realtime broadcast channel ──
  // Uses the singleton browser client so there's only one WebSocket.
  useEffect(() => {
    if (!debateId || !mySide || debate?.status !== "prematch") return;

    const supabase = createBrowserClient();
    const channel = supabase.channel(`ready:${debateId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "ready" }, (payload) => {
        const { side } = payload.payload;
        if (side !== mySide) {
          setOpponentReady(true);
        }
      })
      .subscribe((status, err) => {
        if (err) console.error(`[Realtime] ready:${debateId} error:`, err);
        else console.log(`[Realtime] ready:${debateId} →`, status);
      });

    readyChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      readyChannelRef.current = null;
    };
  }, [debateId, mySide, debate?.status]);

  // ── Unified prematch poll + countdown timer ──
  // Single effect handles: (a) 1 s polling for ready-flag sync & status
  // transitions, and (b) 60 s countdown that auto-cancels with retry.
  // Merging the two prevents the old bug where the countdown fired
  // cancelDebate() once, swallowed errors, and never retried.
  useEffect(() => {
    if (debate?.status !== "prematch" || !debate?.created_at) return;

    const PREMATCH_TIMEOUT_S = 60;
    let active = true;
    let cancelInFlight = false;

    const poll = async () => {
      if (!active) return;

      // ── Countdown display ──
      const elapsedMs = Date.now() - new Date(debate.created_at).getTime();
      const remaining = Math.max(0, PREMATCH_TIMEOUT_S - Math.floor(elapsedMs / 1000));
      setPrematchSecondsLeft(remaining);

      // ── EXPIRED: cancel + verify loop (retries every 2 s) ──
      if (remaining <= 0) {
        if (!cancelInFlight) {
          cancelInFlight = true;
          try {
            const result = await cancelDebate(debateId);
            if (!active) return; // effect cleaned up during await
            console.log("Auto-cancel result:", result);
            if (result?.cancelled || result?.alreadyCancelled) {
              setDebate((d) => ({ ...d, status: "cancelled", phase: "ended" }));
              return; // done — cancelled UI will render
            }
            // Debate already transitioned to in_progress — use full response data.
            if (result?.alreadyStarted) {
              setDebate((d) => ({
                ...d,
                status: result.status || "in_progress",
                phase: result.phase || "opening_pro",
                started_at: result.started_at || d.started_at,
              }));
              return; // stop loop
            }
          } catch (err) {
            console.error("Auto-cancel network error:", err);
          }
          cancelInFlight = false;
        }

        if (!active) return;

        // Verify server state even if cancel call failed / returned unexpected result
        try {
          const data = await getDebateDetail(debateId);
          if (!active) return; // effect cleaned up during await
          const updated = data?.debate || data;
          if (updated && updated.status !== "prematch") {
            setDebate((d) => ({ ...d, ...updated }));
            return; // state resolved — stop polling
          }
        } catch (err) {
          console.error("Verify poll error:", err);
        }

        // Still stuck in prematch — retry in 2 s
        if (active) setTimeout(poll, 2000);
        return;
      }

      // ── NORMAL: prematch poll (1 s) ──
      try {
        const data = await getDebateDetail(debateId);
        if (!active) return; // effect cleaned up during await
        const updated = data?.debate || data;
        if (!updated) {
          if (active) setTimeout(poll, 1000);
          return;
        }

        // Status changed from prematch → update & stop
        if (updated.status !== "prematch") {
          setDebate((d) => ({ ...d, ...updated }));
          return;
        }

        // Still prematch — sync the opponent's ready flag from DB
        if (mySide === "pro" && updated.con_ready) setOpponentReady(true);
        if (mySide === "con" && updated.pro_ready) setOpponentReady(true);
      } catch (err) {
        console.error("Prematch poll error:", err);
      }

      if (active) setTimeout(poll, 1000);
    };

    // First poll fires immediately to catch any state that changed
    // between SSR and client hydration.
    poll();

    return () => { active = false; };
  }, [debate?.status, debate?.created_at, debateId, mySide]);

  // Phase advance handler — optimistically update local state on success.
  // Both clients will call this; the atomic CAS on the server means only one
  // wins, but both can safely update their local state to the next phase.
  const handleTimeUp = useCallback(async () => {
    if (!debate || !mySide) return;
    const currentIdx = PHASE_ORDER.indexOf(debate.phase);
    const nextPhase = PHASE_ORDER[currentIdx + 1];
    if (!nextPhase) return;

    if (nextPhase === "ended") {
      const result = await completeDebate(debateId);
      if (!result.error) {
        setDebate((d) => ({
          ...d,
          status: "completed",
          phase: "ended",
          completed_at: new Date().toISOString(),
        }));
      }
    } else {
      const result = await advancePhase(debateId, nextPhase);
      if (!result.error) {
        setDebate((d) => ({ ...d, phase: nextPhase }));
      }
    }
  }, [debate, debateId, mySide]);

  // Poll while in_progress OR in the transitional "forfeiting" state.
  // Keeps polling until we reach a terminal status (completed/forfeited/cancelled).
  // Realtime is unavailable for guests so this is the only way to detect
  // an opponent forfeit or pipeline completion.
  // Also syncs fresh data every tick (defense-in-depth: corrects wrong phase
  // if a stale Realtime event slipped through before the priority guard).
  useEffect(() => {
    const active_status = debate?.status === "in_progress" || debate?.status === "forfeiting";
    if (!active_status) return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const data = await getDebateDetail(debateId);
        if (!active) return;
        const updated = data?.debate || data;
        if (!updated) { if (active) setTimeout(poll, 1000); return; }

        const s = updated.status;
        if (s && s !== "in_progress" && s !== "forfeiting") {
          setDebate((d) => ({ ...d, ...updated }));
          return; // terminal state reached — stop
        }
        // Always sync fresh data (fixes wrong phase, started_at, etc.)
        setDebate((d) => ({ ...d, ...updated }));
      } catch { /* ignore transient errors */ }
      if (active) setTimeout(poll, 1000);
    };

    // Poll every 1 s so forfeit notification is near-instant
    const timeout = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [debate?.status, debateId]);

  // ── Detect stuck "forfeiting" state (pipeline crashed) ──
  // If the debate stays in "forfeiting" for > 30s, the server-side safety net
  // in the detail API should auto-resolve it. Flag it client-side too so we
  // can show a better message instead of an infinite spinner.
  useEffect(() => {
    if (debate?.status === "forfeiting") {
      forfeitingTimerRef.current = setTimeout(() => {
        setForfeitingStuck(true);
      }, 30_000);
      return () => clearTimeout(forfeitingTimerRef.current);
    }
    // Reset when leaving forfeiting state
    setForfeitingStuck(false);
    if (forfeitingTimerRef.current) clearTimeout(forfeitingTimerRef.current);
  }, [debate?.status]);

  // Forfeit handler — navigate home after forfeiting; opponent detects via polling
  const handleForfeit = async () => {
    if (!mySide) return;
    await forfeitDebate(debateId, mySide);
    setForfeitConfirm(false);
    router.push("/");
  };

  // Vote handler
  const handleVote = async (choice) => {
    if (!user?.id || voted) return;
    await castVote(debateId, user.id, choice);
    setVoted(true);
    getVoteTally(debateId).then((data) => setVotes(data));
  };

  // Ready handler — records this side's readiness in DB and broadcasts
  // for instant UI feedback. The server starts the debate when BOTH sides
  // are marked ready, returning the authoritative started_at timestamp so
  // both clients share the same clock origin.
  const handleReady = async () => {
    if (!mySide) return;
    setMyReady(true);

    // Optimistic broadcast so opponent's "✓ Ready" indicator appears quickly.
    if (readyChannelRef.current) {
      readyChannelRef.current.send({
        type: "broadcast",
        event: "ready",
        payload: { side: mySide },
      });
    }

    try {
      const result = await setReady(debateId, mySide);
      if (result?.error) {
        console.error("setReady error:", result.error);
        setMyReady(false); // revert optimistic update
        return;
      }

      // Server confirmed both ready — debate is live. Use response data
      // directly instead of fetching (avoids DB replication lag).
      if (result?.bothReady) {
        setDebate((d) => ({
          ...d,
          status: result.status || "in_progress",
          phase: result.phase || "opening_pro",
          started_at: result.started_at,
          pro_ready: true,
          con_ready: true,
        }));
        setOpponentReady(true);

        // Safety net: if we don't see in_progress after 3 seconds, force-refresh
        setTimeout(() => {
          if (debate?.status === "prematch") {
            console.warn("Safety net: debate still in prematch after ready confirmation, force-refreshing");
            getDebateDetail(debateId).then((data) => {
              const fresh = data?.debate || data;
              if (fresh && fresh.status !== "prematch") {
                setDebate((d) => ({ ...d, ...fresh }));
              }
            });
          }
        }, 3000);
        return;
      }

      // Opponent won the ready race — debate already started.
      if (result?.alreadyStarted) {
        setDebate((d) => ({
          ...d,
          status: result.status || "in_progress",
          phase: result.phase || "opening_pro",
          started_at: result.started_at,
          pro_ready: result.pro_ready,
          con_ready: result.con_ready,
        }));
        setOpponentReady(true);
        return;
      }

      // Only one side ready — sync opponent flag from response or fetch.
      if (mySide === "pro" && result?.con_ready) setOpponentReady(true);
      if (mySide === "con" && result?.pro_ready) setOpponentReady(true);
    } catch (err) {
      console.error("setReady network error:", err);
      setMyReady(false); // revert optimistic update
    }
  };

  // Side swap
  const handleSwap = async () => {
    if (!mySide) return;
    await requestSideSwap(debateId, mySide);
  };

  // Cancel/leave prematch
  const handleCancelPrematch = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const result = await cancelDebate(debateId);
      if (result?.cancelled || result?.alreadyCancelled) {
        setDebate((d) => ({ ...d, status: "cancelled", phase: "ended" }));
      } else if (result?.alreadyStarted) {
        const data = await getDebateDetail(debateId);
        const updated = data?.debate || data;
        if (updated) setDebate((d) => ({ ...d, ...updated }));
      }
    } catch (err) {
      console.error("Cancel prematch error:", err);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="text-center py-20">
        <p className="text-arena-muted">Debate not found.</p>
      </div>
    );
  }

  // ─── PREMATCH ────────────────────────────────────────
  if (debate.status === "prematch") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-arena-surface border border-arena-border rounded-xl p-8 text-center">
          <p className="text-sm text-arena-muted mb-2">Prematch Lobby</p>
          <h2 className="text-2xl font-bold mb-6">
            {debate.topic_title || "Quick Match"}
          </h2>
          {debate.topic_description && (
            <p className="text-sm text-arena-muted mb-6">
              {debate.topic_description}
            </p>
          )}

          <div className="flex items-center justify-center gap-8 mb-8">
            {/* Pro side */}
            <div
              className={`text-center ${
                mySide === "pro"
                  ? "ring-2 ring-arena-pro rounded-xl p-4"
                  : "p-4"
              }`}
            >
              <div className="w-16 h-16 bg-arena-pro/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-arena-pro">P</span>
              </div>
              <p className="font-semibold text-arena-pro">Pro</p>
              <p className="text-sm">
                {debate.pro_username || "Guest"}
              </p>
              {debate.pro_rank_tier && (
                <RankBadge rank={debate.pro_rank_tier} />
              )}
              {mySide === "pro" && (
                <p className="text-xs text-arena-muted mt-1">You</p>
              )}
              {/* Ready indicator for pro */}
              {(mySide === "pro" ? myReady : opponentReady) && (
                <p className="text-xs text-green-400 mt-1 font-medium">
                  ✓ Ready
                </p>
              )}
            </div>

            <span className="text-2xl font-bold text-arena-muted">VS</span>

            {/* Con side */}
            <div
              className={`text-center ${
                mySide === "con"
                  ? "ring-2 ring-arena-con rounded-xl p-4"
                  : "p-4"
              }`}
            >
              <div className="w-16 h-16 bg-arena-con/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-arena-con">C</span>
              </div>
              <p className="font-semibold text-arena-con">Con</p>
              <p className="text-sm">
                {debate.con_username || "Guest"}
              </p>
              {debate.con_rank_tier && (
                <RankBadge rank={debate.con_rank_tier} />
              )}
              {mySide === "con" && (
                <p className="text-xs text-arena-muted mt-1">You</p>
              )}
              {/* Ready indicator for con */}
              {(mySide === "con" ? myReady : opponentReady) && (
                <p className="text-xs text-green-400 mt-1 font-medium">
                  ✓ Ready
                </p>
              )}
            </div>
          </div>

          {/* Token pre-fetch status */}
          {tokenLoading && (
            <p className="text-xs text-arena-muted mb-4">
              Preparing audio connection...
            </p>
          )}

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-4">
              {!myReady && (
                <>
                  <button
                    onClick={handleSwap}
                    className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
                  >
                    Swap Sides
                  </button>
                  <button
                    onClick={handleReady}
                    disabled={!mySide}
                    className="px-8 py-2.5 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50"
                  >
                    Ready
                  </button>
                </>
              )}
              {myReady && !opponentReady && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-arena-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-arena-muted">
                    Waiting for opponent to ready up...
                  </p>
                </div>
              )}
              {myReady && opponentReady && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-green-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-green-400 font-medium">
                    Starting debate...
                  </p>
                </div>
              )}
            </div>

            {/* Prematch countdown */}
            {prematchSecondsLeft !== null && (
              <p className={`text-sm ${prematchSecondsLeft <= 10 ? "text-arena-con font-medium" : "text-arena-muted"}`}>
                Match expires in {prematchSecondsLeft}s
              </p>
            )}

            {/* Leave Match button */}
            <button
              onClick={handleCancelPrematch}
              disabled={cancelling}
              className="px-6 py-2 border border-arena-con/50 text-arena-con rounded-lg text-sm hover:bg-arena-con/10 transition-colors disabled:opacity-50"
            >
              {cancelling ? "Leaving..." : "Leave Match"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CANCELLED ──────────────────────────────────────
  if (debate.status === "cancelled") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-arena-surface border border-arena-border rounded-xl p-8 text-center">
          <p className="text-4xl mb-4">--</p>
          <h2 className="text-2xl font-bold mb-2">Match Cancelled</h2>
          <p className="text-sm text-arena-muted mb-6">
            The match was cancelled because both players did not ready up in time.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIVE DEBATE ─────────────────────────────────────
  if (debate.status === "in_progress") {
    // Safety net: in_progress MUST have a real phase. If a race condition
    // left phase as "prematch", force to "opening_pro" so the timer starts.
    const activePhase = (!debate.phase || debate.phase === "prematch")
      ? "opening_pro"
      : debate.phase;
    const currentSpeaker = activePhase?.includes("pro")
      ? "pro"
      : activePhase?.includes("con")
      ? "con"
      : "both";

    // Map audio levels to pro/con sides.
    // daily.audioLevels is keyed by participant ID. Local is always "local".
    // We map: local participant → mySide, remote participant → opponent side.
    const participantIds = Object.keys(daily.audioLevels || {});
    const localId = participantIds.find(
      (id) => daily.participants[id]?.local
    );
    const remoteId = participantIds.find(
      (id) => !daily.participants[id]?.local
    );

    const proLevel =
      mySide === "pro"
        ? daily.audioLevels[localId] || 0
        : daily.audioLevels[remoteId] || 0;
    const conLevel =
      mySide === "con"
        ? daily.audioLevels[localId] || 0
        : daily.audioLevels[remoteId] || 0;

    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Top bar: topic + phase */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold">
            {debate.topic_title || "Quick Match"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            {PHASE_ORDER.filter((p) => p !== "prematch").map((p) => (
              <div
                key={p}
                className={`w-2 h-2 rounded-full ${
                  p === activePhase
                    ? "bg-arena-accent"
                    : PHASE_ORDER.indexOf(p) <
                      PHASE_ORDER.indexOf(activePhase)
                    ? "bg-arena-accent/40"
                    : "bg-arena-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className="flex justify-center mb-8">
          <PhaseTimer
            phase={activePhase}
            timeLimit={debate.time_limit}
            onTimeUp={handleTimeUp}
            debateStartedAt={debate.started_at}
          />
        </div>

        {/* Debaters */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Pro */}
          <div
            className={`bg-arena-surface border rounded-xl p-4 ${
              currentSpeaker === "pro" || currentSpeaker === "both"
                ? "border-arena-pro"
                : "border-arena-border"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-arena-pro">
                  PRO
                </span>
                <p className="font-medium text-sm">
                  {debate.pro_username || "Guest"}
                </p>
              </div>
              <AudioLevelBar level={proLevel} side="pro" />
            </div>
            {(currentSpeaker === "pro" || currentSpeaker === "both") && (
              <p className="text-xs text-arena-pro animate-pulse">
                Speaking...
              </p>
            )}
          </div>

          {/* Con */}
          <div
            className={`bg-arena-surface border rounded-xl p-4 ${
              currentSpeaker === "con" || currentSpeaker === "both"
                ? "border-arena-con"
                : "border-arena-border"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-arena-con">
                  CON
                </span>
                <p className="font-medium text-sm">
                  {debate.con_username || "Guest"}
                </p>
              </div>
              <AudioLevelBar level={conLevel} side="con" />
            </div>
            {(currentSpeaker === "con" || currentSpeaker === "both") && (
              <p className="text-xs text-arena-con animate-pulse">
                Speaking...
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={daily.toggleMute}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              daily.localMuted
                ? "bg-arena-con/20 text-arena-con border border-arena-con"
                : "bg-arena-surface border border-arena-border hover:bg-arena-border/30"
            }`}
          >
            {daily.localMuted ? "Unmute" : "Mute"}
          </button>

          {!forfeitConfirm ? (
            <button
              onClick={() => setForfeitConfirm(true)}
              className="px-6 py-2.5 border border-arena-con/50 text-arena-con rounded-lg text-sm hover:bg-arena-con/10 transition-colors"
            >
              Forfeit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-arena-con">Are you sure?</span>
              <button
                onClick={handleForfeit}
                className="px-4 py-2 bg-arena-con text-white rounded-lg text-sm"
              >
                Yes, forfeit
              </button>
              <button
                onClick={() => setForfeitConfirm(false)}
                className="px-4 py-2 border border-arena-border rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── FORFEIT RESULTS ─────────────────────────────────
  if (debate.status === "forfeited" && debate.winner_source === "forfeit") {
    const iWon = debate.winner === mySide;
    const winnerName =
      debate.winner === "pro"
        ? debate.pro_username || "Pro"
        : debate.con_username || "Con";

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-2">
          <p className="text-sm text-arena-muted">{debate.topic_title || "Quick Match"}</p>
        </div>

        {/* Outcome banner */}
        <div
          className={`text-center py-8 rounded-xl mb-6 ${
            iWon
              ? "bg-arena-pro/10 border border-arena-pro/30"
              : "bg-arena-con/10 border border-arena-con/30"
          }`}
        >
          <p className="text-4xl mb-3">{iWon ? "🏆" : "🚩"}</p>
          <p className={`text-2xl font-bold mb-1 ${iWon ? "text-arena-pro" : "text-arena-con"}`}>
            {iWon ? "You Win!" : "You Lost"}
          </p>
          <p className="text-sm text-arena-muted">
            {iWon
              ? "Your opponent forfeited the debate."
              : `${winnerName} wins by forfeit.`}
          </p>
        </div>

        {/* Transcript notice */}
        <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-6 text-center">
          <p className="font-semibold mb-1">Transcript &amp; AI Analysis</p>
          <p className="text-sm text-arena-muted">
            The debate recording and full AI analysis will be available on this
            page within 24 hours.
          </p>
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={() => router.push("/")}
            className="px-8 py-2.5 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── COMPLETED RESULTS ───────────────────────────────
  if (debate.status === "completed" || debate.status === "forfeited") {
    const proScore = parseFloat(debate.pro_quality_score) || 0;
    const conScore = parseFloat(debate.con_quality_score) || 0;
    const analysis = debate.ai_qualitative_analysis;

    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-sm text-arena-muted mb-1">Debate Results</p>
          <h2 className="text-2xl font-bold">
            {debate.topic_title || "Quick Match"}
          </h2>
        </div>

        {/* Winner banner */}
        {debate.winner && (
          <div
            className={`text-center py-4 rounded-xl mb-8 ${
              debate.winner === "pro"
                ? "bg-arena-pro/10 border border-arena-pro/30"
                : debate.winner === "con"
                ? "bg-arena-con/10 border border-arena-con/30"
                : "bg-arena-accent/10 border border-arena-accent/30"
            }`}
          >
            <p className="text-lg font-bold">
              {debate.winner === "draw"
                ? "Draw!"
                : `${
                    debate.winner === "pro"
                      ? debate.pro_username || "Pro"
                      : debate.con_username || "Con"
                  } Wins!`}
            </p>
            <p className="text-xs text-arena-muted">
              {debate.winner_source === "ai" ? "AI decision" : "community vote"}
            </p>
          </div>
        )}

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-arena-surface border border-arena-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-arena-pro">
                  PRO
                </span>
                <p className="font-medium">
                  {debate.pro_username || "Guest"}
                </p>
              </div>
              <span className="text-3xl font-bold text-arena-pro">
                {proScore.toFixed(1)}
              </span>
            </div>
            {analysis?.pro && (
              <div className="space-y-2">
                <ScoreBar
                  label="Coherence"
                  score={analysis.pro.coherence || 0}
                  color="pro"
                />
                <ScoreBar
                  label="Evidence"
                  score={analysis.pro.evidence || 0}
                  color="pro"
                />
                <ScoreBar
                  label="Engagement"
                  score={analysis.pro.engagement || 0}
                  color="pro"
                />
              </div>
            )}
          </div>

          <div className="bg-arena-surface border border-arena-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-arena-con">
                  CON
                </span>
                <p className="font-medium">
                  {debate.con_username || "Guest"}
                </p>
              </div>
              <span className="text-3xl font-bold text-arena-con">
                {conScore.toFixed(1)}
              </span>
            </div>
            {analysis?.con && (
              <div className="space-y-2">
                <ScoreBar
                  label="Coherence"
                  score={analysis.con.coherence || 0}
                  color="con"
                />
                <ScoreBar
                  label="Evidence"
                  score={analysis.con.evidence || 0}
                  color="con"
                />
                <ScoreBar
                  label="Engagement"
                  score={analysis.con.engagement || 0}
                  color="con"
                />
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {analysis?.summary && (
          <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-8">
            <h3 className="font-semibold mb-2">AI Analysis</h3>
            <p className="text-sm text-arena-muted leading-relaxed">
              {analysis.summary}
            </p>
          </div>
        )}

        {/* Community Vote */}
        <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-4">Community Vote</h3>
          {user && !voted ? (
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() => handleVote("pro")}
                className="px-6 py-2 bg-arena-pro/20 text-arena-pro border border-arena-pro/30 rounded-lg text-sm font-medium hover:bg-arena-pro/30 transition-colors"
              >
                Pro Wins
              </button>
              <button
                onClick={() => handleVote("draw")}
                className="px-6 py-2 bg-arena-border/30 text-arena-muted border border-arena-border rounded-lg text-sm font-medium hover:bg-arena-border/50 transition-colors"
              >
                Draw
              </button>
              <button
                onClick={() => handleVote("con")}
                className="px-6 py-2 bg-arena-con/20 text-arena-con border border-arena-con/30 rounded-lg text-sm font-medium hover:bg-arena-con/30 transition-colors"
              >
                Con Wins
              </button>
            </div>
          ) : voted ? (
            <p className="text-sm text-arena-muted text-center mb-4">
              Thanks for voting!
            </p>
          ) : (
            <p className="text-sm text-arena-muted text-center mb-4">
              Register to vote
            </p>
          )}
          {votes && (
            <VoteBar
              pro={votes.pro || 0}
              con={votes.con || 0}
              draw={votes.draw || 0}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── TRANSITIONAL / PROCESSING ───────────────────────
  // Shown while status is "forfeiting", "processing", or "pipeline_failed".
  // The in-progress poll continues running and will update debate state
  // once the pipeline resolves to a terminal status.
  const processingMessage =
    debate.status === "pipeline_failed"
      ? "Something went wrong processing results."
      : debate.status === "forfeiting" && forfeitingStuck
      ? "Something went wrong — the match has ended."
      : debate.status === "forfeiting"
      ? "Opponent forfeited — wrapping up..."
      : "Processing results...";

  const showSpinner = debate.status !== "pipeline_failed" && !forfeitingStuck;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      {showSpinner && (
        <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
      )}
      <p className="text-arena-muted">{processingMessage}</p>
      <button
        onClick={() => router.push("/")}
        className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors mt-2"
      >
        Back to Home
      </button>
    </div>
  );
}
