"use client";

import { useState, useEffect, useRef } from "react";

const PHASE_LABELS = {
  opening_pro: "Opening — Pro",
  opening_con: "Opening — Con",
  freeflow: "Free Discussion",
  closing_con: "Closing — Con",
  closing_pro: "Closing — Pro",
  ended: "Debate Ended",
};

// Phase durations in seconds based on debate time limit
const PHASE_DURATIONS = {
  5: { opening: 45, freeflow: 120, closing: 30 },
  15: { opening: 120, freeflow: 480, closing: 90 },
  45: { opening: 300, freeflow: 1500, closing: 300 },
};

export function getPhaseDuration(phase, timeLimit) {
  const durations = PHASE_DURATIONS[timeLimit] || PHASE_DURATIONS[15];
  if (phase.startsWith("opening")) return durations.opening;
  if (phase === "freeflow") return durations.freeflow;
  if (phase.startsWith("closing")) return durations.closing;
  return 0;
}

export default function PhaseTimer({ phase, timeLimit, onTimeUp }) {
  const duration = getPhaseDuration(phase, timeLimit);
  const [remaining, setRemaining] = useState(duration);
  const callbackRef = useRef(onTimeUp);
  callbackRef.current = onTimeUp;

  useEffect(() => {
    setRemaining(duration);
  }, [phase, duration]);

  useEffect(() => {
    if (remaining <= 0 || phase === "ended" || phase === "prematch") return;

    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          callbackRef.current?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, remaining > 0]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = duration > 0 ? (remaining / duration) * 100 : 0;
  const urgent = remaining < 10 && remaining > 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-medium text-arena-muted">
        {PHASE_LABELS[phase] || phase}
      </p>

      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#334155" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke={urgent ? "#ef4444" : "#ea580c"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-mono font-bold ${urgent ? "text-red-400 animate-pulse" : ""}`}>
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
