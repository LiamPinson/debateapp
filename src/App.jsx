import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import * as d3 from "d3";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ============================================================
// DEBATE PLATFORM — MVP PROTOTYPE
// ============================================================

// --- CONSTANTS ---
const CATEGORIES = [
  { id: "quick", name: "Quick Match", icon: "⚡", desc: "Random topic, random side", color: "#FF6B35" },
  { id: "politics", name: "Politics", icon: "🏛️", desc: "Policy & governance", color: "#E63946" },
  { id: "economics", name: "Economics", icon: "📊", desc: "Markets & systems", color: "#2A9D8F" },
  { id: "philosophy", name: "Philosophy", icon: "🧠", desc: "Big questions", color: "#7B2D8E" },
  { id: "science", name: "Science", icon: "🔬", desc: "Discovery & tech", color: "#0077B6" },
  { id: "culture", name: "Culture", icon: "🎭", desc: "Society & media", color: "#F4A261" },
  { id: "silly", name: "Silly", icon: "🤡", desc: "Absurd arguments", color: "#FF69B4" },
  { id: "fantasy", name: "Fantasy / Fandom", icon: "⚔️", desc: "Fictional universes", color: "#9B5DE5" },
];

const TOPICS = {
  politics: [
    { id: "p1", title: "Universal Basic Income is necessary for the modern economy", short: "UBI" },
    { id: "p2", title: "Immigration restrictions do more harm than good", short: "Immigration" },
    { id: "p3", title: "The Electoral College should be abolished", short: "Electoral College" },
    { id: "p4", title: "Gun ownership is a fundamental right that should not be restricted", short: "Gun Control" },
  ],
  economics: [
    { id: "e1", title: "Cryptocurrency regulation will stifle innovation", short: "Crypto Regulation" },
    { id: "e2", title: "Rent control is an effective solution to housing affordability", short: "Rent Control" },
    { id: "e3", title: "Free trade agreements benefit all participating nations", short: "Free Trade" },
    { id: "e4", title: "A 4-day work week would boost productivity", short: "4-Day Work Week" },
  ],
  philosophy: [
    { id: "ph1", title: "Free will is an illusion", short: "Free Will" },
    { id: "ph2", title: "Utilitarianism is the most ethical framework", short: "Utilitarianism" },
    { id: "ph3", title: "AI systems can be genuinely conscious", short: "AI Consciousness" },
    { id: "ph4", title: "Moral relativism is intellectually bankrupt", short: "Moral Relativism" },
  ],
  science: [
    { id: "s1", title: "Nuclear energy is essential for combating climate change", short: "Nuclear Energy" },
    { id: "s2", title: "GMOs are safe and necessary for food security", short: "GMOs" },
    { id: "s3", title: "Mars colonization should be humanity's top priority", short: "Mars Colony" },
    { id: "s4", title: "Human gene editing should be permitted for enhancement", short: "Gene Editing" },
  ],
  culture: [
    { id: "c1", title: "Social media has been a net negative for society", short: "Social Media" },
    { id: "c2", title: "Cancel culture is a healthy form of accountability", short: "Cancel Culture" },
    { id: "c3", title: "Meritocracy is a myth", short: "Meritocracy" },
    { id: "c4", title: "Remote work is better than office work", short: "Remote Work" },
  ],
  silly: [
    { id: "si1", title: "A hot dog is a sandwich", short: "Hot Dog Sandwich" },
    { id: "si2", title: "Cereal is soup", short: "Cereal Is Soup" },
    { id: "si3", title: "Pineapple belongs on pizza", short: "Pineapple Pizza" },
    { id: "si4", title: "Water is wet", short: "Water Is Wet" },
    { id: "si5", title: "A taco is a sandwich", short: "Taco Sandwich" },
  ],
  fantasy: [
    { id: "f1", title: "Thanos was morally justified", short: "Thanos Did Nothing Wrong" },
    { id: "f2", title: "The Jedi Order is an authoritarian cult", short: "Jedi Are Authoritarian" },
    { id: "f3", title: "Aragorn would beat Jon Snow in single combat", short: "Aragorn vs Jon Snow" },
    { id: "f4", title: "Gandalf should have used the eagles to fly to Mordor", short: "Eagle Plot Hole" },
    { id: "f5", title: "The Empire did more good than harm for the galaxy", short: "Empire Apologia" },
    { id: "f6", title: "Palpatine's rise to power was morally defensible", short: "Palpatine Morality" },
  ],
};

const ALL_TOPICS = Object.values(TOPICS).flat();


const TIME_OPTIONS = [5, 15, 45];
const RANK_TIERS = [
  { name: "Bronze", min: 0, max: 49, color: "#CD7F32", bg: "#3D2B1F" },
  { name: "Silver", min: 50, max: 69, color: "#C0C0C0", bg: "#2A2A2A" },
  { name: "Gold", min: 70, max: 84, color: "#FFD700", bg: "#3D3400" },
  { name: "Platinum", min: 85, max: 94, color: "#E5E4E2", bg: "#1A2A3A" },
  { name: "Diamond", min: 95, max: 100, color: "#B9F2FF", bg: "#0A2A3A" },
];

function getRank(score) {
  return RANK_TIERS.find(r => score >= r.min && score <= r.max) || RANK_TIERS[0];
}

// --- MOCK AI SCORING ---
function generateMockScores(topic, proName, conName) {
  const r = () => Math.floor(Math.random() * 35) + 55;
  const proC = r(), proE = r(), proEv = r();
  const conC = r(), conE = r(), conEv = r();
  return {
    pro_player: {
      coherence: proC, engagement: proE, evidence: proEv,
      overall_quality: Math.round((proC + proE + proEv) / 3),
      strengths: ["Clear thesis statement", "Strong use of examples"],
      areas_for_improvement: ["Could engage more with opponent's rebuttal", "Closing was rushed"],
    },
    con_player: {
      coherence: conC, engagement: conE, evidence: conEv,
      overall_quality: Math.round((conC + conE + conEv) / 3),
      strengths: ["Effective counterarguments", "Good engagement with opponent's points"],
      areas_for_improvement: ["Opening could be more structured", "Needed stronger evidence"],
    },
    debate_summary: `A spirited exchange on "${topic}". Both sides presented substantive arguments with notable moments of direct engagement.`,
    notable_moments: [
      { timestamp: "2:15", description: "Strong rebuttal from Con on central claim" },
      { timestamp: "4:30", description: "Pro introduced compelling real-world example" },
    ],
    procedural: { pro_strikes: { ad_hominem: false, slurs: false, excessive_profanity: false, non_participation: false }, con_strikes: { ad_hominem: false, slurs: false, excessive_profanity: false, non_participation: false } },
  };
}

// --- SIMULATED OPPONENT ---
const OPPONENT_NAMES = ["DebateKing42", "LogicLord", "SilverTongue", "ThinkTank99", "DevilsAdvocate", "Rhetorician", "FactChecker", "ArgumentAce", "PointCounterpoint", "DialecticPro", "TurboNerd3000", "EagleShouldaFlown"];

// --- APP STATE REDUCER ---
const initialState = {
  screen: "home", // home, login, lobby, queue, prematch, debate, postdebate, debatepage, profile, archive, register, topics
  authLoading: true,
  authError: null,
  user: null, // null = unregistered
  sessionDebates: 0,
  sessionStrikes: 0,
  // matchmaking
  selectedCategory: null,
  selectedTime: 15,
  selectedStance: "either",
  ranked: false,
  // queue
  queueStart: null,
  // prematch
  prematchTopic: null,
  prematchSide: null,
  prematchOpponent: null,
  prematchSwapRequested: false,
  prematchOpponentSwap: false,
  // debate
  debatePhase: null, // opening-pro, opening-con, freeflow, closing-con, closing-pro, ended
  debateTimer: 0,
  debateTotalTime: 0,
  debateTopic: null,
  debateSide: null,
  debateOpponent: null,
  debateMuted: false,
  // post debate
  debateScores: null,
  // archive
  pastDebates: [],
  // votes
  votes: {},
  // all users for leaderboard
  allUsers: [],
  // supabase
  supabaseDebateId: null,
  audioConsentGiven: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SCREEN": return { ...state, screen: action.screen, authError: null };
    case "SET_USER": {
      if (!action.supabaseUser) return { ...state, user: null };
      const meta = action.supabaseUser.user_metadata || {};
      const username = meta.username || action.supabaseUser.email?.split("@")[0] || "User";
      if (action.preserveStats && state.user) {
        return { ...state, user: { ...state.user, id: action.supabaseUser.id, email: action.supabaseUser.email, username }, ...(action.redirect ? { screen: action.redirect } : {}) };
      }
      const user = {
        id: action.supabaseUser.id,
        email: action.supabaseUser.email,
        username,
        quality_score: 65,
        wins: state.pastDebates.filter(d => d.winner === "you").length,
        losses: state.pastDebates.filter(d => d.winner === "opponent").length,
        draws: state.pastDebates.filter(d => d.winner === "draw").length,
        total_debates: state.sessionDebates,
        strikes: state.sessionStrikes,
        registered_at: Date.now(),
      };
      return { ...state, user, ...(action.redirect ? { screen: action.redirect } : {}) };
    }
    case "LOGOUT": return { ...initialState, authLoading: false };
    case "SET_AUTH_LOADING": return { ...state, authLoading: action.loading };
    case "SET_AUTH_ERROR": return { ...state, authError: action.error };
    case "SELECT_CATEGORY": return { ...state, selectedCategory: action.cat, screen: "lobby" };
    case "SET_TIME": return { ...state, selectedTime: action.time };
    case "SET_STANCE": return { ...state, selectedStance: action.stance };
    case "SET_RANKED": return { ...state, ranked: action.ranked };
    case "ENTER_QUEUE": return { ...state, screen: "queue", queueStart: Date.now() };
    case "ENTER_PREMATCH": {
      const cat = state.selectedCategory;
      let topic;
      if (cat === "quick") {
        const allT = Object.values(TOPICS).flat();
        topic = allT[Math.floor(Math.random() * allT.length)];
      } else {
        const pool = TOPICS[cat] || [];
        topic = pool[Math.floor(Math.random() * pool.length)] || { title: "Debate topic TBD", short: "TBD" };
      }
      const side = state.selectedStance === "either" ? (Math.random() > 0.5 ? "pro" : "con") : state.selectedStance;
      const opp = OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)];
      return { ...state, screen: "prematch", prematchTopic: topic, prematchSide: side, prematchOpponent: opp, prematchSwapRequested: false, prematchOpponentSwap: Math.random() > 0.7 };
    }
    case "REQUEST_SWAP": {
      const bothSwap = state.prematchOpponentSwap;
      if (bothSwap) {
        return { ...state, prematchSwapRequested: true, prematchSide: state.prematchSide === "pro" ? "con" : "pro" };
      }
      return { ...state, prematchSwapRequested: true };
    }
    case "START_DEBATE": return {
      ...state,
      screen: "debate",
      debatePhase: "opening-pro",
      debateTimer: 60,
      debateTotalTime: state.selectedTime * 60,
      debateTopic: state.prematchTopic,
      debateSide: state.prematchSide,
      debateOpponent: state.prematchOpponent,
      debateMuted: false,
    };
    case "SET_PHASE": return { ...state, debatePhase: action.phase, debateTimer: action.timer ?? state.debateTimer };
    case "TICK": return { ...state, debateTimer: Math.max(0, state.debateTimer - 1) };
    case "TOGGLE_MUTE": return { ...state, debateMuted: !state.debateMuted };
    case "END_DEBATE": {
      const scores = generateMockScores(state.debateTopic?.title, state.user?.username || "You", state.debateOpponent);
      const proQ = scores.pro_player.overall_quality;
      const conQ = scores.con_player.overall_quality;
      const yourQ = state.debateSide === "pro" ? proQ : conQ;
      const oppQ = state.debateSide === "pro" ? conQ : proQ;
      const winner = yourQ > oppQ + 5 ? "you" : oppQ > yourQ + 5 ? "opponent" : "draw";
      const debate = {
        id: `d${Date.now()}`,
        topic: state.debateTopic,
        side: state.debateSide,
        opponent: state.debateOpponent,
        time: state.selectedTime,
        scores,
        winner,
        date: Date.now(),
        votes: { pro: Math.floor(Math.random() * 50) + 10, con: Math.floor(Math.random() * 50) + 10, draw: Math.floor(Math.random() * 15) },
        ranked: state.ranked,
      };
      const newDebates = [debate, ...state.pastDebates];
      const newUser = state.user ? {
        ...state.user,
        total_debates: state.user.total_debates + 1,
        wins: state.user.wins + (winner === "you" ? 1 : 0),
        losses: state.user.losses + (winner === "opponent" ? 1 : 0),
        draws: state.user.draws + (winner === "draw" ? 1 : 0),
        quality_score: Math.min(100, Math.max(0, Math.round((state.user.quality_score * 0.8) + (yourQ * 0.2)))),
      } : state.user;
      return {
        ...state,
        screen: "postdebate",
        debateScores: scores,
        pastDebates: newDebates,
        sessionDebates: state.sessionDebates + 1,
        user: newUser,
        debatePhase: "ended",
        supabaseDebateId: null,
        audioConsentGiven: false,
      };
    }
    case "FORFEIT": {
      const debate = {
        id: `d${Date.now()}`,
        topic: state.debateTopic,
        side: state.debateSide,
        opponent: state.debateOpponent,
        time: state.selectedTime,
        scores: null,
        winner: "opponent",
        date: Date.now(),
        votes: {},
        forfeit: true,
        ranked: state.ranked,
      };
      const newDebates = [debate, ...state.pastDebates];
      return { ...state, screen: "home", pastDebates: newDebates, sessionDebates: state.sessionDebates + 1 };
    }
    case "VOTE": {
      return { ...state, votes: { ...state.votes, [action.debateId]: action.choice } };
    }
    case "VIEW_DEBATE": return { ...state, screen: "debatepage", viewDebate: action.debate };
    case "SET_SUPABASE_DEBATE_ID": return { ...state, supabaseDebateId: action.id };
    case "GIVE_AUDIO_CONSENT": {
      const col = state.debateSide === "pro" ? "audio_consent_pro" : "audio_consent_con";
      if (state.supabaseDebateId) {
        supabase.from("debates").update({ [col]: true }).eq("id", state.supabaseDebateId);
      }
      return { ...state, audioConsentGiven: true };
    }
    default: return state;
  }
}

// ============================================================
// COMPONENTS
// ============================================================

// --- GLOBAL STYLES ---
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Ruluko&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-deep: #FAF8F5;
    --bg-surface: #F3EDE6;
    --bg-card: #FFFFFF;
    --bg-hover: #FFF5EB;
    --border: #E8DDD0;
    --text: #1A1A1A;
    --text-dim: #6B7280;
    --text-muted: #9CA3AF;
    --accent: #FF6B35;
    --accent-glow: rgba(255, 107, 53, 0.25);
    --pro: #22C55E;
    --con: #EF4444;
    --draw: #F59E0B;
    --pro-bg: rgba(34, 197, 94, 0.08);
    --con-bg: rgba(239, 68, 68, 0.08);
  }

  body {
    font-family: 'Ruluko', sans-serif;
    background: var(--bg-deep);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }

  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: var(--bg-surface); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #D1C4B2; }

  .app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    min-height: 100vh;
  }

  /* TOPBAR */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
  }
  .topbar-logo {
    font-family: 'Ruluko', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
    cursor: pointer;
    letter-spacing: -0.5px;
  }
  .topbar-logo span { color: var(--text-dim); font-weight: 400; }
  .topbar-nav { display: flex; gap: 8px; align-items: center; }
  .topbar-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 16px;
    border-radius: 8px;
    font-family: 'Ruluko', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .topbar-btn:hover { border-color: var(--accent); color: var(--text); }
  .topbar-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
  .topbar-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .topbar-rank {
    width: 10px; height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  /* HOME SCREEN */
  .home-hero {
    text-align: center;
    padding: 64px 0 48px;
    background: var(--bg-surface);
    border-radius: 20px;
    margin-bottom: 32px;
    position: relative;
    overflow: hidden;
  }
  .home-hero::before,
  .home-hero::after {
    content: '';
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    z-index: 0;
  }
  .home-hero::before {
    top: -60px;
    left: -40px;
    background: rgba(255, 107, 53, 0.25);
    animation: hero-breathe 6s ease-in-out infinite;
  }
  .home-hero::after {
    bottom: -60px;
    right: -40px;
    background: rgba(255, 150, 90, 0.2);
    animation: hero-breathe 6s ease-in-out infinite 3s;
  }
  @keyframes hero-breathe {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.15); opacity: 0.6; }
  }
  .home-hero-inner {
    position: relative;
    z-index: 1;
  }
  .home-hero h1 {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -1.5px;
    margin-bottom: 8px;
  }
  .home-hero h1 .accent { color: var(--accent); }
  .home-hero p {
    color: var(--text-dim);
    font-size: 16px;
    max-width: 500px;
    margin: 0 auto 28px;
    line-height: 1.6;
  }

  /* QUICK MATCH */
  .quick-match {
    background: linear-gradient(135deg, #FFF5EB 0%, #FFEEDD 50%, #FFE8D0 100%);
    border: 2px solid var(--accent);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    margin-bottom: 32px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 16px rgba(255,107,53,0.1);
    cursor: pointer;
    transition: all 0.3s;
  }
  .quick-match:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 40px var(--accent-glow);
  }
  .quick-match::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
    opacity: 0.3;
    animation: pulse-glow 3s ease-in-out infinite;
  }
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.15; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(1.05); }
  }
  .quick-match h2 {
    font-size: 28px;
    font-weight: 700;
    position: relative;
    z-index: 1;
    margin-bottom: 4px;
    color: var(--text);
  }
  .quick-match .icon { font-size: 36px; margin-bottom: 8px; position: relative; z-index: 1; }
  .quick-match .sub { color: var(--text-dim); font-size: 14px; position: relative; z-index: 1; }
  .quick-match .queue-count {
    position: relative;
    z-index: 1;
    margin-top: 12px;
    font-family: 'Ruluko', sans-serif;
    font-size: 12px;
    color: var(--accent);
  }

  /* CATEGORY GRID */
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 16px;
  }
  .cat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    margin-bottom: 32px;
  }
  .cat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .cat-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
    transform: translateY(-1px);
  }
  .cat-icon {
    font-size: 28px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .cat-info h3 { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
  .cat-info p { font-size: 12px; color: var(--text-dim); }
  .cat-queue {
    margin-left: auto;
    font-family: 'Ruluko', sans-serif;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* LIVE DEBATE CARDS */
  .live-debates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }
  .live-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .live-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(255,107,53,0.12);
    border-color: var(--accent);
  }
  .live-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .live-badge {
    font-family: 'Ruluko', sans-serif;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .live-badge.live {
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
  }
  .live-badge.open {
    background: rgba(34, 197, 94, 0.1);
    color: #22C55E;
  }
  .live-category-tag {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-surface);
    padding: 3px 8px;
    border-radius: 4px;
  }
  .live-card-topic {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--text);
  }
  .live-card-positions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .live-pos {
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    line-height: 1.3;
  }
  .live-pos.for {
    background: rgba(34, 197, 94, 0.08);
    color: #16A34A;
  }
  .live-pos.against {
    background: rgba(239, 68, 68, 0.08);
    color: #DC2626;
  }
  .live-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
  }
  .live-avatar-stack {
    display: flex;
  }
  .live-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--bg-card);
    margin-left: -8px;
  }
  .live-avatar:first-child { margin-left: 0; }
  .live-participant-count {
    font-size: 12px;
    color: var(--text-muted);
    font-family: 'Ruluko', sans-serif;
  }

  /* SEE ALL TOPICS */
  .see-all-topics {
    display: block;
    width: 100%;
    max-width: 400px;
    margin: 8px auto 40px;
    padding: 18px 32px;
    font-family: 'Ruluko', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
    background: var(--bg-card);
    border: 2px solid var(--border);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.25s;
    letter-spacing: 0.3px;
  }
  .see-all-topics:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
    box-shadow: 0 4px 20px rgba(255,107,53,0.1);
    transform: translateY(-2px);
  }

  /* ABOUT PAGE */
  .about-page {
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 0 64px;
  }
  .about-page h1 {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 8px;
  }
  .about-tagline {
    color: var(--text-dim);
    font-size: 15px;
    margin-bottom: 24px;
  }
  .about-page .about-body {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 32px;
    color: var(--text-dim);
    font-size: 15px;
    line-height: 1.75;
  }
  .about-body h2 {
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
    margin-top: 28px;
    margin-bottom: 10px;
  }
  .about-body h2:first-child { margin-top: 0; }
  .about-body p { margin-bottom: 10px; }
  .about-rules {
    padding-left: 20px;
    margin-bottom: 10px;
  }
  .about-rules li {
    border-left: 2px solid var(--border);
    padding: 6px 0 6px 12px;
    margin-bottom: 6px;
    list-style: none;
    margin-left: -20px;
    padding-left: 16px;
  }

  /* CONSENT BOX */
  .consent-box {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
    text-align: center;
  }
  .consent-box h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .consent-box p { color: var(--text-dim); font-size: 14px; margin-bottom: 16px; }
  .consent-confirmed { color: var(--pro) !important; font-weight: 600; margin-bottom: 0 !important; }

  /* CONTACT FLOAT */
  .contact-float {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 18px;
    font-family: 'Ruluko', sans-serif;
    font-size: 13px;
    color: var(--text-dim);
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    transition: all 0.2s;
    z-index: 50;
    text-decoration: none;
    display: inline-block;
  }
  .contact-float:hover {
    color: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 4px 16px rgba(255,107,53,0.12);
    transform: translateY(-2px);
  }

  /* RECENT DEBATES */
  .recent-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 32px; }
  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
  }
  .recent-item:hover { border-color: var(--text-dim); }
  .recent-topic { flex: 1; font-weight: 500; }
  .recent-result {
    font-family: 'Ruluko', sans-serif;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .recent-result.win { background: var(--pro-bg); color: var(--pro); }
  .recent-result.loss { background: var(--con-bg); color: var(--con); }
  .recent-result.draw { background: rgba(245, 158, 11, 0.15); color: var(--draw); }

  /* LOBBY SCREEN */
  .lobby-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .lobby-header .icon { font-size: 32px; }
  .lobby-header h2 { font-size: 24px; font-weight: 700; }
  .lobby-back {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 13px;
    cursor: pointer;
    font-family: 'Ruluko', sans-serif;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .lobby-back:hover { color: var(--text); }

  .lobby-topics {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }
  .topic-row {
    display: flex;
    align-items: center;
    padding: 14px 18px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .topic-row:hover { border-color: var(--accent); background: var(--bg-hover); }
  .topic-row.selected { border-color: var(--accent); background: rgba(255, 107, 53, 0.08); }
  .topic-row .title { flex: 1; font-size: 14px; font-weight: 500; }
  .topic-row .badge {
    font-family: 'Ruluko', sans-serif;
    font-size: 10px;
    background: var(--bg-surface);
    padding: 3px 8px;
    border-radius: 4px;
    color: var(--text-dim);
  }

  /* CONTROLS */
  .controls-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    align-items: center;
  }
  .control-group { display: flex; flex-direction: column; gap: 6px; }
  .control-group label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-dim);
    font-weight: 600;
  }
  .pill-group { display: flex; gap: 4px; }
  .pill {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-card);
    color: var(--text-dim);
    font-size: 13px;
    font-family: 'Ruluko', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pill:hover { border-color: var(--text-dim); }
  .pill.active { background: var(--accent); border-color: var(--accent); color: white; }
  .pill.pro.active { background: var(--pro); border-color: var(--pro); }
  .pill.con.active { background: var(--con); border-color: var(--con); }
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-dim);
  }
  .toggle-switch {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--border);
    position: relative;
    transition: background 0.2s;
  }
  .toggle-switch.on { background: var(--accent); }
  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: left 0.2s;
  }
  .toggle-switch.on::after { left: 18px; }

  /* BIG BUTTON */
  .big-btn {
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 12px;
    font-family: 'Ruluko', sans-serif;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .big-btn.primary {
    background: linear-gradient(135deg, var(--accent), #E85D26);
    color: white;
  }
  .big-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
  .big-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .big-btn.secondary { background: var(--bg-card); border: 1px solid var(--border); color: var(--text); }
  .big-btn.danger { background: var(--con); color: white; }

  /* QUEUE SCREEN */
  .queue-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
  }
  .queue-spinner {
    width: 80px;
    height: 80px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 24px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .queue-timer {
    font-family: 'Ruluko', sans-serif;
    font-size: 32px;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .queue-info { color: var(--text-dim); font-size: 14px; margin-bottom: 24px; }
  .queue-cancel {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 10px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Ruluko', sans-serif;
    font-size: 13px;
  }

  /* PREMATCH */
  .prematch {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
  }
  .prematch-vs {
    display: flex;
    align-items: center;
    gap: 32px;
    margin-bottom: 24px;
  }
  .prematch-player {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .prematch-side {
    font-family: 'Ruluko', sans-serif;
    font-size: 14px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 6px;
  }
  .prematch-side.pro { background: var(--pro-bg); color: var(--pro); }
  .prematch-side.con { background: var(--con-bg); color: var(--con); }
  .prematch-name { font-size: 18px; font-weight: 600; }
  .prematch-divider {
    font-family: 'Ruluko', sans-serif;
    font-size: 24px;
    color: var(--text-muted);
    font-weight: 700;
  }
  .prematch-topic {
    font-size: 20px;
    font-weight: 600;
    max-width: 500px;
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .swap-btn {
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-family: 'Ruluko', sans-serif;
    font-size: 13px;
    margin-bottom: 24px;
    transition: all 0.2s;
  }
  .swap-btn:hover { border-color: var(--accent); color: var(--text); }
  .swap-btn.requested { border-color: var(--draw); color: var(--draw); cursor: default; }

  /* DEBATE ROOM */
  .debate-room {
    display: flex;
    flex-direction: column;
    min-height: 80vh;
  }
  .debate-top {
    text-align: center;
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
  }
  .debate-topic-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .debate-phase-label {
    font-family: 'Ruluko', sans-serif;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    padding: 4px 12px;
    border-radius: 4px;
    display: inline-block;
  }
  .debate-phase-label.opening { background: rgba(59, 130, 246, 0.15); color: #3B82F6; }
  .debate-phase-label.freeflow { background: rgba(34, 197, 94, 0.15); color: #22C55E; }
  .debate-phase-label.closing { background: rgba(245, 158, 11, 0.15); color: #F59E0B; }

  .debate-timer-big {
    font-family: 'Ruluko', sans-serif;
    font-size: 64px;
    font-weight: 700;
    text-align: center;
    margin: 24px 0;
  }
  .debate-timer-big.low { color: var(--con); animation: timer-pulse 1s ease-in-out infinite; }
  @keyframes timer-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .debate-participants {
    display: flex;
    justify-content: center;
    gap: 48px;
    margin-bottom: 24px;
  }
  .debate-participant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 32px;
    border-radius: 12px;
    border: 2px solid var(--border);
    min-width: 160px;
    transition: all 0.3s;
  }
  .debate-participant.speaking {
    border-color: var(--pro);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
  }
  .debate-participant.muted { opacity: 0.5; }
  .participant-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: white;
  }
  .participant-name { font-size: 14px; font-weight: 600; }
  .mic-indicator {
    font-family: 'Ruluko', sans-serif;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .mic-indicator.live { background: rgba(34, 197, 94, 0.15); color: var(--pro); }
  .mic-indicator.muted { background: rgba(239, 68, 68, 0.15); color: var(--con); }

  .debate-controls {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: auto;
    padding: 20px 0;
  }
  .debate-ctrl-btn {
    padding: 10px 24px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-dim);
    font-family: 'Ruluko', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .debate-ctrl-btn:hover { border-color: var(--text-dim); color: var(--text); }
  .debate-ctrl-btn.mute-btn.muted { background: var(--con); border-color: var(--con); color: white; }
  .debate-ctrl-btn.forfeit { border-color: var(--con); color: var(--con); }
  .debate-ctrl-btn.forfeit:hover { background: var(--con); color: white; }

  /* VOLUME BARS */
  .volume-bars {
    display: flex;
    gap: 2px;
    height: 20px;
    align-items: flex-end;
  }
  .vol-bar {
    width: 4px;
    border-radius: 2px;
    transition: height 0.1s;
  }

  /* POST DEBATE */
  .postdebate { max-width: 700px; margin: 0 auto; }
  .postdebate h2 { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 4px; }
  .postdebate .topic { text-align: center; color: var(--text-dim); font-size: 14px; margin-bottom: 24px; }
  .result-banner {
    text-align: center;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 24px;
    font-size: 20px;
    font-weight: 700;
  }
  .result-banner.win { background: var(--pro-bg); color: var(--pro); border: 1px solid rgba(34,197,94,0.3); }
  .result-banner.loss { background: var(--con-bg); color: var(--con); border: 1px solid rgba(239,68,68,0.3); }
  .result-banner.draw { background: rgba(245,158,11,0.1); color: var(--draw); border: 1px solid rgba(245,158,11,0.3); }

  .score-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }
  .score-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .score-card h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .score-card h3 .side-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .score-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
  }
  .score-row .label { color: var(--text-dim); }
  .score-row .val {
    font-family: 'Ruluko', sans-serif;
    font-weight: 700;
  }
  .score-bar-bg {
    width: 60px;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    margin-left: 8px;
    display: inline-block;
  }
  .score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
  .feedback-list { margin-top: 12px; }
  .feedback-item {
    font-size: 12px;
    color: var(--text-dim);
    padding: 4px 0;
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .feedback-item .dot { color: var(--accent); flex-shrink: 0; }

  .debate-summary-box {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .debate-summary-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .debate-summary-box p { font-size: 13px; color: var(--text-dim); line-height: 1.6; }

  .postdebate-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 32px;
  }
  .postdebate-actions button { flex: 1; }

  /* PROFILE */
  .profile { max-width: 700px; margin: 0 auto; }
  .profile-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
    padding: 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
  }
  .profile-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 800;
    color: white;
  }
  .profile-info h2 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .profile-rank {
    font-family: 'Ruluko', sans-serif;
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 4px;
    display: inline-block;
    margin-bottom: 4px;
  }
  .profile-record {
    font-size: 13px;
    color: var(--text-dim);
    font-family: 'Ruluko', sans-serif;
  }
  .profile-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    text-align: center;
  }
  .stat-card .val {
    font-family: 'Ruluko', sans-serif;
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .stat-card .label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }

  /* REGISTER */
  .register-screen {
    max-width: 400px;
    margin: 60px auto;
    text-align: center;
  }
  .register-screen h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  .register-screen p { color: var(--text-dim); font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
  .register-input {
    width: 100%;
    padding: 14px 18px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    font-family: 'Ruluko', sans-serif;
    font-size: 15px;
    margin-bottom: 12px;
    outline: none;
    transition: border-color 0.2s;
  }
  .register-input:focus { border-color: var(--accent); }
  .register-input::placeholder { color: var(--text-muted); }
  .register-skip {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 13px;
    cursor: pointer;
    margin-top: 12px;
    font-family: 'Ruluko', sans-serif;
  }
  .auth-divider { display:flex; align-items:center; gap:12px; margin:16px 0; color:var(--text-muted); font-size:12px; }
  .auth-divider::before, .auth-divider::after { content:""; flex:1; height:1px; background:var(--border); }
  .auth-error { color: var(--con); font-size: 13px; margin-bottom: 12px; text-align: center; }
  .auth-link { background: none; border: none; color: var(--accent); font-size: 13px; cursor: pointer; margin-top: 8px; font-family: 'Ruluko', sans-serif; text-decoration: underline; }

  /* DEBATE PAGE (archive view) */
  .debatepage { max-width: 700px; margin: 0 auto; }
  .vote-section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    text-align: center;
  }
  .vote-section h3 { font-size: 16px; margin-bottom: 16px; }
  .vote-btns { display: flex; gap: 12px; justify-content: center; }
  .vote-btn {
    padding: 10px 24px;
    border-radius: 10px;
    border: 2px solid var(--border);
    background: var(--bg-surface);
    color: var(--text);
    font-family: 'Ruluko', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
  }
  .vote-btn:hover { transform: translateY(-1px); }
  .vote-btn.pro-vote { border-color: var(--pro); }
  .vote-btn.pro-vote:hover, .vote-btn.pro-vote.selected { background: var(--pro); color: white; }
  .vote-btn.con-vote { border-color: var(--con); }
  .vote-btn.con-vote:hover, .vote-btn.con-vote.selected { background: var(--con); color: white; }
  .vote-btn.draw-vote { border-color: var(--draw); }
  .vote-btn.draw-vote:hover, .vote-btn.draw-vote.selected { background: var(--draw); color: white; }

  .vote-tally {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }
  .tally-bar {
    flex: 1;
    max-width: 300px;
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
  }
  .tally-pro { background: var(--pro); transition: width 0.3s; }
  .tally-con { background: var(--con); transition: width 0.3s; }

  /* GATE PROMPT */
  .gate-overlay {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .gate-box {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
    max-width: 420px;
    text-align: center;
  }
  .gate-box h2 { font-size: 20px; margin-bottom: 8px; }
  .gate-box p { color: var(--text-dim); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
`;

// --- VOLUME BARS COMPONENT ---
function VolumeBars({ active, color = "#22C55E" }) {
  const [bars, setBars] = useState([3, 5, 8, 6, 4]);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setBars(prev => prev.map(() => active ? Math.floor(Math.random() * 16) + 2 : 2));
    }, 150);
    return () => clearInterval(iv);
  }, [active]);
  return (
    <div className="volume-bars">
      {bars.map((h, i) => (
        <div key={i} className="vol-bar" style={{ height: `${h}px`, background: active ? color : "var(--border)" }} />
      ))}
    </div>
  );
}

// --- TOPBAR ---
function TopBar({ state, dispatch }) {
  const rank = state.user ? getRank(state.user.quality_score) : null;
  return (
    <div className="topbar">
      <div className="topbar-logo" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        ARENA<span>.gg</span>
      </div>
      <div className="topbar-nav">
        <button className={`topbar-btn ${state.screen === "home" ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>Home</button>
        <button className={`topbar-btn ${state.screen === "transcripts" ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "transcripts" })}>Transcripts</button>
        <button className={`topbar-btn ${state.screen === "about" ? "active" : ""}`}
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "about" })}>About / FAQ</button>
        {state.pastDebates.length > 0 && (
          <button className={`topbar-btn ${state.screen === "archive" ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "archive" })}>Archive</button>
        )}
        {state.user ? (
          <>
            <div className="topbar-user" onClick={() => dispatch({ type: "SET_SCREEN", screen: "profile" })}>
              <span className="topbar-rank" style={{ background: rank.color }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{state.user.username}</span>
            </div>
            <button className="topbar-btn" onClick={() => supabase.auth.signOut()}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <button className="topbar-btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "login" })}>
              Log In
            </button>
            <button className="topbar-btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "register" })}>
              Sign Up
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// --- HOME SCREEN ---
function HomeScreen({ state, dispatch }) {
  const fakeQueues = useRef(CATEGORIES.map(() => Math.floor(Math.random() * 40) + 5));
  return (
    <div>
      <div className="home-hero">
        <div className="home-hero-inner">
          <h1>Argue with <span className="accent">Strangers.</span> Win nothing.</h1>
          <p>Voice-based debates with random opponents. AI-scored. Community-judged. Climb the ranks from Bronze to Diamond.</p>
        </div>
      </div>

      <div className="quick-match" onClick={() => dispatch({ type: "SELECT_CATEGORY", cat: "quick" })}>
        <div className="icon">⚡</div>
        <h2>Quick Match</h2>
        <div className="sub">Random topic • Random side • Jump in now</div>
        <div className="queue-count">{fakeQueues.current[0]} in queue</div>
      </div>

      <div className="quick-match" style={{ marginBottom: 16 }}
        onClick={() => dispatch({ type: "SET_SCREEN", screen: "transcripts" })}>
        <div className="icon">📜</div>
        <h2>Public Transcripts</h2>
        <div className="sub">Browse past debates — vote on who won</div>
      </div>
      <button className="see-all-topics" onClick={() => dispatch({ type: "SET_SCREEN", screen: "topics" })}>
        See All Topics
      </button>

      {state.pastDebates.length > 0 && (
        <>
          <div className="section-title">Your Recent Debates</div>
          <div className="recent-list">
            {state.pastDebates.slice(0, 5).map(d => (
              <div key={d.id} className="recent-item" onClick={() => dispatch({ type: "VIEW_DEBATE", debate: d })}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {d.side === "pro" ? "🟢" : "🔴"} {d.side.toUpperCase()}
                </span>
                <span className="recent-topic">{d.topic?.short || d.topic?.title || "Unknown"}</span>
                <span className={`recent-result ${d.winner === "you" ? "win" : d.winner === "opponent" ? "loss" : "draw"}`}>
                  {d.forfeit ? "FORFEIT" : d.winner === "you" ? "WIN" : d.winner === "opponent" ? "LOSS" : "DRAW"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- LOBBY SCREEN ---
function LobbyScreen({ state, dispatch }) {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const cat = CATEGORIES.find(c => c.id === state.selectedCategory) || CATEGORIES[0];
  const isQuick = state.selectedCategory === "quick";
  const topics = TOPICS[state.selectedCategory] || [];

  const canQueue = isQuick || selectedTopic;
  const needsRegister = !state.user && state.ranked;

  const handleQueue = () => {
    if (state.sessionDebates >= 5 && !state.user) {
      dispatch({ type: "SET_SCREEN", screen: "register" });
      return;
    }
    dispatch({ type: "ENTER_QUEUE" });
  };

  return (
    <div>
      <button className="lobby-back" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        ← Back to lobbies
      </button>
      <div className="lobby-header">
        <span className="icon">{cat.icon}</span>
        <h2>{cat.name}</h2>
      </div>

      {!isQuick && (
        <>
          <div className="section-title">Select Topic</div>
          <div className="lobby-topics">
            {topics.map(t => (
              <div key={t.id}
                className={`topic-row ${selectedTopic?.id === t.id ? "selected" : ""}`}
                onClick={() => setSelectedTopic(t)}>
                <span className="title">{t.title}</span>
                <span className="badge">{Math.floor(Math.random() * 20) + 3} debates</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="controls-row">
        <div className="control-group">
          <label>Time Limit</label>
          <div className="pill-group">
            {(isQuick || cat.id === "silly" || cat.id === "fantasy" ? [5, 15] : TIME_OPTIONS).map(t => (
              <button key={t} className={`pill ${state.selectedTime === t ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_TIME", time: t })}>
                {t}m
              </button>
            ))}
          </div>
        </div>

        {!isQuick && (
          <div className="control-group">
            <label>Stance</label>
            <div className="pill-group">
              <button className={`pill ${state.selectedStance === "either" ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_STANCE", stance: "either" })}>Either</button>
              <button className={`pill pro ${state.selectedStance === "pro" ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_STANCE", stance: "pro" })}>Pro</button>
              <button className={`pill con ${state.selectedStance === "con" ? "active" : ""}`}
                onClick={() => dispatch({ type: "SET_STANCE", stance: "con" })}>Con</button>
            </div>
          </div>
        )}

        <div className="control-group" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <div className="toggle" onClick={() => {
            if (!state.user) {
              dispatch({ type: "SET_SCREEN", screen: "register" });
              return;
            }
            dispatch({ type: "SET_RANKED", ranked: !state.ranked });
          }}>
            <div className={`toggle-switch ${state.ranked ? "on" : ""}`} />
            <span>Ranked {!state.user && <span style={{ fontSize: 10 }}>(sign up)</span>}</span>
          </div>
        </div>
      </div>

      <button className="big-btn primary" disabled={!canQueue} onClick={handleQueue}>
        {isQuick ? "⚡ Find Match" : "Enter Queue"}
      </button>

      {state.sessionDebates >= 3 && !state.user && (
        <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, marginTop: 12 }}>
          {5 - state.sessionDebates} guest debates remaining.{" "}
          <span style={{ color: "var(--accent)", cursor: "pointer" }}
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "register" })}>
            Register to unlock unlimited debates
          </span>
        </p>
      )}
    </div>
  );
}

// --- QUEUE SCREEN ---
function QueueScreen({ state, dispatch }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const matchTime = Math.floor(Math.random() * 4000) + 2000;
    const to = setTimeout(() => {
      if (document.hidden && Notification.permission === "granted") {
        const n = new Notification("Match Found!", {
          body: "You have 90 seconds to join the room.",
          icon: "/vite.svg",
        });
        n.onclick = () => { window.focus(); n.close(); };
      }
      dispatch({ type: "ENTER_PREMATCH" });
    }, matchTime);
    return () => clearTimeout(to);
  }, []);

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="queue-screen">
      <div className="queue-spinner" />
      <div className="queue-timer">{fmt(elapsed)}</div>
      <div className="queue-info">
        Searching for opponent...
        <br />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {state.selectedCategory === "quick" ? "Random topic" : CATEGORIES.find(c => c.id === state.selectedCategory)?.name} • {state.selectedTime}min
          {state.ranked && " • Ranked"}
        </span>
      </div>
      <button className="queue-cancel" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        Cancel
      </button>
    </div>
  );
}

// --- PREMATCH LOBBY ---
function PrematchScreen({ state, dispatch }) {
  const [countdown, setCountdown] = useState(90);

  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (countdown === 0) dispatch({ type: "START_DEBATE" });
  }, [countdown]);

  const yourName = state.user?.username || "You";
  const yourSide = state.prematchSide;
  const oppSide = yourSide === "pro" ? "con" : "pro";

  return (
    <div className="prematch">
      <div style={{ fontFamily: "'Ruluko', sans-serif", fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
        MATCH FOUND
      </div>
      <div style={{ fontFamily: "'Ruluko', sans-serif", fontSize: 32, color: "var(--accent)", marginBottom: 24 }}>
        {countdown}
      </div>

      <div className="prematch-topic">{state.prematchTopic?.title}</div>

      <div className="prematch-vs">
        <div className="prematch-player">
          <span className={`prematch-side ${yourSide}`}>{yourSide.toUpperCase()}</span>
          <span className="prematch-name">{yourName}</span>
        </div>
        <span className="prematch-divider">VS</span>
        <div className="prematch-player">
          <span className={`prematch-side ${oppSide}`}>{oppSide.toUpperCase()}</span>
          <span className="prematch-name">{state.prematchOpponent}</span>
        </div>
      </div>

      <button
        className={`swap-btn ${state.prematchSwapRequested ? "requested" : ""}`}
        onClick={() => !state.prematchSwapRequested && dispatch({ type: "REQUEST_SWAP" })}
      >
        {state.prematchSwapRequested
          ? (state.prematchOpponentSwap ? "✓ Sides swapped!" : "⏳ Swap requested — waiting for opponent")
          : "🔄 Request side swap"
        }
      </button>

      <button className="big-btn primary" style={{ maxWidth: 300 }} onClick={() => dispatch({ type: "START_DEBATE" })}>
        Ready
      </button>
    </div>
  );
}

// --- DEBATE ROOM ---
function DebateRoom({ state, dispatch }) {
  const [timer, setTimer] = useState(60);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [phase, setPhase] = useState("opening-pro"); // opening-pro, opening-con, freeflow, closing-con, closing-pro
  const totalTime = state.debateTotalTime;
  const yourSide = state.debateSide;
  const yourName = state.user?.username || "You";

  // Phase management
  useEffect(() => {
    const iv = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // Advance phase
          if (phase === "opening-pro") {
            setPhase("opening-con");
            return 60;
          } else if (phase === "opening-con") {
            setPhase("freeflow");
            const freeflowTime = totalTime - 240; // total minus 4x60s structured
            return Math.max(60, freeflowTime);
          } else if (phase === "freeflow") {
            setPhase("closing-con");
            return 60;
          } else if (phase === "closing-con") {
            setPhase("closing-pro");
            return 60;
          } else if (phase === "closing-pro") {
            clearInterval(iv);
            dispatch({ type: "END_DEBATE" });
            return 0;
          }
        }
        return t - 1;
      });
      setTotalElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, totalTime]);

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const phaseLabel = {
    "opening-pro": "Opening Statement — Pro",
    "opening-con": "Opening Statement — Con",
    "freeflow": "Free-Flow Discussion",
    "closing-con": "Closing Statement — Con",
    "closing-pro": "Closing Statement — Pro",
  }[phase];

  const phaseClass = phase.includes("opening") ? "opening" : phase === "freeflow" ? "freeflow" : "closing";

  // Who's speaking
  const isFreeflow = phase === "freeflow";
  const proSpeaking = phase === "opening-pro" || phase === "closing-pro" || isFreeflow;
  const conSpeaking = phase === "opening-con" || phase === "closing-con" || isFreeflow;
  const youSpeaking = (yourSide === "pro" && proSpeaking) || (yourSide === "con" && conSpeaking);
  const oppSpeaking = (yourSide === "pro" && conSpeaking) || (yourSide === "con" && proSpeaking);

  return (
    <div className="debate-room">
      <div className="debate-top">
        <div className="debate-topic-title">{state.debateTopic?.title}</div>
        <span className={`debate-phase-label ${phaseClass}`}>{phaseLabel}</span>
      </div>

      <div className={`debate-timer-big ${timer <= 10 ? "low" : ""}`} style={{ color: timer <= 10 ? "var(--con)" : "var(--text)" }}>
        {fmt(timer)}
      </div>

      <div className="debate-participants">
        <div className={`debate-participant ${youSpeaking && !state.debateMuted ? "speaking" : ""} ${state.debateMuted ? "muted" : ""}`}>
          <div className="participant-avatar" style={{ background: yourSide === "pro" ? "var(--pro)" : "var(--con)" }}>
            {(yourName[0] || "Y").toUpperCase()}
          </div>
          <span className="participant-name">{yourName}</span>
          <span className={`prematch-side ${yourSide}`} style={{ fontSize: 11 }}>{yourSide.toUpperCase()}</span>
          <span className={`mic-indicator ${state.debateMuted ? "muted" : "live"}`}>
            {state.debateMuted ? "🔇 MUTED" : "🎙 LIVE"}
          </span>
          <VolumeBars active={youSpeaking && !state.debateMuted} color={yourSide === "pro" ? "#22C55E" : "#EF4444"} />
        </div>

        <div className={`debate-participant ${oppSpeaking ? "speaking" : ""}`}>
          <div className="participant-avatar" style={{ background: yourSide === "pro" ? "var(--con)" : "var(--pro)" }}>
            {state.debateOpponent[0].toUpperCase()}
          </div>
          <span className="participant-name">{state.debateOpponent}</span>
          <span className={`prematch-side ${yourSide === "pro" ? "con" : "pro"}`} style={{ fontSize: 11 }}>
            {yourSide === "pro" ? "CON" : "PRO"}
          </span>
          <span className="mic-indicator live">🎙 LIVE</span>
          <VolumeBars active={oppSpeaking} color={yourSide === "pro" ? "#EF4444" : "#22C55E"} />
        </div>
      </div>

      {isFreeflow && (
        <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 12, marginBottom: 12 }}>
          Both mics are live — debate naturally
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        Total elapsed: {fmt(totalElapsed)} / {fmt(totalTime)}
      </div>

      <div className="debate-controls">
        <button
          className={`debate-ctrl-btn mute-btn ${state.debateMuted ? "muted" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_MUTE" })}
        >
          {state.debateMuted ? "🔇 Unmute" : "🎙 Mute"}
        </button>
        <button className="debate-ctrl-btn">⚠️ Report</button>
        <button className="debate-ctrl-btn forfeit" onClick={() => {
          if (window.confirm("Forfeit this debate? This counts as a loss.")) {
            dispatch({ type: "FORFEIT" });
          }
        }}>
          🏳️ Forfeit
        </button>
      </div>
    </div>
  );
}

// --- POST DEBATE ---
function PostDebate({ state, dispatch }) {
  const s = state.debateScores;
  if (!s) return null;

  const lastDebate = state.pastDebates[0];
  const winner = lastDebate?.winner;

  const renderScoreCard = (player, label, side) => (
    <div className="score-card">
      <h3>
        <span className="side-dot" style={{ background: side === "pro" ? "var(--pro)" : "var(--con)" }} />
        {label} ({side.toUpperCase()})
      </h3>
      {["coherence", "engagement", "evidence", "overall_quality"].map(key => (
        <div className="score-row" key={key}>
          <span className="label">{key === "overall_quality" ? "Overall" : key.charAt(0).toUpperCase() + key.slice(1)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="val" style={{ color: player[key] >= 75 ? "var(--pro)" : player[key] >= 50 ? "var(--draw)" : "var(--con)" }}>
              {player[key]}
            </span>
            <span className="score-bar-bg">
              <div className="score-bar-fill" style={{
                width: `${player[key]}%`,
                background: player[key] >= 75 ? "var(--pro)" : player[key] >= 50 ? "var(--draw)" : "var(--con)"
              }} />
            </span>
          </span>
        </div>
      ))}
      <div className="feedback-list">
        {player.strengths?.map((s, i) => (
          <div key={i} className="feedback-item"><span className="dot">+</span> {s}</div>
        ))}
        {player.areas_for_improvement?.map((s, i) => (
          <div key={i} className="feedback-item"><span className="dot" style={{ color: "var(--con)" }}>−</span> {s}</div>
        ))}
      </div>
    </div>
  );

  const yourSide = state.debateSide;
  const yourScores = yourSide === "pro" ? s.pro_player : s.con_player;
  const oppScores = yourSide === "pro" ? s.con_player : s.pro_player;
  const yourName = state.user?.username || "You";

  return (
    <div className="postdebate">
      <h2>Debate Complete</h2>
      <p className="topic">{state.debateTopic?.title}</p>

      <div className={`result-banner ${winner === "you" ? "win" : winner === "opponent" ? "loss" : "draw"}`}>
        {winner === "you" ? "🏆 Victory" : winner === "opponent" ? "Defeat" : "🤝 Draw"}
      </div>

      <div className="score-cards">
        {renderScoreCard(yourScores, yourName, yourSide)}
        {renderScoreCard(oppScores, state.debateOpponent, yourSide === "pro" ? "con" : "pro")}
      </div>

      <div className="debate-summary-box">
        <h3>AI Summary</h3>
        <p>{s.debate_summary}</p>
        {s.notable_moments?.map((m, i) => (
          <p key={i} style={{ fontSize: 12, marginTop: 6 }}>
            <span style={{ fontFamily: "'Ruluko', sans-serif", color: "var(--accent)" }}>[{m.timestamp}]</span>{" "}
            <span style={{ color: "var(--text-dim)" }}>{m.description}</span>
          </p>
        ))}
      </div>

      {state.supabaseDebateId && (
        <div className="consent-box">
          <h3>Audio Upload Consent</h3>
          <p>Allow your audio to be transcribed and added to the public transcript?</p>
          {!state.audioConsentGiven ? (
            <button className="big-btn secondary"
              onClick={() => dispatch({ type: "GIVE_AUDIO_CONSENT" })}>
              Yes, upload my audio
            </button>
          ) : (
            <p className="consent-confirmed">✓ Consent recorded — waiting on opponent</p>
          )}
        </div>
      )}

      <div className="postdebate-actions">
        <button className="big-btn primary" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
          Play Again
        </button>
        {!state.user && (
          <button className="big-btn secondary" onClick={() => dispatch({ type: "SET_SCREEN", screen: "register" })}>
            Register to Track Stats
          </button>
        )}
      </div>
    </div>
  );
}

// --- DEBATE PAGE (archive view) ---
function DebatePage({ state, dispatch }) {
  const d = state.viewDebate;
  if (!d) return null;
  const voted = state.votes[d.id];
  const proVotes = d.votes?.pro || 0;
  const conVotes = d.votes?.con || 0;
  const total = proVotes + conVotes + (d.votes?.draw || 0) || 1;

  return (
    <div className="debatepage">
      <button className="lobby-back" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>← Back</button>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{d.topic?.title}</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 20 }}>
        {d.side?.toUpperCase()} vs {d.side === "pro" ? "CON" : "PRO"} • {d.time}min
        {d.forfeit && " • FORFEIT"}
      </p>

      {state.user && !d.forfeit && (
        <div className="vote-section">
          <h3>Who won this debate?</h3>
          <div className="vote-btns">
            <button className={`vote-btn pro-vote ${voted === "pro" ? "selected" : ""}`}
              onClick={() => dispatch({ type: "VOTE", debateId: d.id, choice: "pro" })}>
              Pro
            </button>
            <button className={`vote-btn draw-vote ${voted === "draw" ? "selected" : ""}`}
              onClick={() => dispatch({ type: "VOTE", debateId: d.id, choice: "draw" })}>
              Draw
            </button>
            <button className={`vote-btn con-vote ${voted === "con" ? "selected" : ""}`}
              onClick={() => dispatch({ type: "VOTE", debateId: d.id, choice: "con" })}>
              Con
            </button>
          </div>
          <div className="vote-tally">
            <span style={{ fontSize: 12, color: "var(--pro)", fontFamily: "'Ruluko', sans-serif" }}>
              {Math.round(proVotes / total * 100)}%
            </span>
            <div className="tally-bar">
              <div className="tally-pro" style={{ width: `${proVotes / total * 100}%` }} />
              <div className="tally-con" style={{ width: `${conVotes / total * 100}%` }} />
            </div>
            <span style={{ fontSize: 12, color: "var(--con)", fontFamily: "'Ruluko', sans-serif" }}>
              {Math.round(conVotes / total * 100)}%
            </span>
          </div>
        </div>
      )}

      {d.scores && (
        <div className="score-cards" style={{ marginBottom: 24 }}>
          <div className="score-card">
            <h3><span className="side-dot" style={{ background: "var(--pro)" }} /> Pro</h3>
            {["coherence", "engagement", "evidence", "overall_quality"].map(key => (
              <div className="score-row" key={key}>
                <span className="label">{key === "overall_quality" ? "Overall" : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <span className="val">{d.scores.pro_player[key]}</span>
              </div>
            ))}
          </div>
          <div className="score-card">
            <h3><span className="side-dot" style={{ background: "var(--con)" }} /> Con</h3>
            {["coherence", "engagement", "evidence", "overall_quality"].map(key => (
              <div className="score-row" key={key}>
                <span className="label">{key === "overall_quality" ? "Overall" : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <span className="val">{d.scores.con_player[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="big-btn primary" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        Back to Home
      </button>
    </div>
  );
}

// --- PROFILE ---
function ProfileScreen({ state, dispatch }) {
  const u = state.user;
  if (!u) return <div>Not registered</div>;
  const rank = getRank(u.quality_score);

  return (
    <div className="profile">
      <div className="profile-header">
        <div className="profile-avatar" style={{ background: rank.color }}>{u.username[0].toUpperCase()}</div>
        <div className="profile-info">
          <h2>{u.username}</h2>
          <span className="profile-rank" style={{ background: rank.bg, color: rank.color, border: `1px solid ${rank.color}40` }}>
            {rank.name}
          </span>
          <div className="profile-record">
            {u.wins}W – {u.losses}L – {u.draws}D
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "center" }}>
          <div style={{ fontFamily: "'Ruluko', sans-serif", fontSize: 36, fontWeight: 700, color: rank.color }}>
            {u.quality_score}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Quality Score</div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <div className="val">{u.total_debates}</div>
          <div className="label">Debates</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: "var(--pro)" }}>{u.wins}</div>
          <div className="label">Wins</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: "var(--con)" }}>{u.losses}</div>
          <div className="label">Losses</div>
        </div>
        <div className="stat-card">
          <div className="val" style={{ color: "var(--draw)" }}>{u.draws}</div>
          <div className="label">Draws</div>
        </div>
      </div>

      {state.pastDebates.length > 0 && (
        <>
          <div className="section-title">Debate History</div>
          <div className="recent-list">
            {state.pastDebates.map(d => (
              <div key={d.id} className="recent-item" onClick={() => dispatch({ type: "VIEW_DEBATE", debate: d })}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {d.side === "pro" ? "🟢" : "🔴"}
                </span>
                <span className="recent-topic">{d.topic?.short || "Unknown"}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Ruluko', sans-serif" }}>
                  vs {d.opponent}
                </span>
                <span className={`recent-result ${d.winner === "you" ? "win" : d.winner === "opponent" ? "loss" : "draw"}`}>
                  {d.forfeit ? "FF" : d.winner === "you" ? "W" : d.winner === "opponent" ? "L" : "D"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="big-btn secondary" style={{ marginTop: 24, width: "100%" }}
        onClick={() => supabase.auth.signOut()}>
        Log Out
      </button>
    </div>
  );
}

// --- LOGIN SCREEN ---
function LoginScreen({ state, dispatch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    dispatch({ type: "SET_AUTH_ERROR", error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) dispatch({ type: "SET_AUTH_ERROR", error: error.message });
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };

  return (
    <div className="register-screen">
      <h2>Welcome Back</h2>
      <p>Log in to continue debating and track your stats.</p>
      {state.authError && <div className="auth-error">{state.authError}</div>}
      <input className="register-input" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)} type="email" />
      <input className="register-input" placeholder="Password" value={password}
        onChange={e => setPassword(e.target.value)} type="password" />
      <button className="big-btn primary" disabled={!email.trim() || password.length < 6 || loading}
        onClick={handleLogin}>
        {loading ? "Logging in..." : "Log In"}
      </button>
      <div className="auth-divider">or</div>
      <button className="big-btn secondary" onClick={handleGoogle}>
        Continue with Google
      </button>
      <button className="auth-link" onClick={() => dispatch({ type: "SET_SCREEN", screen: "register" })}>
        Don't have an account? Sign up
      </button>
      <button className="register-skip" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        Continue as guest
      </button>
    </div>
  );
}

// --- REGISTER SCREEN ---
function RegisterScreen({ state, dispatch }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isGated = state.sessionDebates >= 5;

  const handleRegister = async () => {
    setLoading(true);
    dispatch({ type: "SET_AUTH_ERROR", error: null });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) dispatch({ type: "SET_AUTH_ERROR", error: error.message });
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };

  const canSubmit = username.trim() && email.trim() && password.length >= 6 && !loading;

  return (
    <div className="register-screen">
      <h2>{isGated ? "Guest Limit Reached" : "Join the Arena"}</h2>
      <p>
        {isGated
          ? "You've completed 5 guest debates. Register to continue debating, access ranked play, vote on debates, and track your stats."
          : "Create an account to unlock ranked matchmaking, async debates, community voting, and stat tracking."
        }
      </p>
      {state.authError && <div className="auth-error">{state.authError}</div>}
      <input className="register-input" placeholder="Username" value={username}
        onChange={e => setUsername(e.target.value)} />
      <input className="register-input" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)} type="email" />
      <input className="register-input" placeholder="Password (min 6 characters)" value={password}
        onChange={e => setPassword(e.target.value)} type="password" />
      <button className="big-btn primary" disabled={!canSubmit}
        onClick={handleRegister}>
        {loading ? "Creating account..." : "Create Account"}
      </button>
      <div className="auth-divider">or</div>
      <button className="big-btn secondary" onClick={handleGoogle}>
        Continue with Google
      </button>
      <button className="auth-link" onClick={() => dispatch({ type: "SET_SCREEN", screen: "login" })}>
        Already have an account? Log in
      </button>
      {!isGated && (
        <button className="register-skip" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
          Continue as guest ({5 - state.sessionDebates} debates remaining)
        </button>
      )}
    </div>
  );
}

// --- ABOUT / FAQ ---
function AboutScreen({ state, dispatch }) {
  return (
    <div className="about-page">
      <h1>About Arena.gg</h1>
      <div className="about-body">
        <p className="about-tagline">Save your friendships, spare your spouse - argue with strangers online.</p>

        <p>We all know social media, and now AI as well, is deeply bias confirming, designed to irritate you just enough so you keep scrolling, designed to show the worst of the "other side" so you stay firmly categorized in your group.</p>

        <p>This website is NOT for everyone. This is a place to scratch an itch, the itch to spar, debate, disagree, with real people, with real issues.</p>

        <h2>A couple things:</h2>
        <ul className="about-rules">
          <li>Debates are private rooms — no spectators — like a match with a stranger on chess.com</li>
          <li>Voice mode only — no video.</li>
          <li>The transcript will be posted publicly, but the audio file will only be transcribed if BOTH players consent, after the match.</li>
          <li>Basic rules: Ad-hominem and <em>excess</em> profanity will be penalized. Instances of "bad faith" will be analyzed first by the AI, second by humans, before penalties are issued.</li>
        </ul>

        <p>The goal is not to agree, but to represent your case, test your verbal intelligence, train rhetorical skills, and blow off a little steam.</p>

        <p>Registered users are able to vote, one vote per user, on the transcripts page, this community score is the only lasting record of wins and losses.</p>

        <p>If you navigate away from the browser window during matchmaking, you will be notified when a match is found, and have 90 seconds to join the room.</p>
      </div>
    </div>
  );
}

// --- TOPICS ---
function TopicsScreen({ state, dispatch }) {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <button className="lobby-back" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        ← Back to Home
      </button>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>All Topics</h2>
      {CATEGORIES.filter(c => c.id !== "quick").map(cat => (
        <div key={cat.id} style={{ marginBottom: 32 }}>
          <div className="section-title" style={{ color: cat.color }}>
            {cat.icon} {cat.name}
          </div>
          {(TOPICS[cat.id] || []).map(topic => (
            <div
              key={topic.id}
              className="topic-row"
              onClick={() => dispatch({ type: "SELECT_CATEGORY", cat: cat.id })}
            >
              <span className="title">{topic.title}</span>
              <span className="badge">{topic.short}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- TRANSCRIPTS ---
function TranscriptsScreen({ state, dispatch }) {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [voted, setVoted] = useState({});

  useEffect(() => {
    supabase.from("debates").select("*, votes(choice)").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setDebates(data || []); setLoading(false); });
  }, []);

  const handleVote = async (debateId, choice) => {
    if (!state.user) {
      dispatch({ type: "SET_SCREEN", screen: "register" });
      return;
    }
    if (voted[debateId]) return;
    const { error } = await supabase.from("votes").insert({ debate_id: debateId, user_id: state.user.id, choice });
    if (!error) {
      setVoted(v => ({ ...v, [debateId]: choice }));
      setDebates(ds => ds.map(d =>
        d.id === debateId ? { ...d, votes: [...(d.votes || []), { choice }] } : d
      ));
    }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  const winnerBadge = (w) => {
    if (!w) return null;
    const colors = { pro: "var(--pro)", con: "var(--con)", draw: "var(--draw)" };
    return <span style={{ fontSize: 11, fontWeight: 700, color: colors[w], marginLeft: 8, textTransform: "uppercase" }}>{w}</span>;
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <button className="lobby-back" onClick={() => dispatch({ type: "SET_SCREEN", screen: "home" })}>
        ← Back to Home
      </button>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Public Transcripts</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 24 }}>Browse past debates and vote on who won.</p>

      {loading && <p style={{ color: "var(--text-dim)" }}>Loading debates...</p>}
      {!loading && debates.length === 0 && (
        <p style={{ color: "var(--text-dim)" }}>No public debates yet. Complete a debate to add the first one!</p>
      )}

      <div className="recent-list">
        {debates.map(d => {
          const vArr = d.votes || [];
          const vPro  = vArr.filter(v => v.choice === "pro").length;
          const vCon  = vArr.filter(v => v.choice === "con").length;
          const vDraw = vArr.filter(v => v.choice === "draw").length;
          const total = vPro + vCon + vDraw || 1;
          const isOpen = selected?.id === d.id;
          return (
            <div key={d.id} style={{ marginBottom: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div
                className="recent-item"
                style={{ cursor: "pointer", padding: "14px 16px", borderBottom: isOpen ? "1px solid var(--border)" : "none" }}
                onClick={() => setSelected(isOpen ? null : d)}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Ruluko', sans-serif" }}>{fmt(d.created_at)}</span>
                <span className="recent-topic" style={{ flex: 1 }}>{d.topic_title}</span>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {d.pro_username} vs {d.con_username}
                  {winnerBadge(d.winner)}
                </span>
              </div>

              {isOpen && (
                <div style={{ padding: "16px" }}>
                  {d.ai_summary && (
                    <div className="debate-summary-box" style={{ marginBottom: 16 }}>
                      <h3>AI Summary</h3>
                      <p>{d.ai_summary}</p>
                      {d.notable_moments?.map((m, i) => (
                        <p key={i} style={{ fontSize: 12, marginTop: 6 }}>
                          <span style={{ fontFamily: "'Ruluko', sans-serif", color: "var(--accent)" }}>[{m.timestamp}]</span>{" "}
                          <span style={{ color: "var(--text-dim)" }}>{m.description}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {(d.pro_scores || d.con_scores) && (
                    <div className="score-cards" style={{ marginBottom: 16 }}>
                      {d.pro_scores && (
                        <div className="score-card">
                          <h3><span className="side-dot" style={{ background: "var(--pro)" }} /> Pro — {d.pro_username}</h3>
                          {["coherence", "engagement", "evidence", "overall_quality"].map(key => (
                            <div className="score-row" key={key}>
                              <span className="label">{key === "overall_quality" ? "Overall" : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                              <span className="val" style={{ color: d.pro_scores[key] >= 75 ? "var(--pro)" : d.pro_scores[key] >= 50 ? "var(--draw)" : "var(--con)" }}>
                                {d.pro_scores[key]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {d.con_scores && (
                        <div className="score-card">
                          <h3><span className="side-dot" style={{ background: "var(--con)" }} /> Con — {d.con_username}</h3>
                          {["coherence", "engagement", "evidence", "overall_quality"].map(key => (
                            <div className="score-row" key={key}>
                              <span className="label">{key === "overall_quality" ? "Overall" : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                              <span className="val" style={{ color: d.con_scores[key] >= 75 ? "var(--pro)" : d.con_scores[key] >= 50 ? "var(--draw)" : "var(--con)" }}>
                                {d.con_scores[key]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="vote-section">
                    <h3>Who won this debate?</h3>
                    <div className="vote-btns">
                      <button className={`vote-btn pro-vote ${voted[d.id] === "pro" ? "selected" : ""}`}
                        onClick={() => handleVote(d.id, "pro")}>
                        Pro
                      </button>
                      <button className={`vote-btn draw-vote ${voted[d.id] === "draw" ? "selected" : ""}`}
                        onClick={() => handleVote(d.id, "draw")}>
                        Draw
                      </button>
                      <button className={`vote-btn con-vote ${voted[d.id] === "con" ? "selected" : ""}`}
                        onClick={() => handleVote(d.id, "con")}>
                        Con
                      </button>
                    </div>
                    <div className="vote-tally" style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 12, color: "var(--pro)", fontFamily: "'Ruluko', sans-serif" }}>
                        Pro {vPro}
                      </span>
                      <div className="tally-bar">
                        <div className="tally-pro" style={{ width: `${(vPro / total) * 100}%` }} />
                        <div className="tally-con" style={{ width: `${(vCon / total) * 100}%` }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--con)", fontFamily: "'Ruluko', sans-serif" }}>
                        Con {vCon}
                      </span>
                    </div>
                    {!state.user && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
                        <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => dispatch({ type: "SET_SCREEN", screen: "register" })}>
                          Sign up
                        </span>{" "}to vote
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- ARCHIVE ---
function ArchiveScreen({ state, dispatch }) {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Debate Archive</h2>
      {state.pastDebates.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No debates yet. Jump into a Quick Match!</p>
      ) : (
        <div className="recent-list">
          {state.pastDebates.map(d => (
            <div key={d.id} className="recent-item" onClick={() => dispatch({ type: "VIEW_DEBATE", debate: d })}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {d.side === "pro" ? "🟢" : "🔴"} {d.side?.toUpperCase()}
              </span>
              <span className="recent-topic">{d.topic?.title || "Unknown"}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Ruluko', sans-serif" }}>
                vs {d.opponent} • {d.time}m
              </span>
              <span className={`recent-result ${d.winner === "you" ? "win" : d.winner === "opponent" ? "loss" : "draw"}`}>
                {d.forfeit ? "FORFEIT" : d.winner === "you" ? "WIN" : d.winner === "opponent" ? "LOSS" : "DRAW"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================
// MAIN APP
// ============================================================
export default function DebatePlatform() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const prevDebatesLen = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        dispatch({ type: "SET_USER", supabaseUser: session.user });
      }
      dispatch({ type: "SET_AUTH_LOADING", loading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        dispatch({ type: "SET_USER", supabaseUser: session.user, redirect: "home" });
      } else if (event === "SIGNED_OUT") {
        dispatch({ type: "LOGOUT" });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state.pastDebates.length > prevDebatesLen.current && state.user) {
      const d = state.pastDebates[0];
      const isProSide = d.side === "pro";
      supabase.from("debates").insert({
        topic_title: d.topic?.title,
        topic_short: d.topic?.short,
        category: d.topic?.id?.replace(/\d+$/, "") || null,
        pro_user_id: isProSide ? state.user.id : null,
        con_user_id: isProSide ? null : state.user.id,
        pro_username: isProSide ? state.user.username : d.opponent,
        con_username: isProSide ? d.opponent : state.user.username,
        duration_minutes: d.time,
        winner: d.winner === "you" ? d.side : d.winner === "opponent" ? (d.side === "pro" ? "con" : "pro") : "draw",
        ai_summary: d.scores?.debate_summary,
        pro_scores: d.scores?.pro_player,
        con_scores: d.scores?.con_player,
        notable_moments: d.scores?.notable_moments,
        votes_pro: 0,
        votes_con: 0,
        votes_draw: 0,
        ranked: d.ranked,
      }).select().then(({ data, error }) => {
        if (data?.[0]?.id) dispatch({ type: "SET_SUPABASE_DEBATE_ID", id: data[0].id });
      });
    }
    prevDebatesLen.current = state.pastDebates.length;
  }, [state.pastDebates]);

  if (state.authLoading) {
    return (
      <>
        <style>{css}</style>
        <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ color: "var(--text-dim)", fontSize: 16 }}>Loading...</div>
        </div>
      </>
    );
  }

  const screens = {
    home: <HomeScreen state={state} dispatch={dispatch} />,
    login: <LoginScreen state={state} dispatch={dispatch} />,
    lobby: <LobbyScreen state={state} dispatch={dispatch} />,
    queue: <QueueScreen state={state} dispatch={dispatch} />,
    prematch: <PrematchScreen state={state} dispatch={dispatch} />,
    debate: <DebateRoom state={state} dispatch={dispatch} />,
    postdebate: <PostDebate state={state} dispatch={dispatch} />,
    debatepage: <DebatePage state={state} dispatch={dispatch} />,
    profile: <ProfileScreen state={state} dispatch={dispatch} />,
    topics: <TopicsScreen state={state} dispatch={dispatch} />,
    archive: <ArchiveScreen state={state} dispatch={dispatch} />,
    register: <RegisterScreen state={state} dispatch={dispatch} />,
    about: <AboutScreen state={state} dispatch={dispatch} />,
    transcripts: <TranscriptsScreen state={state} dispatch={dispatch} />,
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <TopBar state={state} dispatch={dispatch} />
        {screens[state.screen] || screens.home}
      </div>
      <a className="contact-float" href="mailto:hello@arena.gg">
        Want help? Have suggestions?
      </a>
    </>
  );
}
