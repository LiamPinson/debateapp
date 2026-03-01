"use client";

import VoteBar from "../../components/VoteBar";

/**
 * Community voting section — vote buttons + results bar.
 * Used inside DebateResults.
 */
export default function VotingPanel({ user, voted, votes, onVote }) {
  return (
    <div className="bg-arena-surface border border-arena-border rounded-xl p-6 mb-8">
      <h3 className="font-semibold mb-4">Community Vote</h3>
      {user && !voted ? (
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => onVote("pro")}
            className="px-6 py-2 bg-arena-pro/20 text-arena-pro border border-arena-pro/30 rounded-lg text-sm font-medium hover:bg-arena-pro/30 transition-colors"
          >
            Pro Wins
          </button>
          <button
            onClick={() => onVote("draw")}
            className="px-6 py-2 bg-arena-border/30 text-arena-muted border border-arena-border rounded-lg text-sm font-medium hover:bg-arena-border/50 transition-colors"
          >
            Draw
          </button>
          <button
            onClick={() => onVote("con")}
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
  );
}
