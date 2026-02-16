"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { useRealtimeDebate } from "@/lib/useRealtime";
import { useDaily } from "@/lib/useDaily";
import {
  getDebateDetail,
  getDailyToken,
  requestSideSwap,
  startDebate,
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

const PHASE_ORDER = ["prematch", "opening_pro", "opening_con", "freeflow", "closing_con", "closing_pro", "ended"];

export default function DebatePage({ params }) {
  const { id: debateId } = params;
  const router = useRouter();
  const { user, session } = useSession();
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyToken, setDailyToken] = useState(null);
  const [forfeitConfirm, setForfeitConfirm] = useState(false);
  const [votes, setVotes] = useState(null);
  const [voted, setVoted] = useState(false);

  // Determine which side the current user is on
  const mySide =
    debate?.pro_user_id === user?.id || debate?.pro_session_id === session?.id
      ? "pro"
      : debate?.con_user_id === user?.id || debate?.con_session_id === session?.id
      ? "con"
      : null;

  // Load debate detail
  useEffect(() => {
    getDebateDetail(debateId).then((data) => {
      setDebate(data.debate || data);
      setLoading(false);
    });
  }, [debateId]);

  // Realtime debate updates
  const onDebateChange = useCallback((updated) => {
    setDebate((prev) => ({ ...prev, ...updated }));
  }, []);
  useRealtimeDebate(debateId, onDebateChange);

  // Get Daily.co token when debate is in_progress
  useEffect(() => {
    if (!debate || debate.status !== "in_progress" || dailyToken) return;
    if (!mySide) return;
    getDailyToken(debateId, user?.id, session?.id, mySide).then((data) => {
      setDailyToken(data);
    });
  }, [debate?.status, debateId, user?.id, session?.id, mySide, dailyToken]);

  // Daily.co audio
  const daily = useDaily({
    roomUrl: dailyToken?.roomUrl || dailyToken?.room_url || "",
    token: dailyToken?.token || "",
    autoJoin: !!dailyToken?.token,
  });

  // Load votes for completed debates
  useEffect(() => {
    if (debate?.status === "completed") {
      getVoteTally(debateId).then((data) => setVotes(data));
    }
  }, [debate?.status, debateId]);

  // Phase advance handler
  const handleTimeUp = useCallback(async () => {
    if (!debate || !mySide) return;
    const currentIdx = PHASE_ORDER.indexOf(debate.phase);
    const nextPhase = PHASE_ORDER[currentIdx + 1];
    if (nextPhase === "ended") {
      await completeDebate(debateId);
    } else if (nextPhase) {
      await advancePhase(debateId, nextPhase);
    }
  }, [debate, debateId, mySide]);

  // Forfeit handler
  const handleForfeit = async () => {
    if (!mySide) return;
    await forfeitDebate(debateId, mySide);
    setForfeitConfirm(false);
  };

  // Vote handler
  const handleVote = async (choice) => {
    if (!user?.id || voted) return;
    await castVote(debateId, user.id, choice);
    setVoted(true);
    getVoteTally(debateId).then((data) => setVotes(data));
  };

  // Ready / Start
  const handleStart = async () => {
    await startDebate(debateId);
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
          <h2 className="text-2xl font-bold mb-6">{debate.topic_title || "Quick Match"}</h2>
          {debate.topic_description && (
            <p className="text-sm text-arena-muted mb-6">{debate.topic_description}</p>
          )}

          <div className="flex items-center justify-center gap-8 mb-8">
            {/* Pro side */}
            <div className={`text-center ${mySide === "pro" ? "ring-2 ring-arena-pro rounded-xl p-4" : "p-4"}`}>
              <div className="w-16 h-16 bg-arena-pro/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-arena-pro">P</span>
              </div>
              <p className="font-semibold text-arena-pro">Pro</p>
              <p className="text-sm">{debate.pro_username || "Guest"}</p>
              {debate.pro_rank_tier && <RankBadge rank={debate.pro_rank_tier} />}
              {mySide === "pro" && <p className="text-xs text-arena-muted mt-1">You</p>}
            </div>

            <span className="text-2xl font-bold text-arena-muted">VS</span>

            {/* Con side */}
            <div className={`text-center ${mySide === "con" ? "ring-2 ring-arena-con rounded-xl p-4" : "p-4"}`}>
              <div className="w-16 h-16 bg-arena-con/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl font-bold text-arena-con">C</span>
              </div>
              <p className="font-semibold text-arena-con">Con</p>
              <p className="text-sm">{debate.con_username || "Guest"}</p>
              {debate.con_rank_tier && <RankBadge rank={debate.con_rank_tier} />}
              {mySide === "con" && <p className="text-xs text-arena-muted mt-1">You</p>}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleSwap}
              className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              Swap Sides
            </button>
            <button
              onClick={handleStart}
              className="px-8 py-2.5 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors"
            >
              Ready — Start Debate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIVE DEBATE ─────────────────────────────────────
  if (debate.status === "in_progress") {
    const currentSpeaker = debate.phase?.includes("pro") ? "pro" : debate.phase?.includes("con") ? "con" : "both";

    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Top bar: topic + phase */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold">{debate.topic_title || "Quick Match"}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            {PHASE_ORDER.filter((p) => p !== "prematch").map((p) => (
              <div
                key={p}
                className={`w-2 h-2 rounded-full ${
                  p === debate.phase ? "bg-arena-accent" : PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(debate.phase) ? "bg-arena-accent/40" : "bg-arena-border"
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
          />
        </div>

        {/* Debaters */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Pro */}
          <div className={`bg-arena-surface border rounded-xl p-4 ${
            currentSpeaker === "pro" || currentSpeaker === "both" ? "border-arena-pro" : "border-arena-border"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-arena-pro">PRO</span>
                <p className="font-medium text-sm">{debate.pro_username || "Guest"}</p>
              </div>
              <AudioLevelBar
                level={Object.values(daily.audioLevels)[0] || 0}
                side="pro"
              />
            </div>
            {(currentSpeaker === "pro" || currentSpeaker === "both") && (
              <p className="text-xs text-arena-pro animate-pulse">Speaking...</p>
            )}
          </div>

          {/* Con */}
          <div className={`bg-arena-surface border rounded-xl p-4 ${
            currentSpeaker === "con" || currentSpeaker === "both" ? "border-arena-con" : "border-arena-border"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-arena-con">CON</span>
                <p className="font-medium text-sm">{debate.con_username || "Guest"}</p>
              </div>
              <AudioLevelBar
                level={Object.values(daily.audioLevels)[1] || 0}
                side="con"
              />
            </div>
            {(currentSpeaker === "con" || currentSpeaker === "both") && (
              <p className="text-xs text-arena-con animate-pulse">Speaking...</p>
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

  // ─── RESULTS ─────────────────────────────────────────
  if (debate.status === "completed" || debate.status === "forfeited") {
    const proScore = parseFloat(debate.pro_quality_score) || 0;
    const conScore = parseFloat(debate.con_quality_score) || 0;
    const analysis = debate.ai_qualitative_analysis;

    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-sm text-arena-muted mb-1">Debate Results</p>
          <h2 className="text-2xl font-bold">{debate.topic_title || "Quick Match"}</h2>
        </div>

        {/* Winner banner */}
        {debate.winner && (
          <div className={`text-center py-4 rounded-xl mb-8 ${
            debate.winner === "pro" ? "bg-arena-pro/10 border border-arena-pro/30" :
            debate.winner === "con" ? "bg-arena-con/10 border border-arena-con/30" :
            "bg-arena-accent/10 border border-arena-accent/30"
          }`}>
            <p className="text-lg font-bold">
              {debate.winner === "draw" ? "Draw!" : `${debate.winner === "pro" ? debate.pro_username || "Pro" : debate.con_username || "Con"} Wins!`}
            </p>
            <p className="text-xs text-arena-muted">
              {debate.winner_source === "forfeit" ? "by forfeit" : debate.winner_source === "ai" ? "AI decision" : "community vote"}
            </p>
          </div>
        )}

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-arena-surface border border-arena-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-arena-pro">PRO</span>
                <p className="font-medium">{debate.pro_username || "Guest"}</p>
              </div>
              <span className="text-3xl font-bold text-arena-pro">{proScore.toFixed(1)}</span>
            </div>
            {analysis?.pro && (
              <div className="space-y-2">
                <ScoreBar label="Coherence" score={analysis.pro.coherence || 0} color="pro" />
                <ScoreBar label="Evidence" score={analysis.pro.evidence || 0} color="pro" />
                <ScoreBar label="Engagement" score={analysis.pro.engagement || 0} color="pro" />
              </div>
            )}
          </div>

          <div className="bg-arena-surface border border-arena-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-arena-con">CON</span>
                <p className="font-medium">{debate.con_username || "Guest"}</p>
              </div>
              <span className="text-3xl font-bold text-arena-con">{conScore.toFixed(1)}</span>
            </div>
            {analysis?.con && (
              <div className="space-y-2">
                <ScoreBar label="Coherence" score={analysis.con.coherence || 0} color="con" />
                <ScoreBar label="Evidence" score={analysis.con.evidence || 0} color="con" />
                <ScoreBar label="Engagement" score={analysis.con.engagement || 0} color="con" />
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {analysis?.summary && (
          <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-8">
            <h3 className="font-semibold mb-2">AI Analysis</h3>
            <p className="text-sm text-arena-muted leading-relaxed">{analysis.summary}</p>
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
            <p className="text-sm text-arena-muted text-center mb-4">Thanks for voting!</p>
          ) : (
            <p className="text-sm text-arena-muted text-center mb-4">Register to vote</p>
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

  // Fallback for processing/cancelled states
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-4 border-arena-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-arena-muted">Processing results...</p>
    </div>
  );
}
