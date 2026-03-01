"use client";

import RankBadge from "../../components/RankBadge";

/**
 * Prematch lobby UI — shows both debaters, ready buttons, countdown,
 * and leave match option. Pure presentation; all state is managed by parent.
 */
export default function PrematchLobby({
  debate,
  mySide,
  myReady,
  opponentReady,
  tokenLoading,
  prematchSecondsLeft,
  cancelling,
  onReady,
  onSwap,
  onCancel,
}) {
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
            <p className="text-sm">{debate.pro_username || "Guest"}</p>
            {debate.pro_rank_tier && (
              <RankBadge rank={debate.pro_rank_tier} />
            )}
            {mySide === "pro" && (
              <p className="text-xs text-arena-muted mt-1">You</p>
            )}
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
            <p className="text-sm">{debate.con_username || "Guest"}</p>
            {debate.con_rank_tier && (
              <RankBadge rank={debate.con_rank_tier} />
            )}
            {mySide === "con" && (
              <p className="text-xs text-arena-muted mt-1">You</p>
            )}
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
                  onClick={onSwap}
                  className="px-6 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
                >
                  Swap Sides
                </button>
                <button
                  onClick={onReady}
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
            <p
              className={`text-sm ${
                prematchSecondsLeft <= 10
                  ? "text-arena-con font-medium"
                  : "text-arena-muted"
              }`}
            >
              Match expires in {prematchSecondsLeft}s
            </p>
          )}

          {/* Leave Match button */}
          <button
            onClick={onCancel}
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
