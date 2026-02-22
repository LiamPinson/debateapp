"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
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

export default function DebateClient({ initialDebate, params }) {
  const { id: debateId } = params;
  const router = useRouter();
  const { user, session } = useSession();
  const [debate, setDebate] = useState(initialDebate || null);
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

  // Determine which side the current user is on
  const mySide =
    debate?.pro_user_id === user?.id ||
    debate?.pro_session_id === session?.session_id
      ? "pro"
      : debate?.con_user_id === user?.id ||
        debate?.con_session_id === session?.session_id
      ? "con"
      : null;

  // Load debate detail — skipped if initialDebate was provided by the server
  useEffect(() => {
    if (initialDebate) return;
    getDebateDetail(debateId).then((data) => {
      setDebate(data.debate || data);
      setLoading(false);
    });
  }, [debateId, initialDebate]);

  // Realtime debate updates
  const onDebateChange = useCallback((updated) => {
    setDebate((prev) => ({ ...prev, ...updated }));
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

  // ── FIX 4: Mutual readiness via Supabase Realtime broadcast channel ──
  useEffect(() => {
    if (!debateId || !mySide || debate?.status !== "prematch") return;

    let channel;
    import("@/lib/supabase").then(({ createBrowserClient }) => {
      const supabase = createBrowserClient();
      channel = supabase.channel(`ready:${debateId}`, {
        config: { broadcast: { self: true } },
      });

      channel
        .on("broadcast", { event: "ready" }, (payload) => {
          const { side } = payload.payload;
          if (side !== mySide) {
            setOpponentReady(true);
          }
        })
        .subscribe();

      readyChannelRef.current = channel;
    });

    return () => {
      if (readyChannelRef.current) {
        readyChannelRef.current.unsubscribe();
        readyChannelRef.current = null;
      }
    };
  }, [debateId, mySide, debate?.status]);

  // Prematch poll: sync opponent ready state + detect in_progress transition.
  // Runs every 2 s while status is "prematch". Broadcast is best-effort only;
  // this poll is the authoritative source of truth for both flags.
  useEffect(() => {
    if (debate?.status !== "prematch") return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const data = await getDebateDetail(debateId);
        const updated = data?.debate || data;
        if (!updated) {
          if (active) setTimeout(poll, 2000);
          return;
        }
        if (updated.status === "in_progress") {
          setDebate((d) => ({ ...d, ...updated }));
          return; // stop polling
        }
        // Sync the opponent's ready flag from DB so the UI indicator updates
        // even if the broadcast was missed.
        if (mySide === "pro" && updated.con_ready) setOpponentReady(true);
        if (mySide === "con" && updated.pro_ready) setOpponentReady(true);
      } catch { /* ignore transient errors */ }
      if (active) setTimeout(poll, 2000);
    };

    const timeout = setTimeout(poll, 2000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [debate?.status, debateId, mySide]);

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
  useEffect(() => {
    const active_status = debate?.status === "in_progress" || debate?.status === "forfeiting";
    if (!active_status) return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const data = await getDebateDetail(debateId);
        const updated = data?.debate || data;
        const s = updated?.status;
        if (s && s !== "in_progress" && s !== "forfeiting") {
          setDebate((d) => ({ ...d, ...updated }));
          return; // terminal state reached — stop
        }
      } catch { /* ignore transient errors */ }
      if (active) setTimeout(poll, 2000);
    };

    // Poll every 1 s so forfeit notification is near-instant
    const timeout = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [debate?.status, debateId]);

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

    const result = await setReady(debateId, mySide);
    if (result.error) return;

    if (result.bothReady || result.alreadyStarted) {
      // Debate just started (or was already started by opponent).
      // Fetch fresh state so we get the real started_at from DB.
      const data = await getDebateDetail(debateId);
      const updated = data?.debate || data;
      if (updated) setDebate((d) => ({ ...d, ...updated }));
    }
    // If only one side ready, the prematch poll will detect when the
    // opponent readies and the debate transitions to in_progress.
  };

  // Side swap
  const handleSwap = async () => {
    if (!mySide) return;
    await requestSideSwap(debateId, mySide);
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
        </div>
      </div>
    );
  }

  // ─── LIVE DEBATE ─────────────────────────────────────
  if (debate.status === "in_progress") {
    const currentSpeaker = debate.phase?.includes("pro")
      ? "pro"
      : debate.phase?.includes("con")
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
                  p === debate.phase
                    ? "bg-arena-accent"
                    : PHASE_ORDER.indexOf(p) <
                      PHASE_ORDER.indexOf(debate.phase)
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
            phase={debate.phase}
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
    debate.status === "forfeiting"
      ? "Opponent forfeited — wrapping up..."
      : debate.status === "pipeline_failed"
      ? "Something went wrong processing results."
      : "Processing results...";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-arena-muted">{processingMessage}</p>
      {debate.status === "pipeline_failed" && (
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors mt-2"
        >
          Back to Home
        </button>
      )}
    </div>
  );
}
