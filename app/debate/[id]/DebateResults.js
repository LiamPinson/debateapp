"use client";

import ScoreBar from "../../components/ScoreBar";
import VotingPanel from "./VotingPanel";

/**
 * Post-debate results — winner banner, score cards, AI analysis, community vote.
 * Handles both "completed" (full results) and "forfeited" (non-forfeit-specific) statuses.
 */
export default function DebateResults({
  debate,
  user,
  voted,
  votes,
  onVote,
  onGoHome,
}) {
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
              <span className="text-xs font-semibold text-arena-pro">PRO</span>
              <p className="font-medium">{debate.pro_username || "Guest"}</p>
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
              <span className="text-xs font-semibold text-arena-con">CON</span>
              <p className="font-medium">{debate.con_username || "Guest"}</p>
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
      <VotingPanel user={user} voted={voted} votes={votes} onVote={onVote} />

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onGoHome}
          className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
