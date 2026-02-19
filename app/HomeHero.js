"use client";

import { useState } from "react";
import MatchmakingModal from "./components/MatchmakingModal";

export default function HomeHero() {
  const [matchmakingOpen, setMatchmakingOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMatchmakingOpen(true)}
        className="px-8 py-3 bg-arena-accent text-white rounded-lg font-semibold hover:bg-arena-accent/80 transition-colors text-lg"
      >
        Quick Match
      </button>
      <MatchmakingModal
        open={matchmakingOpen}
        onClose={() => setMatchmakingOpen(false)}
      />
    </>
  );
}
