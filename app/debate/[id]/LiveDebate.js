"use client";

import PhaseTimer from "../../components/PhaseTimer";
import AudioLevelBar from "../../components/AudioLevelBar";

const PHASE_ORDER = [
  "prematch",
  "opening_pro",
  "opening_con",
  "freeflow",
  "closing_con",
  "closing_pro",
  "ended",
];

/**
 * Live debate UI — phase indicator, timer, audio levels, mute controls, forfeit.
 * Pure presentation; all state and handlers managed by parent.
 */
export default function LiveDebate({
  debate,
  mySide,
  daily,
  forfeitConfirm,
  onTimeUp,
  onForfeit,
  onForfeitConfirm,
  onForfeitCancel,
}) {
  // Safety net: in_progress MUST have a real phase. If a race condition
  // left phase as "prematch", force to "opening_pro" so the timer starts.
  const activePhase =
    !debate.phase || debate.phase === "prematch"
      ? "opening_pro"
      : debate.phase;
  const currentSpeaker = activePhase?.includes("pro")
    ? "pro"
    : activePhase?.includes("con")
    ? "con"
    : "both";

  // Map audio levels to pro/con sides.
  const participantIds = Object.keys(daily.audioLevels || {});
  const localId = participantIds.find((id) => daily.participants[id]?.local);
  const remoteId = participantIds.find((id) => !daily.participants[id]?.local);

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
                  : PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(activePhase)
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
          onTimeUp={onTimeUp}
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
              <span className="text-xs font-semibold text-arena-pro">PRO</span>
              <p className="font-medium text-sm">
                {debate.pro_username || "Guest"}
              </p>
            </div>
            <AudioLevelBar level={proLevel} side="pro" />
          </div>
          {(currentSpeaker === "pro" || currentSpeaker === "both") && (
            <p className="text-xs text-arena-pro animate-pulse">Speaking...</p>
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
              <span className="text-xs font-semibold text-arena-con">CON</span>
              <p className="font-medium text-sm">
                {debate.con_username || "Guest"}
              </p>
            </div>
            <AudioLevelBar level={conLevel} side="con" />
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
          title="Toggle your microphone (send audio)"
        >
          {daily.localMuted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={daily.toggleRemoteMute}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            daily.remoteMuted
              ? "bg-arena-accent/20 text-arena-accent border border-arena-accent"
              : "bg-arena-surface border border-arena-border hover:bg-arena-border/30"
          }`}
          title="Toggle speaker (receive audio from opponent)"
        >
          {daily.remoteMuted ? "Unmute Speaker" : "Mute Speaker"}
        </button>

        {!forfeitConfirm ? (
          <button
            onClick={onForfeitConfirm}
            className="px-6 py-2.5 border border-arena-con/50 text-arena-con rounded-lg text-sm hover:bg-arena-con/10 transition-colors"
          >
            Forfeit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-arena-con">Are you sure?</span>
            <button
              onClick={onForfeit}
              className="px-4 py-2 bg-arena-con text-white rounded-lg text-sm"
            >
              Yes, forfeit
            </button>
            <button
              onClick={onForfeitCancel}
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
