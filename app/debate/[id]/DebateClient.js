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
import { log } from "@/lib/logger";
import { useToast } from "../../components/Toast";

// Sub-components (extracted from this file for maintainability)
import PrematchLobby from "./PrematchLobby";
import LiveDebate from "./LiveDebate";
import DebateResults from "./DebateResults";

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
const STATUS_PRIORITY = {
  prematch: 0,
  in_progress: 1,
  completed: 2,
  forfeited: 2,
  cancelled: 2,
  pipeline_failed: 2,
};

export default function DebateClient({ initialDebate, params }) {
  const { id: debateId } = params;
  const router = useRouter();
  const { user, session } = useSession();
  const toast = useToast();
  const [debate, setDebateRaw] = useState(initialDebate || null);

  // Guarded setter — NEVER allows status to regress (e.g. in_progress → prematch).
  const setDebate = useCallback((updater) => {
    setDebateRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!next || !prev) return next;
      const prevP = STATUS_PRIORITY[prev.status] ?? -1;
      const nextP = STATUS_PRIORITY[next.status] ?? -1;
      if (nextP < prevP) {
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

  // Determine which side the current user is on
  const mySide =
    debate?.pro_user_id === user?.id ||
    debate?.pro_session_id === session?.session_id
      ? "pro"
      : debate?.con_user_id === user?.id ||
        debate?.con_session_id === session?.session_id
      ? "con"
      : null;

  // ── Data fetching & subscriptions ────────────────────────────

  // Always fetch latest state on mount — SSR data may be stale.
  useEffect(() => {
    getDebateDetail(debateId)
      .then((data) => {
        const fresh = data?.debate || data;
        if (fresh) {
          setDebate((prev) => ({ ...prev, ...fresh }));
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

  // Realtime debate updates — guard against stale events.
  const onDebateChange = useCallback((updated) => {
    log.debug("[Realtime] debate change received:", {
      newStatus: updated?.status,
      newPhase: updated?.phase,
      readyFlags: { pro: updated?.pro_ready, con: updated?.con_ready },
    });
    setDebate((prev) => {
      const prevPriority = STATUS_PRIORITY[prev?.status] ?? -1;
      const newPriority = STATUS_PRIORITY[updated?.status] ?? -1;
      if (updated?.status && newPriority < prevPriority) {
        log.debug("[Realtime] BLOCKED stale event:", {
          prevStatus: prev?.status,
          attemptedStatus: updated?.status,
        });
        const { status, phase, ...rest } = updated;
        return { ...prev, ...rest };
      }
      return { ...prev, ...updated };
    });
  }, []);
  useRealtimeDebate(debateId, onDebateChange);

  // Pre-fetch Daily.co token as soon as we know our side.
  useEffect(() => {
    if (!debate || dailyToken || tokenLoading) return;
    if (!mySide) return;
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

  // Daily.co audio — auto-join when we have a token AND debate is in_progress.
  const daily = useDaily({
    roomUrl: dailyToken?.room_url || "",
    token: dailyToken?.token || "",
    autoJoin: !!dailyToken?.token && debate?.status === "in_progress",
  });

  // Load votes for completed debates.
  useEffect(() => {
    if (debate?.status === "completed") {
      getVoteTally(debateId).then((data) => setVotes(data));
    }
  }, [debate?.status, debateId]);

  // ── Mutual readiness via Supabase Realtime broadcast channel ──
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
        else log.debug(`[Realtime] ready:${debateId} →`, status);
      });

    readyChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      readyChannelRef.current = null;
    };
  }, [debateId, mySide, debate?.status]);

  // ── Prematch poll + countdown ──
  useEffect(() => {
    if (debate?.status !== "prematch" || !debate?.created_at) return;

    const PREMATCH_TIMEOUT_S = 60;
    let active = true;
    let cancelInFlight = false;

    const poll = async () => {
      if (!active) return;

      const elapsedMs = Date.now() - new Date(debate.created_at).getTime();
      const remaining = Math.max(0, PREMATCH_TIMEOUT_S - Math.floor(elapsedMs / 1000));
      setPrematchSecondsLeft(remaining);

      // EXPIRED: cancel + verify loop
      if (remaining <= 0) {
        if (!cancelInFlight) {
          cancelInFlight = true;
          try {
            const result = await cancelDebate(debateId);
            if (!active) return;
            log.debug("Auto-cancel result:", result);
            if (result?.cancelled || result?.alreadyCancelled) {
              setDebate((d) => ({ ...d, status: "cancelled", phase: "ended" }));
              return;
            }
            if (result?.alreadyStarted) {
              setDebate((d) => ({
                ...d,
                status: result.status || "in_progress",
                phase: result.phase || "opening_pro",
                started_at: result.started_at || d.started_at,
              }));
              return;
            }
          } catch (err) {
            console.error("Auto-cancel network error:", err);
          }
          cancelInFlight = false;
        }

        if (!active) return;

        try {
          const data = await getDebateDetail(debateId);
          if (!active) return;
          const updated = data?.debate || data;
          if (updated && updated.status !== "prematch") {
            setDebate((d) => ({ ...d, ...updated }));
            return;
          }
        } catch (err) {
          console.error("Verify poll error:", err);
        }

        if (active) setTimeout(poll, 2000);
        return;
      }

      // NORMAL: prematch poll (3 s fallback)
      try {
        const data = await getDebateDetail(debateId);
        if (!active) return;
        const updated = data?.debate || data;
        if (!updated) {
          if (active) setTimeout(poll, 3000);
          return;
        }

        if (updated.status !== "prematch") {
          setDebate((d) => ({ ...d, ...updated }));
          return;
        }

        if (mySide === "pro" && updated.con_ready) setOpponentReady(true);
        if (mySide === "con" && updated.pro_ready) setOpponentReady(true);
      } catch (err) {
        console.error("Prematch poll error:", err);
      }

      if (active) setTimeout(poll, 3000);
    };

    poll();
    return () => { active = false; };
  }, [debate?.status, debate?.created_at, debateId, mySide]);

  // Phase advance handler.
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

  // Fallback poll while in_progress (5 s — Realtime is primary).
  useEffect(() => {
    if (debate?.status !== "in_progress") return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const data = await getDebateDetail(debateId);
        if (!active) return;
        const updated = data?.debate || data;
        if (!updated) { if (active) setTimeout(poll, 5000); return; }

        const terminalStatuses = ["completed", "forfeited", "cancelled", "pipeline_failed"];
        if (updated.status && terminalStatuses.includes(updated.status)) {
          setDebate((d) => ({ ...d, ...updated }));
          return;
        }

        if (updated.status === "in_progress") {
          setDebate((d) => ({ ...d, ...updated }));
        }
      } catch { /* ignore transient errors */ }
      if (active) setTimeout(poll, 5000);
    };

    const timeout = setTimeout(poll, 5000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [debate?.status, debateId]);

  // ── Event handlers ───────────────────────────────────────────

  const handleForfeit = async () => {
    if (!mySide) return;

    try {
      const result = await forfeitDebate(debateId);

      if (result?.error) {
        console.error("Forfeit API error:", result.error);
        toast("Failed to forfeit: " + (result.error || "Unknown error"), "error");
        setForfeitConfirm(false);
        return;
      }

      if (!result?.success && !result?.forfeited) {
        console.error("Forfeit not confirmed by server:", result);
        toast("Forfeit was not processed correctly. Please try again.", "error");
        setForfeitConfirm(false);
        return;
      }

      setDebate((d) => ({
        ...d,
        status: "forfeited",
        phase: "ended",
        winner: result.winner,
        completed_at: result.completed_at,
      }));

      setForfeitConfirm(false);
      setTimeout(() => router.push("/"), 500);
    } catch (err) {
      console.error("Forfeit error:", err);
      toast("Failed to forfeit: " + (err.message || "Network error"), "error");
      setForfeitConfirm(false);
    }
  };

  const handleVote = async (choice) => {
    if (!user?.id || voted) return;
    await castVote(debateId, user.id, choice);
    setVoted(true);
    getVoteTally(debateId).then((data) => setVotes(data));
  };

  const handleReady = async () => {
    if (!mySide) return;
    setMyReady(true);

    if (readyChannelRef.current) {
      readyChannelRef.current.send({
        type: "broadcast",
        event: "ready",
        payload: { side: mySide },
      });
    }

    try {
      const result = await setReady(debateId);
      if (result?.error) {
        console.error("setReady error:", result.error);
        setMyReady(false);
        return;
      }

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

      if (mySide === "pro" && result?.con_ready) setOpponentReady(true);
      if (mySide === "con" && result?.pro_ready) setOpponentReady(true);
    } catch (err) {
      console.error("setReady network error:", err);
      setMyReady(false);
    }
  };

  const handleSwap = async () => {
    if (!mySide) return;
    await requestSideSwap(debateId, mySide);
  };

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

  const goHome = () => router.push("/");

  // ── Render ───────────────────────────────────────────────────

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

  // PREMATCH
  if (debate.status === "prematch") {
    return (
      <PrematchLobby
        debate={debate}
        mySide={mySide}
        myReady={myReady}
        opponentReady={opponentReady}
        tokenLoading={tokenLoading}
        prematchSecondsLeft={prematchSecondsLeft}
        cancelling={cancelling}
        onReady={handleReady}
        onSwap={handleSwap}
        onCancel={handleCancelPrematch}
      />
    );
  }

  // CANCELLED
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
              onClick={goHome}
              className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LIVE DEBATE
  if (debate.status === "in_progress") {
    return (
      <LiveDebate
        debate={debate}
        mySide={mySide}
        daily={daily}
        forfeitConfirm={forfeitConfirm}
        onTimeUp={handleTimeUp}
        onForfeit={handleForfeit}
        onForfeitConfirm={() => setForfeitConfirm(true)}
        onForfeitCancel={() => setForfeitConfirm(false)}
      />
    );
  }

  // FORFEIT RESULTS (opponent forfeited)
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

        <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-6 text-center">
          <p className="font-semibold mb-1">Transcript &amp; AI Analysis</p>
          <p className="text-sm text-arena-muted">
            The debate recording and full AI analysis will be available on this
            page within 24 hours.
          </p>
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={goHome}
            className="px-8 py-2.5 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // COMPLETED / FORFEITED RESULTS (with scores)
  if (debate.status === "completed" || debate.status === "forfeited") {
    return (
      <DebateResults
        debate={debate}
        user={user}
        voted={voted}
        votes={votes}
        onVote={handleVote}
        onGoHome={goHome}
      />
    );
  }

  // PIPELINE PROCESSING / ERRORS
  const processingMessage =
    debate.status === "pipeline_failed"
      ? "Something went wrong processing results."
      : "Processing results...";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      {debate.status !== "pipeline_failed" && (
        <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
      )}
      <p className="text-arena-muted">{processingMessage}</p>
      <button
        onClick={goHome}
        className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors mt-2"
      >
        Back to Home
      </button>
    </div>
  );
}
