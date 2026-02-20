"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/SessionContext";
import { enterQueue, leaveQueue } from "@/lib/api-client";
import { useRealtimeMatch, useMatchPolling } from "@/lib/useRealtime";

export default function MatchmakingModal({ open, onClose, topic = null }) {
  const router = useRouter();
  const { user, session, loading: sessionLoading } = useSession();
  const [timeLimit, setTimeLimit] = useState(15);
  const [stance, setStance] = useState("either");
  const [ranked, setRanked] = useState(false);
  const [searching, setSearching] = useState(false);
  const [queueId, setQueueId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);

  const isGuest = !user;

  const onMatch = useCallback(
    async (match) => {
      setSearching(false);
      setQueueId(null);
      onClose();
      await new Promise((r) => setTimeout(r, 1000));
      router.push(`/debate/${match.debateId}`);
    },
    [router, onClose]
  );

  useRealtimeMatch(queueId, onMatch);
  useMatchPolling(queueId, onMatch);

  // Elapsed timer
  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [searching]);

  const handleSearch = async () => {
    setError(null);
    if (sessionLoading) {
      setError("Loading session… please wait a moment.");
      return;
    }
    if (!user?.id && !session?.session_id) {
      setError("Session not ready — please refresh the page.");
      return;
    }
    setSearching(true);
    setElapsed(0);
    try {
      const result = await enterQueue({
        userId: user?.id,
        sessionId: session?.session_id,
        category: topic?.category || "quick",
        topicId: topic?.id || null,
        timeLimit,
        stance,
        ranked: ranked && !isGuest,
      });
      console.log("QUEUE RESPONSE:", JSON.stringify(result));
      if (result.error) {
        setError(result.error);
        setSearching(false);
        return;
      }
      // If match was already found synchronously (second user into queue)
      if (result.match?.debate_id) {
        setSearching(false);
        onClose();
        await new Promise((r) => setTimeout(r, 1000));
        router.push(`/debate/${result.match.debate_id}`);
        return;
      }
      // Otherwise wait for realtime/polling to fire
      setQueueId(result.queueEntry?.id);
    } catch (err) {
      setError(err.message);
      setSearching(false);
    }
  };

  const handleCancel = async () => {
    if (queueId) {
      await leaveQueue(queueId);
    }
    setSearching(false);
    setQueueId(null);
    setElapsed(0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-arena-surface border border-arena-border rounded-xl p-6 w-full max-w-md mx-4">
        {searching ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-arena-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">Finding Opponent...</h3>
            <p className="text-arena-muted text-sm mb-4">
              {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")} elapsed
            </p>
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-1">
              {topic ? "Start Debate" : "Quick Match"}
            </h2>
            {topic && (
              <p className="text-sm text-arena-muted mb-4">{topic.short_title || topic.title}</p>
            )}
            {!topic && (
              <p className="text-sm text-arena-muted mb-4">Random topic, random opponent</p>
            )}

            <div className="space-y-4">
              {/* Time limit */}
              <div>
                <label className="block text-sm font-medium mb-2">Time Limit</label>
                <div className="flex gap-2">
                  {[5, 15, 45].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeLimit(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        timeLimit === t
                          ? "bg-arena-accent text-white"
                          : "bg-arena-bg border border-arena-border hover:border-arena-accent"
                      }`}
                    >
                      {t} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Stance */}
              <div>
                <label className="block text-sm font-medium mb-2">Stance</label>
                <div className="flex gap-2">
                  {[
                    { val: "pro", label: "Pro", cls: "bg-arena-pro/20 border-arena-pro text-arena-pro" },
                    { val: "con", label: "Con", cls: "bg-arena-con/20 border-arena-con text-arena-con" },
                    { val: "either", label: "Either", cls: "bg-arena-accent/20 border-arena-accent text-arena-accent" },
                  ].map(({ val, label, cls }) => (
                    <button
                      key={val}
                      onClick={() => setStance(val)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        stance === val ? cls : "bg-arena-bg border-arena-border hover:border-arena-accent"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ranked toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Ranked</span>
                  {isGuest && (
                    <span className="text-xs text-arena-muted ml-2">(Register to unlock)</span>
                  )}
                </div>
                <button
                  onClick={() => !isGuest && setRanked(!ranked)}
                  disabled={isGuest}
                  className={`w-10 h-6 rounded-full transition-colors relative ${
                    ranked && !isGuest ? "bg-arena-accent" : "bg-arena-border"
                  } ${isGuest ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      ranked && !isGuest ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {error && <p className="text-sm text-arena-con">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-arena-border rounded-lg text-sm hover:bg-arena-border/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSearch}
                  disabled={sessionLoading}
                  className="flex-1 px-4 py-2.5 bg-arena-accent text-white rounded-lg text-sm font-medium hover:bg-arena-accent/80 transition-colors disabled:opacity-50"
                >
                  {sessionLoading ? "Loading..." : "Find Match"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
