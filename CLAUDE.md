# Conquest — Territory Chess
## CLAUDE.md

---

## Progress

- **Plan 01 ✅** — Supabase schema (profiles, territories, challenges) + RLS + triggers, seed bot territories, auth page, world-territory static data.
- **Plan 02 ✅** — Stockfish Web Worker, ChessGame component, API routes (claim/challenge/resolve), mobile layout (dvh, slide-up drawer), TabBar, ProfileChip.
- **Plan 03 ✅** — Dynasty page, KingdomDrawer, challenge page, TerritorySheet, MapPanZoom.
- **Plan 04 ✅** — Replaced custom TopoJSON map with `react-svg-worldmap`. Created `lib/country-codes.ts` (144 ISO alpha-2 codes + NEIGHBORS adjacency graph) and `lib/game-state.ts` (geographic bot clusters, claimable/attackable status logic).
- **Plan 05 ✅** — Full functionality: auth guard re-enabled (email+password), real sign-up in onboarding (Supabase signUp + profile insert), map pan/zoom with boundary clamping, API routes (claim/challenge/resolve), Stockfish 18 lite Web Worker, game page (`/game/[id]`), challenge page, KingdomMapClient CTAs wired, dynasty page live data.

**Next:** Plan 06 — Onboarding country picker, map quality/animations, highlight claimable countries.

---

## Key codebase facts

- **Map library:** `react-svg-worldmap` (NOT hex-grid). Countries use ISO alpha-2 lowercase codes ("fr", "de").
- **Browser Supabase:** `import { createClient } from '@/lib/supabase'`
- **Server Supabase:** `import { createServerClient_ } from '@/lib/supabase-server'`
- **Service Supabase:** `import { createServiceClient } from '@/lib/supabase'`
- **Auth:** email + password (`signInWithPassword` / `signUp`). Auth guard **active** in `middleware.ts`. Public paths: `/auth`, `/onboarding`, `/api`, `/_next`.
- **Country codes:** `lib/country-codes.ts` exports `ALPHA2_TO_NAME`, `NAME_TO_ALPHA2`, `NEIGHBORS` (symmetric adjacency graph).
- **Game state:** `lib/game-state.ts` exports `buildGameState`, `buildBotOwnerMap`, `BOT_CLUSTERS`, `buildBotColorMap`.
- **Bot clusters:** CrimsonGuard=['fr','es','pt','be','nl'], AzureCrown=['ru','ua','by','pl','ro'], VerdantHold=['in','pk','bd','mm','th'], ObsidianPact=['tr','ir','iq','sa','eg']
- **Stockfish:** `public/stockfish/stockfish-18-lite-single.js` + `.wasm`. Worker: `public/stockfish-worker.js`.
- **react-chessboard v5:** uses `options={{...}}` prop bag, not flat props. `boardOrientation`, `position`, `onPieceDrop`, `squareStyles`, `darkSquareStyle`, `lightSquareStyle`, `allowDragging`.
- **Design system:** CSS vars in `app/globals.css`: `--bg:#f4f1ea`, `--bg-warm`, `--ink:#111111`, `--ink-soft`, `--line`, `--line-soft`, `--muted`, `--red:#c8311c`, `--gold:#b89758`. Fonts: `--serif` (Instrument Serif), `--sans` (Manrope), `--mono` (JetBrains Mono).

---

## Architecture

A chess platform where every game has territorial consequences. The world map IS the leaderboard.

- Players claim neutral countries by beating Stockfish (depth 10)
- Players attack enemy countries adjacent to their own by challenging the owner
- Winner of the chess game takes the territory
- Map shows all ownership in real-time via Supabase Realtime

---

## Stack

- **Database + Auth:** Supabase (email + password)
- **Chess logic:** chess.js
- **Chess UI:** react-chessboard v5
- **AI opponent:** Stockfish 18 lite in a Web Worker
- **World map:** react-svg-worldmap (SVG, ISO alpha-2 codes)
- **Real-time:** Supabase Realtime (postgres_changes on territories)
- **Styling:** CSS variables (no Tailwind)
- **Deploy:** Vercel

---

## Pages

- `/` — map page (server component: fetches territories + active challenges, renders KingdomMapClient + KingdomDrawer + TabBar)
- `/auth` — sign in (email + password) or link to /onboarding
- `/onboarding` — 6-step sign-up: Welcome → Credentials → HouseName → BannerColor → StartingRegion → Ready
- `/challenge` — list of pending/active challenges with Defend/Forfeit actions
- `/game/[id]` — chess game page (vs Stockfish or human)
- `/dynasty` — player stats, holdings, recent campaigns (all live from DB)

---

## Folder structure

```
/app
  page.tsx                       — map page (server component)
  /auth/page.tsx                 — sign-in page
  /onboarding/page.tsx           — 6-step sign-up flow
  /challenge/page.tsx            — active campaigns list
  /dynasty/page.tsx              — player stats + history
  /game/[id]/page.tsx            — chess game page
  /api/claim/route.ts            — POST: assign unclaimed territory to user
  /api/challenge/route.ts        — POST: create challenge row, return { challenge_id }
  /api/resolve/route.ts          — POST: complete challenge, transfer territory if challenger won
  /api/auth/callback/route.ts    — Supabase auth callback

/components
  /map
    KingdomMapClient.tsx         — 'use client': Realtime sub, player/bot codes, handles claim/challenge/defend CTAs
    ConquestMap.tsx              — 'use client': react-svg-worldmap wrapper, styleFunction, click handler
    MapPanZoom.tsx               — 'use client': CSS-transform pan/zoom, imperative wheel/touch listeners
    KingdomDrawer.tsx            — bottom drawer: house name, stats, holdings list
    TerritorySheet.tsx           — slide-up sheet on country click: Claim/Attack/Defend CTAs
  /chess
    ChessGame.tsx                — 'use client': react-chessboard + chess.js + Stockfish worker
  /ui
    TabBar.tsx                   — bottom nav: Map / Challenge / Dynasty
    ProfileChip.tsx              — top-left user avatar chip
    ForfeitButton.tsx            — 'use client': calls /api/resolve with winner='challenger'
    ProModal.tsx                 — upgrade prompt modal (non-functional, for judges)
    BottomDrawer.tsx             — generic bottom drawer shell

/lib
  country-codes.ts               — ALPHA2_TO_NAME (144 codes), NAME_TO_ALPHA2, NEIGHBORS adjacency graph
  game-state.ts                  — BOT_CLUSTERS, buildGameState, buildBotOwnerMap, buildMapData, buildBotColorMap
  types.ts                       — Profile, Territory, CountryFeature, Challenge interfaces
  supabase.ts                    — createClient (browser) + createServiceClient (service role)
  supabase-server.ts             — createServerClient_ (server components/routes)
  world-territories.ts           — DEFAULT_COUNTRY_STATUS (static mock, kept for guest fallback)
  hex-utils.ts                   — legacy, unused
  seed.ts                        — legacy, unused

/public
  stockfish-worker.js            — Web Worker: importScripts stockfish-18-lite-single.js
  /stockfish
    stockfish-18-lite-single.js  — Stockfish 18 WASM-backed engine
    stockfish-18-lite-single.wasm
```

---

## Database tables

- **profiles** — `id` (uuid → auth.users), `username`, `display_color`, `territory_count`, `created_at`
- **territories** — `id`, `name` (country name e.g. "France"), `hex_q`, `hex_r` (legacy), `region_code`, `owner_id` (null = unclaimed), `created_at`
- **challenges** — `id`, `territory_id`, `challenger_id`, `defender_id`, `current_fen`, `pgn`, `status` ('pending'|'active'|'completed'|'forfeited'), `winner_id`, `ai_analysis`, `created_at`

Trigger: `sync_territory_counts` — fires on territory `owner_id` change, updates `profiles.territory_count`.

RLS: `territories` and `challenges` readable by all authenticated users. Mutations go through service client in API routes to bypass RLS.

---

## Bot seed (supabase/seed.sql)

4 bots, 5 territories each (20 rows total):
- **CrimsonGuard** — France, Spain, Portugal, Belgium, Netherlands
- **AzureCrown** — Russia, Ukraine, Belarus, Poland, Romania
- **VerdantHold** — India, Pakistan, Bangladesh, Myanmar, Thailand
- **ObsidianPact** — Turkey, Iran, Iraq, Saudi Arabia, Egypt

Territory `name` values must exactly match `NAME_TO_ALPHA2` keys.

---

## Game logic

### Status computation (`lib/game-state.ts`)
`buildGameState(playerCodes, botOwnerMap, isNewUser)` returns `GameCountryState[]`:
- `player` — owned by current user
- `bot` — owned by a bot
- `claimable` — neutral AND (adjacent to player OR isNewUser)
- `attackable` — bot-owned AND adjacent to player territory
- `neutral` — everything else

### Map colors (`components/map/ConquestMap.tsx`)
`styleFunction` maps status → fill/stroke/cursor:
- `player` → `#111111`
- `bot` → per-cluster color from `buildBotColorMap()`
- `claimable` → `#f4f0e6` with gold stroke, pointer cursor
- `attackable` → `#3a1a1a` with red stroke, pointer cursor
- `neutral` → `#ece8df`

### Challenge flow
1. User clicks claimable/attackable country → `TerritorySheet` opens
2. CTA pressed → `KingdomMapClient` POSTs to `/api/challenge`
3. Server creates challenge row (`defender_id = user.id` for self/Stockfish, else territory owner)
4. Client navigates to `/game/[id]`
5. `ChessGame` plays vs Stockfish (worker) or human (Realtime TBD)
6. On game over → `resolveChallenge` POSTs to `/api/resolve`
7. If challenger won → territory transferred, Realtime fires → map updates

---

## Design system

CSS vars (defined in `app/globals.css`):
```
--bg: #f4f1ea         (warm parchment)
--bg-warm: #ede9e0
--ink: #111111
--ink-soft: #333
--line: #d8d4cc
--line-soft: #ece8df
--muted: #8a8070
--red: #c8311c
--gold: #b89758
--serif: 'Instrument Serif', serif
--sans: 'Manrope', sans-serif
--mono: 'JetBrains Mono', monospace
```

---

## DO NOT build

- Alliance / betrayal system
- Seasonal resets
- Native push notifications
- Auto-forfeit cron job (use manual Forfeit button)
- ELO rating system
- Chat
- Spectator mode
- Tournament brackets
- AI Coach panel (post-game Claude analysis) — not yet implemented
