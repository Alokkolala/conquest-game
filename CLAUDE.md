# Conquest — Territory Chess
## CLAUDE.md

---

## What we're building

A chess platform where every game has territorial consequences. The world is a hex grid map. You own hexes. Claim unclaimed territory by beating Stockfish. Steal enemy territory by beating the owner in chess. Win → expand. Lose → shrink. The map IS the leaderboard.

Hackathon submission for nFactorial. Deadline: May 20. Ship fast, ship clean.

---

## Stack (decided — do not propose alternatives)


- **Database + Auth:** Supabase (Google OAuth or magic link)
- **Chess logic:** chess.js
- **Chess UI:** react-chessboard
- **AI opponent:** stockfish.js in a Web Worker (runs in browser)
- **Hex grid:** react-hex-grid
- **Real-time:** Supabase Realtime (live map + move sync)
- **AI Coach:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Styling:** Tailwind CSS
- **Deploy:** Vercel

---

## Core features

### Two chess modes
- **vs Stockfish** — click any unclaimed (gray) hex → play Stockfish at depth 10 → win = you own it
- **vs Human** — click an enemy hex bordering your territory → challenge the owner → winner takes the hex

### The map
- Full-screen hex grid (37 hexes, 3-ring pattern)
- Hexes colored by owner, gray if unclaimed
- Owner username displayed on hex
- ⚔️ icon on hexes with an active challenge
- Live updates via Supabase Realtime when territory transfers

### Sidebar (280px, fixed right)
- Your player card: username, color, territory count, rank
- Pending challenges against you (Accept / Forfeit buttons)
- Global leaderboard — top 10 by territory count

### Notifications
- Bell icon in nav with unread count
- On login: show "X of your territories are under attack"
- Poll every 60 seconds for new challenges (no push notifications)

### AI Coach
- After every game ends, Claude API analyzes the PGN
- Returns 3 bullets: turning point, best missed move, key lesson
- Shown in a panel on the game-over screen

### Monetization signal (for judges)
- "Upgrade to Pro" button in the nav
- Opens a modal: "Custom territory themes, piece skins, and priority matchmaking coming soon"
- Nothing functional — signals business thinking to judges

---

## Pages

- `/` — the map (main product, full screen)
- `/game/[id]` — chess game for human vs human challenges
- `/auth` — sign in page

---

## Folder structure

```
/app
  page.tsx
  /game/[id]/page.tsx
  /auth/page.tsx
  /api/claim/route.ts        — user beat Stockfish, transfer territory
  /api/challenge/route.ts    — create a challenge row
  /api/resolve/route.ts      — game ended, transfer territory, trigger AI analysis
  /api/analyze/route.ts      — Claude API call for post-game coach

/components
  /map
    HexMap.tsx               — react-hex-grid wrapper, all territory state
    TerritoryHex.tsx         — single hex, color, name, icons
    MapSidebar.tsx           — leaderboard + challenges
  /chess
    ChessGame.tsx            — unified component, handles both modes
    StockfishWorker.ts       — Web Worker file
    AICoachPanel.tsx         — post-game analysis display
  /ui
    ClaimModal.tsx           — confirm Stockfish game for unclaimed hex
    ChallengeModal.tsx       — confirm challenge for enemy hex
    NotificationBell.tsx     — pending challenge count + dropdown

/lib
  supabase.ts                — Supabase client (browser + server)
  hex-utils.ts               — axial coordinate math, adjacency check
  seed.ts                    — seed 37 territories on first run
```

---

## Database tables

- **profiles** — id, username, display_color, territory_count
- **territories** — id, name, hex_q, hex_r, owner_id (null = unclaimed)
- **challenges** — id, territory_id, challenger_id, defender_id, current_fen, pgn, status, winner_id, ai_analysis

---

## Design

Dark war aesthetic. Not chess.com blue. Not generic.

- Background: near-black `#0a0a0a`
- Accent: antique gold `#c8a96e`
- Danger / contested: deep red `#8b2020`
- Unclaimed hexes: dark gray
- Owned hexes: owner's display_color
- Contested hexes: pulsing red border
- **Display font:** Cinzel (Google Fonts) — used for hex names and headings
- **Body font:** Inter or system

---

## Hex grid seed

37 hexes, 3-ring axial pattern. Names are hardcoded — do not generate procedurally:

"The Iron Pass", "Coastal Flats", "Northern Ridge", "Saltmere", "The Amber Vale", "Crow's Reach", "Dusthaven", "The Black Ford", "Stonegate", "Windfell", "The Pale Marsh", "Ashridge", "Goldenport", "The Ember Shelf", "Thornwall", "Coldwater Bay", "The Rust Hills", "Mistveil", "The Long Shore", "Greyspire", "The Deep Hollow", "Ironhold", "Sunken Gate", "The Sable Moor", "Driftmark", "The High Seat", "Emberglass", "Copperfield", "The Still Water", "Frostmere", "The Raven's Keep", "Sandwatch", "The Pale Crown", "Cinderfen", "Wavecrest", "The Dark Helm", "Redmount"

---

## Demo seed accounts

Create 4 bot profiles before demo so the map looks alive from second one. Each owns 3 hexes placed around the center. Player account starts with 2 hexes adjacent to at least one enemy.

---

## Adjacency rule

A user can only challenge an enemy hex that borders at least one hex they already own. Enforce this check before showing the challenge modal. Logic lives in `lib/hex-utils.ts`.

---

## DO NOT build

- Alliance / betrayal system
- Seasonal resets
- Native push notifications
- Shareable kingdom card / OG image
- Auto-forfeit cron job — use a manual Forfeit button instead
- ELO rating system
- Chat
- Spectator mode
- Tournament brackets
- Game history page (show last 5 in sidebar only)

---

## Build order

1. Supabase schema + seed script
2. Auth (sign in, profile creation)
3. Hex map rendering with ownership colors
4. Claim flow (unclaimed hex → Stockfish game → territory transfer)
5. Challenge flow (enemy hex → human game → territory transfer)
6. Live map updates via Realtime
7. Sidebar (leaderboard + notifications)
8. AI Coach (post-game panel)
9. Demo seed accounts + polish
10. Vercel deploy
