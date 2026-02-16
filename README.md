# Arena.gg — Debate Platform

Voice-based debate platform with matchmaking, AI scoring, and community voting.

## Stack

| Service | Purpose |
|---------|---------|
| Next.js 14 (App Router) | Frontend + API routes |
| Supabase | Postgres DB, auth, realtime subscriptions |
| Daily.co | WebRTC audio rooms (verbalviol.daily.co) |
| Deepgram | Speech-to-text transcription |
| Anthropic Claude | Two-tiered AI debate scoring |
| Vercel | Hosting |

## Project Structure

```
debate-platform/
├── app/api/
│   ├── auth/register/route.js      User registration + session migration
│   ├── auth/session/route.js       Guest session management
│   ├── matchmaking/queue/route.js  Enter/leave matchmaking queue
│   ├── daily/room/route.js         Get Daily.co room tokens
│   ├── debates/complete/route.js   Debate lifecycle (start/phase/complete/forfeit)
│   ├── scoring/trigger/route.js    Manual scoring trigger (admin)
│   ├── votes/cast/route.js         Cast votes + get tallies
│   └── profile/me/route.js         User profile + stats
├── lib/
│   ├── supabase.js        Supabase client (server + browser)
│   ├── daily.js           Daily.co server-side API (rooms, tokens, recording)
│   ├── deepgram.js        Deepgram transcription + speaker labeling
│   ├── scoring.js         Anthropic AI scoring (Tier 1 + Tier 2)
│   ├── matchmaking.js     Queue management + opponent matching
│   ├── pipeline.js        Post-debate orchestrator (record > transcribe > score > notify)
│   ├── api-client.js      Client-side fetch wrappers for all API routes
│   ├── useDaily.js        React hook for Daily.co audio calls
│   └── useRealtime.js     Supabase realtime hooks (match notifs, debate state)
├── supabase/
│   └── schema.sql         Full database schema + seed data
├── .env.example           Environment variable template
└── package.json
```

## Setup (20 minutes)

### 1. Clone and install

```bash
git clone <your-repo>
cd debate-platform
npm install
```

### 2. Set up Supabase database

1. Go to your Supabase project dashboard
2. Open SQL Editor
3. Paste the entire contents of `supabase/schema.sql` and run it
4. Creates all tables, indexes, RLS policies, realtime subscriptions, and seeds the topic database

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|----------|-----------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase > Settings > API > Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase > Settings > API > anon/public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase > Settings > API > service_role key (secret) |
| DAILY_API_KEY | Daily.co > Developers > API Keys |
| NEXT_PUBLIC_DAILY_DOMAIN | Already set to verbalviol.daily.co |
| DEEPGRAM_API_KEY | Deepgram > API Keys |
| ANTHROPIC_API_KEY | Anthropic Console > API Keys |

### 4. Run locally

```bash
npm run dev
```

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Then add all env vars in Vercel dashboard: Project > Settings > Environment Variables.

Or connect your GitHub repo for auto-deploy on push.

## Data Flow

```
Quick Match click
  > POST /api/matchmaking/queue
    > enterQueue() writes to matchmaking_queue table
    > findMatch() checks for waiting opponents
    > Match found:
        > Creates debate record
        > Creates Daily.co room
        > Generates meeting tokens
        > Updates queue entries as "matched"
        > Sends in-app notification via Supabase realtime

Join debate room
  > POST /api/daily/room (get meeting token)
  > useDaily hook joins Daily.co call via WebRTC
  > Both participants hear each other
  > Phase timer runs client-side, synced via API

Debate ends
  > POST /api/debates/complete (action: "complete")
  > Pipeline kicks off async:
      1. Stop Daily.co recording
      2. Poll for download link (~2 min)
      3. Deepgram transcription with speaker diarization
      4. Map speakers to Pro/Con (first speaker = Pro)
      5. Tier 1: Claude checks for strikes (conservative)
      6. Tier 2: Claude scores argument quality (3 dimensions)
      7. Write scores to DB
      8. Update user quality_score_avg (80/20 recency weight)
      9. Notify participants
      10. Delete Daily.co room
```

## AI Scoring

### Tier 1 — Procedural Strike Detection
- Conservative, high-precision classifier
- Detects: ad hominem, slurs, aggressive profanity, non-participation
- All flags queued for admin review — no automated strikes
- Uses Claude Sonnet for speed

### Tier 2 — Qualitative Debate Scoring
- Coherence (0-100): logical structure, supported conclusions
- Engagement (0-100): addressed opponent's points directly
- Evidence (0-100): claims backed by reasoning/examples
- Overall = equal-weighted average
- Provides timestamped strengths and improvement areas

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/auth/session | POST | Create/retrieve guest session |
| /api/auth/register | POST | Register user + migrate session |
| /api/matchmaking/queue | POST | Enter matchmaking queue |
| /api/matchmaking/queue | DELETE | Leave queue |
| /api/daily/room | POST | Get Daily.co room token |
| /api/debates/complete | POST | Debate lifecycle (start/phase/complete/forfeit) |
| /api/votes/cast | POST | Cast a vote |
| /api/votes/cast | GET | Get vote tally |
| /api/profile/me | GET | Get user profile + stats |
| /api/scoring/trigger | POST | Manually re-trigger scoring pipeline |

## What's Built vs. What's Next

### Built
- Full database schema with RLS and realtime
- Session-based guest access with 5-debate gate
- User registration with session migration
- Matchmaking engine (queue, matching, side assignment)
- Daily.co integration (room creation, tokens, recording)
- Deepgram transcription with speaker diarization
- Two-tiered AI scoring (procedural + qualitative)
- Post-debate pipeline (record > transcribe > score > notify)
- Community voting (unweighted, 1 user = 1 vote)
- User profiles with rank tiers
- Supabase realtime for instant match notifications
- Client-side API layer + Daily.co React hook
- React prototype UI (separate .jsx artifact)

### Next Steps
- Wire React UI to API routes (replace mock state with real API calls)
- Connect useDaily hook to debate room component
- Prematch lobby with Supabase realtime side-swap coordination
- Admin dashboard for strike review
- Async debates (Phase 2)
- Challenge system (Phase 2)
