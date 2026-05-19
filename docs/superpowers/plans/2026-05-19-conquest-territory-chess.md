# Conquest — Territory Chess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack territorial chess web app where winning chess matches claims/steals hexes on a shared world map — hackathon submission for nFactorial, deadline May 20.

**Architecture:** Next.js 14 App Router. Supabase handles auth (Google OAuth), Postgres DB, and realtime subscriptions. Chess runs client-side via chess.js + react-chessboard. Stockfish runs in a browser Web Worker (stockfish npm → `public/stockfish.js`). Hex grid rendered with react-hex-grid. Claude API drives post-game analysis.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase JS v2 (`@supabase/ssr`), chess.js, react-chessboard, stockfish (npm), react-hex-grid, Anthropic SDK, Vitest, Google Fonts (Cinzel + Inter)

---

## File Map

```
/app
  layout.tsx                     — root layout, fonts, dark bg
  page.tsx                       — main map page, server component (fetches territories)
  /auth/page.tsx                 — sign-in page (Google OAuth + magic link)
  /game/[id]/page.tsx            — human vs human game page
  /api/claim/route.ts            — POST: user beat Stockfish → transfer unclaimed hex
  /api/challenge/route.ts        — POST: create a challenge row for an enemy hex
  /api/resolve/route.ts          — POST: game ended → transfer hex → trigger AI analysis
  /api/analyze/route.ts          — POST: Claude API call → return 3-bullet analysis

/components
  /map
    HexMap.tsx                   — client component, react-hex-grid wrapper, realtime subscriptions
    TerritoryHex.tsx             — single hex: color, name, icons, click handler
    MapSidebar.tsx               — leaderboard + pending challenges + accept/forfeit
  /chess
    ChessGame.tsx                — unified chess component (vs Stockfish OR vs Human)
    AICoachPanel.tsx             — post-game 3-bullet analysis display
  /ui
    ClaimModal.tsx               — confirm Stockfish game for unclaimed hex
    ChallengeModal.tsx           — confirm challenge for enemy hex (adjacency already checked)
    NotificationBell.tsx         — bell icon + unread badge + dropdown
    ProModal.tsx                 — "Upgrade to Pro" marketing modal

/lib
  types.ts                       — shared TypeScript interfaces (Profile, Territory, Challenge)
  supabase.ts                    — browser + server Supabase client factories
  hex-utils.ts                   — axial math: distance, adjacency, ring generation, territory coords
  seed.ts                        — runnable Node script: inserts 37 territories + 4 bot profiles

/supabase
  schema.sql                     — CREATE TABLE, RLS policies, triggers
  seed.sql                       — INSERT for 37 territories + 4 bot profiles + their hexes

/__tests__
  hex-utils.test.ts              — unit tests for pure hex math functions

/public
  stockfish.js                   — copied from node_modules/stockfish/src/stockfish-nnue-16-single.js

middleware.ts                    — protect all routes except /auth
tailwind.config.ts
next.config.ts
vitest.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.local` (template)
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd C:/projects/conquest
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

When prompted: answer Yes to all defaults.

- [ ] **Step 2: Install all dependencies**

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  chess.js \
  react-chessboard \
  react-hex-grid \
  stockfish \
  @anthropic-ai/sdk

npm install -D \
  vitest \
  @vitejs/plugin-react \
  jsdom \
  @testing-library/react \
  @testing-library/jest-dom
```

- [ ] **Step 3: Copy Stockfish to public/**

```bash
cp node_modules/stockfish/src/stockfish-nnue-16-single.js public/stockfish.js
```

- [ ] **Step 4: Write `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    return config
  },
}

export default nextConfig
```

- [ ] **Step 5: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
```

- [ ] **Step 6: Write `.env.local` template**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
EOF
```

Fill in real values from your Supabase project dashboard and Anthropic console.

- [ ] **Step 7: Add test script to `package.json`**

Open `package.json` and add to the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Verify Next.js starts**

```bash
npm run dev
```

Expected: `✓ Ready in Xms` on http://localhost:3000. Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 14 project with all dependencies"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write schema SQL**

Create `supabase/schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────
-- Profiles
-- ───────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_color text not null default '#4a90d9',
  territory_count int not null default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- ───────────────────────────────────────────
-- Territories
-- ───────────────────────────────────────────
create table if not exists territories (
  id serial primary key,
  name text not null,
  hex_q int not null,
  hex_r int not null,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(hex_q, hex_r)
);

alter table territories enable row level security;

create policy "territories_select_all" on territories
  for select using (true);

create policy "territories_update_service" on territories
  for update using (true);   -- service role only in practice

-- ───────────────────────────────────────────
-- Challenges
-- ───────────────────────────────────────────
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  territory_id int references territories(id),
  challenger_id uuid references profiles(id),
  defender_id uuid references profiles(id),
  current_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'forfeited')),
  winner_id uuid references profiles(id),
  ai_analysis text,
  created_at timestamptz default now()
);

alter table challenges enable row level security;

create policy "challenges_select_all" on challenges
  for select using (true);

create policy "challenges_insert_challenger" on challenges
  for insert with check (auth.uid() = challenger_id);

create policy "challenges_update_participants" on challenges
  for update using (
    auth.uid() = challenger_id or auth.uid() = defender_id
  );

-- ───────────────────────────────────────────
-- Auto-update territory_count on ownership change
-- ───────────────────────────────────────────
create or replace function update_territory_counts()
returns trigger language plpgsql security definer as $$
begin
  -- Decrement old owner
  if OLD.owner_id is not null then
    update profiles
    set territory_count = territory_count - 1
    where id = OLD.owner_id;
  end if;
  -- Increment new owner
  if NEW.owner_id is not null then
    update profiles
    set territory_count = territory_count + 1
    where id = NEW.owner_id;
  end if;
  return NEW;
end;
$$;

create trigger on_territory_owner_change
  after update of owner_id on territories
  for each row
  when (OLD.owner_id is distinct from NEW.owner_id)
  execute function update_territory_counts();
```

- [ ] **Step 2: Run schema in Supabase**

In Supabase dashboard → SQL Editor → paste the contents of `supabase/schema.sql` → Run.

Expected: No errors. Tables `profiles`, `territories`, `challenges` appear in Table Editor.

- [ ] **Step 3: Enable Realtime on territories and challenges**

In Supabase dashboard → Database → Replication → enable realtime for `territories` and `challenges` tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema with profiles, territories, challenges tables"
```

---

## Task 3: Types + Supabase Client + Middleware

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write `lib/types.ts`**

```typescript
export interface Profile {
  id: string
  username: string
  display_color: string
  territory_count: number
  created_at: string
}

export interface Territory {
  id: number
  name: string
  hex_q: number
  hex_r: number
  owner_id: string | null
  owner?: Profile | null
  created_at: string
}

export interface Challenge {
  id: string
  territory_id: number
  challenger_id: string
  defender_id: string
  current_fen: string
  pgn: string
  status: 'pending' | 'active' | 'completed' | 'forfeited'
  winner_id: string | null
  ai_analysis: string | null
  created_at: string
  territory?: Territory
  challenger?: Profile
  defender?: Profile
}
```

- [ ] **Step 2: Write `lib/supabase.ts`**

```typescript
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

// Browser client — use in Client Components
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server client — use in Server Components and API routes
export async function createServerClient_() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    }
  )
}

// Service role client — use only in API routes for privileged writes
export function createServiceClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 3: Write `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|stockfish.js).*)'],
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/supabase.ts middleware.ts
git commit -m "feat: add shared types, Supabase client factories, and auth middleware"
```

---

## Task 4: Hex Utilities (TDD)

**Files:**
- Create: `lib/hex-utils.ts`
- Create: `__tests__/hex-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/hex-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  hexDistance,
  isAdjacent,
  getPlayerHexes,
  canChallenge,
  TERRITORIES,
} from '../lib/hex-utils'

describe('hexDistance', () => {
  it('returns 0 for same hex', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0)
  })

  it('returns 1 for adjacent hexes', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1)
  })

  it('returns 2 for two steps away', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2)
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2)
  })

  it('returns 3 for ring-3 hexes from center', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3)
    expect(hexDistance({ q: 0, r: 0 }, { q: -3, r: 3 })).toBe(3)
  })
})

describe('isAdjacent', () => {
  it('returns true for distance-1 hexes', () => {
    expect(isAdjacent({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(true)
    expect(isAdjacent({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(true)
  })

  it('returns false for same hex', () => {
    expect(isAdjacent({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(false)
  })

  it('returns false for distance-2 hexes', () => {
    expect(isAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false)
  })
})

describe('canChallenge', () => {
  it('allows challenging an adjacent enemy hex', () => {
    const myHexes = [{ q: 0, r: 0 }]
    const targetHex = { q: 1, r: 0 }
    expect(canChallenge(myHexes, targetHex)).toBe(true)
  })

  it('disallows challenging a non-adjacent enemy hex', () => {
    const myHexes = [{ q: 0, r: 0 }]
    const targetHex = { q: 2, r: 0 }
    expect(canChallenge(myHexes, targetHex)).toBe(false)
  })

  it('allows if any of my hexes is adjacent', () => {
    const myHexes = [{ q: 0, r: 0 }, { q: 3, r: 0 }]
    const targetHex = { q: 2, r: 0 }
    expect(canChallenge(myHexes, targetHex)).toBe(true)
  })
})

describe('TERRITORIES', () => {
  it('has exactly 37 hexes', () => {
    expect(TERRITORIES).toHaveLength(37)
  })

  it('has unique coordinates', () => {
    const keys = TERRITORIES.map(t => `${t.q},${t.r}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(37)
  })

  it('all hexes are within 3 rings of center', () => {
    for (const t of TERRITORIES) {
      const s = -t.q - t.r
      const dist = Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(s))
      expect(dist).toBeLessThanOrEqual(3)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../lib/hex-utils'`

- [ ] **Step 3: Write `lib/hex-utils.ts`**

```typescript
export interface HexCoord {
  q: number
  r: number
}

/**
 * Axial distance between two hexes (cube coordinate formula).
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  const ds = -dq - dr
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
}

/**
 * True if the two hexes are exactly 1 step apart.
 */
export function isAdjacent(a: HexCoord, b: HexCoord): boolean {
  return hexDistance(a, b) === 1
}

/**
 * Returns the player's hexes from the territory list.
 */
export function getPlayerHexes(
  territories: Array<HexCoord & { owner_id: string | null }>,
  playerId: string
): HexCoord[] {
  return territories
    .filter(t => t.owner_id === playerId)
    .map(t => ({ q: t.q, r: t.r }))
}

/**
 * Returns true if the player can challenge the target hex —
 * i.e., at least one of the player's hexes is adjacent to target.
 */
export function canChallenge(
  myHexes: HexCoord[],
  target: HexCoord
): boolean {
  return myHexes.some(mine => isAdjacent(mine, target))
}

/**
 * All 37 territory definitions (hardcoded, 3-ring axial pattern).
 * s = -q - r (not stored — derived on demand).
 */
export const TERRITORIES: Array<HexCoord & { name: string }> = [
  // Ring 0
  { q: 0,  r: 0,  name: 'The High Seat' },
  // Ring 1
  { q: 1,  r: 0,  name: 'Ironhold' },
  { q: 0,  r: 1,  name: 'Goldenport' },
  { q: -1, r: 1,  name: 'Ashridge' },
  { q: -1, r: 0,  name: 'Mistveil' },
  { q: 0,  r: -1, name: 'Greyspire' },
  { q: 1,  r: -1, name: 'Emberglass' },
  // Ring 2
  { q: 2,  r: 0,  name: 'The Deep Hollow' },
  { q: 2,  r: -1, name: 'Stonegate' },
  { q: 2,  r: -2, name: 'The Ember Shelf' },
  { q: 1,  r: -2, name: 'The Iron Pass' },
  { q: 0,  r: -2, name: 'The Amber Vale' },
  { q: -1, r: -1, name: 'Windfell' },
  { q: -2, r: 0,  name: 'The Pale Marsh' },
  { q: -2, r: 1,  name: 'The Rust Hills' },
  { q: -2, r: 2,  name: 'Copperfield' },
  { q: -1, r: 2,  name: 'The Still Water' },
  { q: 0,  r: 2,  name: 'Sunken Gate' },
  { q: 1,  r: 1,  name: 'Driftmark' },
  // Ring 3
  { q: 3,  r: 0,  name: 'Redmount' },
  { q: 3,  r: -1, name: 'The Dark Helm' },
  { q: 3,  r: -2, name: 'Wavecrest' },
  { q: 3,  r: -3, name: 'Cinderfen' },
  { q: 2,  r: -3, name: 'The Pale Crown' },
  { q: 1,  r: -3, name: 'Sandwatch' },
  { q: 0,  r: -3, name: "The Raven's Keep" },
  { q: -1, r: -2, name: 'Frostmere' },
  { q: -2, r: -1, name: 'Dusthaven' },
  { q: -3, r: 0,  name: 'The Black Ford' },
  { q: -3, r: 1,  name: 'Thornwall' },
  { q: -3, r: 2,  name: 'Coldwater Bay' },
  { q: -3, r: 3,  name: 'The Long Shore' },
  { q: -2, r: 3,  name: 'The Sable Moor' },
  { q: -1, r: 3,  name: "Crow's Reach" },
  { q: 0,  r: 3,  name: 'Northern Ridge' },
  { q: 1,  r: 2,  name: 'Coastal Flats' },
  { q: 2,  r: 1,  name: 'Saltmere' },
]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hex-utils.ts __tests__/hex-utils.test.ts
git commit -m "feat: add hex coordinate utilities with full test coverage"
```

---

## Task 5: Seed Script + Demo Data

**Files:**
- Create: `supabase/seed.sql`
- Create: `lib/seed.ts`

- [ ] **Step 1: Write `supabase/seed.sql`**

```sql
-- ────────────────────────────────────────────────────────────
-- Insert all 37 territories (owner_id NULL = unclaimed)
-- ────────────────────────────────────────────────────────────
insert into territories (name, hex_q, hex_r) values
  ('The High Seat',   0,  0),
  ('Ironhold',        1,  0),
  ('Goldenport',      0,  1),
  ('Ashridge',       -1,  1),
  ('Mistveil',       -1,  0),
  ('Greyspire',       0, -1),
  ('Emberglass',      1, -1),
  ('The Deep Hollow', 2,  0),
  ('Stonegate',       2, -1),
  ('The Ember Shelf', 2, -2),
  ('The Iron Pass',   1, -2),
  ('The Amber Vale',  0, -2),
  ('Windfell',       -1, -1),
  ('The Pale Marsh', -2,  0),
  ('The Rust Hills', -2,  1),
  ('Copperfield',    -2,  2),
  ('The Still Water',-1,  2),
  ('Sunken Gate',     0,  2),
  ('Driftmark',       1,  1),
  ('Redmount',        3,  0),
  ('The Dark Helm',   3, -1),
  ('Wavecrest',       3, -2),
  ('Cinderfen',       3, -3),
  ('The Pale Crown',  2, -3),
  ('Sandwatch',       1, -3),
  ('The Raven''s Keep',0,-3),
  ('Frostmere',      -1, -2),
  ('Dusthaven',      -2, -1),
  ('The Black Ford', -3,  0),
  ('Thornwall',      -3,  1),
  ('Coldwater Bay',  -3,  2),
  ('The Long Shore', -3,  3),
  ('The Sable Moor', -2,  3),
  ('Crow''s Reach',  -1,  3),
  ('Northern Ridge',  0,  3),
  ('Coastal Flats',   1,  2),
  ('Saltmere',        2,  1)
on conflict (hex_q, hex_r) do nothing;

-- ────────────────────────────────────────────────────────────
-- Bot profiles (use Supabase Auth → create these users first
-- via dashboard, then paste their UUIDs below)
-- ────────────────────────────────────────────────────────────
-- REPLACE these UUIDs with real ones after creating bot users
-- in Supabase Auth (email: bot1@conquest.local, no confirmation needed)
-- ────────────────────────────────────────────────────────────

-- After inserting profiles, assign bot hexes:
-- Bot 1 (Crimson Guard) → Ironhold, Stonegate, Driftmark
-- Bot 2 (Azure Crown)   → Ashridge, The Rust Hills, Copperfield
-- Bot 3 (Verdant Hold)  → Mistveil, The Pale Marsh, Windfell
-- Bot 4 (Obsidian Pact) → Greyspire, The Amber Vale, The Iron Pass

-- Run lib/seed.ts via `npx tsx lib/seed.ts` after filling .env.local
```

- [ ] **Step 2: Write `lib/seed.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOTS = [
  { username: 'CrimsonGuard', display_color: '#8b2020', email: 'bot1@conquest.local' },
  { username: 'AzureCrown',   display_color: '#1a4a8b', email: 'bot2@conquest.local' },
  { username: 'VerdantHold',  display_color: '#1a6b2a', email: 'bot3@conquest.local' },
  { username: 'ObsidianPact', display_color: '#4a1a6b', email: 'bot4@conquest.local' },
]

// hex_q, hex_r for each bot's 3 territories
const BOT_TERRITORIES: Record<string, Array<[number, number]>> = {
  CrimsonGuard: [[1, 0], [2, -1], [1, 1]],   // Ironhold, Stonegate, Driftmark
  AzureCrown:   [[-1, 1], [-2, 1], [-2, 2]],  // Ashridge, Rust Hills, Copperfield
  VerdantHold:  [[-1, 0], [-2, 0], [-1, -1]], // Mistveil, Pale Marsh, Windfell
  ObsidianPact: [[0, -1], [0, -2], [1, -2]],  // Greyspire, Amber Vale, Iron Pass
}

async function seed() {
  console.log('Seeding bot profiles...')

  for (const bot of BOTS) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: bot.email,
      password: 'conquest-bot-2026',
      email_confirm: true,
    })
    if (authError) {
      console.error(`Auth error for ${bot.username}:`, authError.message)
      continue
    }

    const userId = authData.user.id

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, username: bot.username, display_color: bot.display_color })
    if (profileError) {
      console.error(`Profile error for ${bot.username}:`, profileError.message)
      continue
    }

    // Assign territories
    for (const [q, r] of BOT_TERRITORIES[bot.username]) {
      const { error } = await supabase
        .from('territories')
        .update({ owner_id: userId })
        .eq('hex_q', q)
        .eq('hex_r', r)
      if (error) console.error(`Territory error (${q},${r}):`, error.message)
    }

    console.log(`✓ Seeded ${bot.username}`)
  }

  console.log('Seed complete.')
}

seed().catch(console.error)
```

- [ ] **Step 3: Run the seed**

```bash
npx tsx lib/seed.ts
```

Expected output:
```
Seeding bot profiles...
✓ Seeded CrimsonGuard
✓ Seeded AzureCrown
✓ Seeded VerdantHold
✓ Seeded ObsidianPact
Seed complete.
```

Verify in Supabase Table Editor: 37 territories, 4 profiles, 12 territories with owner_id filled.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql lib/seed.ts
git commit -m "feat: add territory seed SQL and bot profile seed script"
```

---

## Task 6: Root Layout + Auth Page

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/auth/page.tsx`

- [ ] **Step 1: Write `app/globals.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0a0a0a;
  --accent: #c8a96e;
  --danger: #8b2020;
}

body {
  background: var(--bg);
  color: #e5e5e5;
  font-family: 'Inter', system-ui, sans-serif;
}

.font-cinzel {
  font-family: 'Cinzel', serif;
}
```

- [ ] **Step 2: Write `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Conquest — Territory Chess',
  description: 'Win chess. Claim territory. Rule the map.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-200 antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Write `app/auth/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm space-y-8 p-8 border border-neutral-800 rounded-lg">
        <div className="text-center">
          <h1 className="font-cinzel text-3xl font-bold text-[#c8a96e]">CONQUEST</h1>
          <p className="mt-2 text-sm text-neutral-400">Territory Chess</p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-neutral-300">
            Check your email for the magic link.
          </p>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleGoogle}
              className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-sm font-medium transition-colors"
            >
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-xs text-neutral-500">
                <span className="bg-[#0a0a0a] px-2">or</span>
              </div>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded text-sm focus:outline-none focus:border-[#c8a96e] placeholder-neutral-600"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#c8a96e] hover:bg-[#b8995e] text-black font-semibold rounded text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `tailwind.config.ts` to add Cinzel**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
      },
      colors: {
        accent: '#c8a96e',
        danger: '#8b2020',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 5: Enable Google OAuth in Supabase**

In Supabase dashboard → Authentication → Providers → Google → enable it and paste your Google OAuth client ID and secret. Set redirect URL to `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.

- [ ] **Step 6: Test auth flow**

```bash
npm run dev
```

Navigate to http://localhost:3000/auth. Enter your email. Verify magic link email arrives and clicking it redirects to `/`.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx app/globals.css app/auth/page.tsx tailwind.config.ts
git commit -m "feat: add root layout with Cinzel font and auth page (magic link + Google)"
```

---

## Task 7: Hex Map Components

**Files:**
- Create: `components/map/TerritoryHex.tsx`
- Create: `components/map/HexMap.tsx`

- [ ] **Step 1: Write `components/map/TerritoryHex.tsx`**

```typescript
'use client'

import { Hexagon, Text } from 'react-hex-grid'
import type { Territory } from '@/lib/types'

interface Props {
  territory: Territory
  isContested: boolean
  currentUserId: string | null
  onClick: (territory: Territory) => void
}

function hexFill(territory: Territory, currentUserId: string | null): string {
  if (!territory.owner_id) return '#2a2a2a'        // unclaimed
  if (territory.owner_id === currentUserId) return '#1a3a1a'  // mine
  return territory.owner?.display_color ?? '#444'  // enemy
}

function hexStroke(territory: Territory, isContested: boolean, currentUserId: string | null): string {
  if (isContested) return '#8b2020'
  if (territory.owner_id === currentUserId) return '#c8a96e'
  return '#555'
}

export default function TerritoryHex({ territory, isContested, currentUserId, onClick }: Props) {
  const fill = hexFill(territory, currentUserId)
  const stroke = hexStroke(territory, isContested, currentUserId)
  const s = -territory.hex_q - territory.hex_r

  // Shorten long names for hex display
  const displayName = territory.name.replace(/^The /, '').slice(0, 12)

  return (
    <Hexagon
      q={territory.hex_q}
      r={territory.hex_r}
      s={s}
      onClick={() => onClick(territory)}
      style={{
        fill,
        stroke,
        strokeWidth: isContested ? 3 : 1.5,
        cursor: 'pointer',
        animation: isContested ? 'pulse-red 1.5s infinite' : undefined,
      }}
    >
      <Text
        style={{
          fontSize: '0.22rem',
          fill: territory.owner_id === currentUserId ? '#c8a96e' : '#ccc',
          fontFamily: 'Cinzel, serif',
          pointerEvents: 'none',
        }}
      >
        {displayName}
      </Text>
      {territory.owner && (
        <Text
          y={0.4}
          style={{
            fontSize: '0.18rem',
            fill: '#aaa',
            pointerEvents: 'none',
          }}
        >
          {territory.owner.username.slice(0, 10)}
        </Text>
      )}
      {isContested && (
        <Text
          y={-0.4}
          style={{ fontSize: '0.3rem', pointerEvents: 'none' }}
        >
          ⚔️
        </Text>
      )}
    </Hexagon>
  )
}
```

- [ ] **Step 2: Write `components/map/HexMap.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { HexGrid, Layout } from 'react-hex-grid'
import { createClient } from '@/lib/supabase'
import { canChallenge, getPlayerHexes } from '@/lib/hex-utils'
import type { Territory, Challenge, Profile } from '@/lib/types'
import TerritoryHex from './TerritoryHex'
import ClaimModal from '@/components/ui/ClaimModal'
import ChallengeModal from '@/components/ui/ChallengeModal'

interface Props {
  initialTerritories: Territory[]
  currentUser: Profile | null
}

export default function HexMap({ initialTerritories, currentUser }: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([])
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [modalType, setModalType] = useState<'claim' | 'challenge' | null>(null)
  const supabase = createClient()

  // Subscribe to territory and challenge changes
  useEffect(() => {
    const channel = supabase
      .channel('map-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'territories' },
        async (payload) => {
          // Refetch the updated territory with owner profile
          const { data } = await supabase
            .from('territories')
            .select('*, owner:profiles(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setTerritories(prev =>
              prev.map(t => (t.id === data.id ? data : t))
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenges' },
        async () => {
          // Refetch active challenges
          const { data } = await supabase
            .from('challenges')
            .select('*')
            .in('status', ['pending', 'active'])
          if (data) setActiveChallenges(data)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Initial fetch of active challenges
  useEffect(() => {
    supabase
      .from('challenges')
      .select('*')
      .in('status', ['pending', 'active'])
      .then(({ data }) => { if (data) setActiveChallenges(data) })
  }, [supabase])

  const handleHexClick = useCallback((territory: Territory) => {
    if (!currentUser) return

    if (!territory.owner_id) {
      // Unclaimed — offer Stockfish game
      setSelectedTerritory(territory)
      setModalType('claim')
      return
    }

    if (territory.owner_id === currentUser.id) return // own hex, no action

    // Enemy hex — check adjacency
    const myHexes = getPlayerHexes(
      territories.map(t => ({ q: t.hex_q, r: t.hex_r, owner_id: t.owner_id })),
      currentUser.id
    )
    if (!canChallenge(myHexes, { q: territory.hex_q, r: territory.hex_r })) {
      alert('You must own an adjacent hex to challenge this territory.')
      return
    }

    setSelectedTerritory(territory)
    setModalType('challenge')
  }, [territories, currentUser])

  const contestedTerritoryIds = new Set(
    activeChallenges.map(c => c.territory_id)
  )

  return (
    <div className="flex-1 flex items-center justify-center overflow-hidden">
      <style>{`
        @keyframes pulse-red {
          0%, 100% { stroke-opacity: 1; }
          50% { stroke-opacity: 0.4; }
        }
      `}</style>

      <HexGrid width={720} height={640} viewBox="-50 -45 100 90">
        <Layout
          size={{ x: 8, y: 8 }}
          flat={false}
          spacing={1.08}
          origin={{ x: 0, y: 0 }}
        >
          {territories.map(t => (
            <TerritoryHex
              key={t.id}
              territory={t}
              isContested={contestedTerritoryIds.has(t.id)}
              currentUserId={currentUser?.id ?? null}
              onClick={handleHexClick}
            />
          ))}
        </Layout>
      </HexGrid>

      {modalType === 'claim' && selectedTerritory && currentUser && (
        <ClaimModal
          territory={selectedTerritory}
          currentUser={currentUser}
          onClose={() => { setSelectedTerritory(null); setModalType(null) }}
        />
      )}

      {modalType === 'challenge' && selectedTerritory && currentUser && (
        <ChallengeModal
          territory={selectedTerritory}
          currentUser={currentUser}
          onClose={() => { setSelectedTerritory(null); setModalType(null) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/map/TerritoryHex.tsx components/map/HexMap.tsx
git commit -m "feat: add TerritoryHex and HexMap components with realtime subscriptions"
```

---

## Task 8: Main Page + Sidebar Shell

**Files:**
- Modify: `app/page.tsx`
- Create: `components/map/MapSidebar.tsx`
- Create: `components/ui/NotificationBell.tsx`
- Create: `components/ui/ProModal.tsx`

- [ ] **Step 1: Write `app/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerClient_ } from '@/lib/supabase'
import HexMap from '@/components/map/HexMap'
import MapSidebar from '@/components/map/MapSidebar'
import NotificationBell from '@/components/ui/NotificationBell'
import ProModal from '@/components/ui/ProModal'

export default async function MapPage() {
  const supabase = await createServerClient_()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Fetch or create profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const username = user.email?.split('@')[0] ?? `player_${user.id.slice(0, 6)}`
    const colors = ['#4a90d9', '#d94a4a', '#4ad94a', '#d9a84a', '#9a4ad9']
    const display_color = colors[Math.floor(Math.random() * colors.length)]
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({ id: user.id, username, display_color })
      .select()
      .single()
    profile = newProfile
  }

  // Fetch all territories with owner profiles
  const { data: territories } = await supabase
    .from('territories')
    .select('*, owner:profiles(*)')
    .order('id')

  // Fetch top 10 leaderboard
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, username, display_color, territory_count')
    .order('territory_count', { ascending: false })
    .limit(10)

  // Fetch challenges where user is defender
  const { data: pendingChallenges } = await supabase
    .from('challenges')
    .select('*, territory:territories(*), challenger:profiles!challenges_challenger_id_fkey(*)')
    .eq('defender_id', user.id)
    .eq('status', 'pending')

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Nav */}
      <nav className="h-12 flex items-center justify-between px-4 border-b border-neutral-800 shrink-0">
        <h1 className="font-cinzel text-lg font-bold text-[#c8a96e] tracking-widest">
          CONQUEST
        </h1>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-xs text-neutral-400">
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: profile.display_color }}
              />
              {profile.username}
            </span>
          )}
          <NotificationBell
            userId={user.id}
            initialCount={pendingChallenges?.length ?? 0}
          />
          <ProModal />
        </div>
      </nav>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <HexMap
          initialTerritories={territories ?? []}
          currentUser={profile}
        />
        <MapSidebar
          currentUser={profile}
          leaderboard={leaderboard ?? []}
          pendingChallenges={pendingChallenges ?? []}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/map/MapSidebar.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile, Challenge } from '@/lib/types'

interface Props {
  currentUser: Profile | null
  leaderboard: Profile[]
  pendingChallenges: Challenge[]
}

export default function MapSidebar({ currentUser, leaderboard, pendingChallenges }: Props) {
  const [challenges, setChallenges] = useState(pendingChallenges)
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleAccept(challenge: Challenge) {
    setLoading(challenge.id)
    const { error } = await supabase
      .from('challenges')
      .update({ status: 'active' })
      .eq('id', challenge.id)
    if (!error) {
      setChallenges(prev => prev.filter(c => c.id !== challenge.id))
      router.push(`/game/${challenge.id}`)
    }
    setLoading(null)
  }

  async function handleForfeit(challenge: Challenge) {
    setLoading(challenge.id)
    await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: challenge.id,
        winnerId: challenge.challenger_id,
        pgn: '',
      }),
    })
    setChallenges(prev => prev.filter(c => c.id !== challenge.id))
    setLoading(null)
    router.refresh()
  }

  const myRank = leaderboard.findIndex(p => p.id === currentUser?.id) + 1

  return (
    <aside className="w-[280px] border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
      {/* Player Card */}
      {currentUser && (
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentUser.display_color }}
            />
            <span className="font-cinzel text-sm font-semibold text-[#c8a96e]">
              {currentUser.username}
            </span>
          </div>
          <div className="text-xs text-neutral-400 space-y-0.5 ml-5">
            <div>{currentUser.territory_count} territories</div>
            {myRank > 0 && <div>Rank #{myRank}</div>}
          </div>
        </div>
      )}

      {/* Pending Challenges */}
      {challenges.length > 0 && (
        <div className="p-4 border-b border-neutral-800">
          <h3 className="text-xs font-semibold text-[#8b2020] uppercase tracking-wider mb-3">
            ⚔️ Under Attack ({challenges.length})
          </h3>
          <div className="space-y-2">
            {challenges.map(c => (
              <div key={c.id} className="bg-neutral-900 rounded p-2 text-xs">
                <div className="text-neutral-300 mb-1">
                  <span className="text-[#8b2020] font-medium">
                    {(c.challenger as Profile)?.username ?? 'Unknown'}
                  </span>{' '}
                  challenges{' '}
                  <span className="text-[#c8a96e]">
                    {(c.territory as any)?.name ?? 'your hex'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(c)}
                    disabled={loading === c.id}
                    className="flex-1 py-1 bg-[#c8a96e] hover:bg-[#b8995e] text-black font-semibold rounded text-xs transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleForfeit(c)}
                    disabled={loading === c.id}
                    className="flex-1 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition-colors disabled:opacity-50"
                  >
                    Forfeit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Leaderboard
        </h3>
        <ol className="space-y-1">
          {leaderboard.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                p.id === currentUser?.id ? 'bg-neutral-800' : ''
              }`}
            >
              <span className="text-neutral-500 w-4 text-right">{i + 1}</span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.display_color }}
              />
              <span className="flex-1 text-neutral-300 truncate">{p.username}</span>
              <span className="text-[#c8a96e] font-medium">{p.territory_count}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Write `components/ui/NotificationBell.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
  initialCount: number
}

export default function NotificationBell({ userId, initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const supabase = createClient()

  useEffect(() => {
    // Poll every 60 seconds
    const interval = setInterval(async () => {
      const { count: newCount } = await supabase
        .from('challenges')
        .select('*', { count: 'exact', head: true })
        .eq('defender_id', userId)
        .eq('status', 'pending')
      if (newCount !== null) setCount(newCount)
    }, 60000)

    return () => clearInterval(interval)
  }, [userId, supabase])

  return (
    <div className="relative">
      <button className="text-neutral-400 hover:text-neutral-200 transition-colors text-lg leading-none">
        🔔
      </button>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#8b2020] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `components/ui/ProModal.tsx`**

```typescript
'use client'

import { useState } from 'react'

export default function ProModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1 border border-[#c8a96e] text-[#c8a96e] hover:bg-[#c8a96e] hover:text-black rounded font-semibold transition-colors"
      >
        Upgrade to Pro
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-lg p-8 max-w-sm w-full mx-4 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-cinzel text-xl font-bold text-[#c8a96e]">Conquest Pro</h2>
            <ul className="text-sm text-neutral-300 space-y-2">
              <li>✦ Custom territory themes</li>
              <li>✦ Exclusive piece skins</li>
              <li>✦ Priority matchmaking</li>
              <li>✦ Extended AI coaching</li>
            </ul>
            <p className="text-xs text-neutral-500">Coming soon — join the waitlist</p>
            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 bg-[#c8a96e] hover:bg-[#b8995e] text-black font-semibold rounded text-sm transition-colors"
            >
              Notify Me
            </button>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: Verify the map page renders**

```bash
npm run dev
```

Navigate to http://localhost:3000. Sign in, verify:
- Nav with username and bell
- Hex grid renders 37 hexes
- Sidebar shows leaderboard with 4 bot profiles
- Hexes owned by bots show in their colors

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/map/MapSidebar.tsx components/ui/NotificationBell.tsx components/ui/ProModal.tsx
git commit -m "feat: add main map page, sidebar, notification bell, and pro modal"
```

---

## Task 9: ChessGame Component + Stockfish

**Files:**
- Create: `components/chess/ChessGame.tsx`

- [ ] **Step 1: Write `components/chess/ChessGame.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'

export type GameMode = 'stockfish' | 'human'
export type GameResult = 'win' | 'loss' | 'draw' | null

interface Props {
  mode: GameMode
  initialFen?: string
  playerColor?: 'white' | 'black'
  onMove?: (fen: string, pgn: string) => void
  onGameOver?: (result: GameResult, pgn: string) => void
  opponentMove?: string | null  // SAN move from opponent (human mode)
}

export default function ChessGame({
  mode,
  initialFen,
  playerColor = 'white',
  onMove,
  onGameOver,
  opponentMove,
}: Props) {
  const [chess] = useState(() => new Chess(initialFen))
  const [fen, setFen] = useState(chess.fen())
  const [result, setResult] = useState<GameResult>(null)
  const [thinking, setThinking] = useState(false)
  const workerRef = useRef<Worker | null>(null)

  // Initialize Stockfish worker
  useEffect(() => {
    if (mode !== 'stockfish') return
    const worker = new Worker('/stockfish.js')
    workerRef.current = worker
    worker.postMessage('uci')
    worker.postMessage('ucinewgame')

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data
      if (line.startsWith('bestmove')) {
        const moveStr = line.split(' ')[1]
        if (!moveStr || moveStr === '(none)') return
        const from = moveStr.slice(0, 2)
        const to = moveStr.slice(2, 4)
        const promotion = moveStr[4] ?? undefined
        const move = chess.move({ from, to, promotion })
        if (move) {
          setFen(chess.fen())
          onMove?.(chess.fen(), chess.pgn())
          setThinking(false)
          checkGameOver()
        }
      }
    }

    return () => { worker.terminate() }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply opponent move in human mode
  useEffect(() => {
    if (mode !== 'human' || !opponentMove) return
    try {
      chess.move(opponentMove)
      setFen(chess.fen())
      checkGameOver()
    } catch {}
  }, [opponentMove]) // eslint-disable-line react-hooks/exhaustive-deps

  function checkGameOver() {
    if (!chess.isGameOver()) return
    let r: GameResult = null
    if (chess.isDraw()) {
      r = 'draw'
    } else {
      // The side that just moved wins
      const winningSide = chess.turn() === 'w' ? 'black' : 'white'
      r = winningSide === playerColor ? 'win' : 'loss'
    }
    setResult(r)
    onGameOver?.(r, chess.pgn())
  }

  function requestStockfishMove() {
    if (!workerRef.current) return
    setThinking(true)
    workerRef.current.postMessage(`position fen ${chess.fen()}`)
    workerRef.current.postMessage('go depth 10')
  }

  const isPlayerTurn = chess.turn() === playerColor[0] // 'w' or 'b'

  function onPieceDrop(source: string, target: string): boolean {
    if (result) return false
    if (mode === 'stockfish' && !isPlayerTurn) return false
    if (mode === 'human' && !isPlayerTurn) return false

    const move = chess.move({ from: source, to: target, promotion: 'q' })
    if (!move) return false

    setFen(chess.fen())
    onMove?.(chess.fen(), chess.pgn())

    if (chess.isGameOver()) {
      checkGameOver()
      return true
    }

    if (mode === 'stockfish') {
      requestStockfishMove()
    }

    return true
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          boardOrientation={playerColor}
          arePiecesDraggable={!result && isPlayerTurn}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
          customDarkSquareStyle={{ backgroundColor: '#4a3728' }}
          customLightSquareStyle={{ backgroundColor: '#c8a96e' }}
        />
        {thinking && (
          <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
            <span className="bg-black/70 text-[#c8a96e] text-xs px-2 py-1 rounded">
              Stockfish thinking…
            </span>
          </div>
        )}
      </div>

      {result && (
        <div className={`text-lg font-cinzel font-bold ${
          result === 'win' ? 'text-[#c8a96e]' :
          result === 'loss' ? 'text-[#8b2020]' :
          'text-neutral-400'
        }`}>
          {result === 'win' ? '⚔️ Victory!' :
           result === 'loss' ? '💀 Defeated' :
           '🤝 Draw'}
        </div>
      )}

      <div className="text-xs text-neutral-500">
        {result
          ? ''
          : isPlayerTurn
          ? `Your turn (${playerColor})`
          : mode === 'stockfish'
          ? 'Stockfish thinking…'
          : 'Waiting for opponent…'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chess/ChessGame.tsx
git commit -m "feat: add ChessGame component supporting both Stockfish and human-vs-human modes"
```

---

## Task 10: Claim Flow

**Files:**
- Create: `components/ui/ClaimModal.tsx`
- Create: `app/api/claim/route.ts`

- [ ] **Step 1: Write `components/ui/ClaimModal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Territory, Profile } from '@/lib/types'
import type { GameResult } from '@/components/chess/ChessGame'
import ChessGame from '@/components/chess/ChessGame'
import AICoachPanel from '@/components/chess/AICoachPanel'

interface Props {
  territory: Territory
  currentUser: Profile
  onClose: () => void
}

type Phase = 'confirm' | 'playing' | 'result'

export default function ClaimModal({ territory, currentUser, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [result, setResult] = useState<GameResult>(null)
  const [pgn, setPgn] = useState('')
  const router = useRouter()

  async function handleGameOver(r: GameResult, finalPgn: string) {
    setResult(r)
    setPgn(finalPgn)
    setPhase('result')

    if (r === 'win') {
      await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId: territory.id, pgn: finalPgn }),
      })
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="font-cinzel font-bold text-[#c8a96e]">{territory.name}</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Unclaimed territory</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {phase === 'confirm' && (
            <div className="text-center space-y-4">
              <p className="text-sm text-neutral-300">
                Challenge Stockfish (depth 10) to claim{' '}
                <strong className="text-[#c8a96e]">{territory.name}</strong>.
                Win and it's yours.
              </p>
              <button
                onClick={() => setPhase('playing')}
                className="px-6 py-2.5 bg-[#c8a96e] hover:bg-[#b8995e] text-black font-semibold rounded transition-colors"
              >
                Begin Battle
              </button>
            </div>
          )}

          {phase === 'playing' && (
            <div className="flex justify-center">
              <ChessGame
                mode="stockfish"
                playerColor="white"
                onGameOver={handleGameOver}
              />
            </div>
          )}

          {phase === 'result' && (
            <div className="space-y-4">
              <div className={`text-center text-xl font-cinzel font-bold ${
                result === 'win' ? 'text-[#c8a96e]' :
                result === 'loss' ? 'text-[#8b2020]' :
                'text-neutral-400'
              }`}>
                {result === 'win'
                  ? `⚔️ ${territory.name} is yours!`
                  : result === 'loss'
                  ? '💀 Stockfish held the line.'
                  : '🤝 Draw — territory remains unclaimed.'}
              </div>
              {pgn && <AICoachPanel pgn={pgn} />}
              <div className="flex justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded text-sm transition-colors"
                >
                  Back to Map
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `app/api/claim/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: Request) {
  const { territoryId, pgn } = await request.json()

  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify territory is unclaimed
  const { data: territory } = await supabase
    .from('territories')
    .select('id, owner_id')
    .eq('id', territoryId)
    .single()

  if (!territory) return NextResponse.json({ error: 'Territory not found' }, { status: 404 })
  if (territory.owner_id) return NextResponse.json({ error: 'Already claimed' }, { status: 409 })

  // Transfer ownership (service role to bypass RLS)
  const service = createServiceClient()
  const { error } = await service
    .from('territories')
    .update({ owner_id: user.id })
    .eq('id', territoryId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Test the claim flow**

```bash
npm run dev
```

1. Sign in, click a gray (unclaimed) hex
2. Click "Begin Battle"
3. Play chess against Stockfish — make moves on the board
4. Win (or verify defeat scenario)
5. If win: verify hex changes color in map and territory_count increments

- [ ] **Step 4: Commit**

```bash
git add components/ui/ClaimModal.tsx app/api/claim/route.ts
git commit -m "feat: add claim flow — Stockfish game modal + /api/claim territory transfer"
```

---

## Task 11: Challenge Flow

**Files:**
- Create: `components/ui/ChallengeModal.tsx`
- Create: `app/api/challenge/route.ts`

- [ ] **Step 1: Write `components/ui/ChallengeModal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Territory, Profile } from '@/lib/types'

interface Props {
  territory: Territory
  currentUser: Profile
  onClose: () => void
}

export default function ChallengeModal({ territory, currentUser, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleChallenge() {
    setLoading(true)
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territoryId: territory.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to send challenge')
      setLoading(false)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-sm w-full">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="font-cinzel font-bold text-[#8b2020]">Challenge Territory</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 text-xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-neutral-300 space-y-1">
            <div>
              Territory: <strong className="text-[#c8a96e]">{territory.name}</strong>
            </div>
            <div>
              Defender: <strong className="text-neutral-200">
                {territory.owner?.username ?? 'Unknown'}
              </strong>
            </div>
          </div>

          <p className="text-xs text-neutral-500">
            Send a chess challenge. The defender must accept or forfeit within their session.
            Winner takes the hex.
          </p>

          {error && (
            <p className="text-xs text-[#8b2020]">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleChallenge}
              disabled={loading}
              className="flex-1 py-2.5 bg-[#8b2020] hover:bg-[#7a1a1a] text-white font-semibold rounded text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending…' : '⚔️ Send Challenge'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `app/api/challenge/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerClient_, createServiceClient } from '@/lib/supabase'
import { canChallenge } from '@/lib/hex-utils'

export async function POST(request: Request) {
  const { territoryId } = await request.json()

  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch target territory
  const { data: territory } = await supabase
    .from('territories')
    .select('id, hex_q, hex_r, owner_id')
    .eq('id', territoryId)
    .single()

  if (!territory) return NextResponse.json({ error: 'Territory not found' }, { status: 404 })
  if (!territory.owner_id) return NextResponse.json({ error: 'Territory is unclaimed' }, { status: 400 })
  if (territory.owner_id === user.id) return NextResponse.json({ error: 'Cannot challenge own territory' }, { status: 400 })

  // Adjacency check
  const { data: allTerritories } = await supabase
    .from('territories')
    .select('hex_q, hex_r, owner_id')

  const myHexes = (allTerritories ?? [])
    .filter(t => t.owner_id === user.id)
    .map(t => ({ q: t.hex_q, r: t.hex_r }))

  if (!canChallenge(myHexes, { q: territory.hex_q, r: territory.hex_r })) {
    return NextResponse.json({ error: 'You must own an adjacent hex to challenge' }, { status: 403 })
  }

  // Check for existing pending challenge on this territory
  const { data: existing } = await supabase
    .from('challenges')
    .select('id')
    .eq('territory_id', territoryId)
    .in('status', ['pending', 'active'])
    .single()

  if (existing) return NextResponse.json({ error: 'This territory is already contested' }, { status: 409 })

  // Create challenge
  const service = createServiceClient()
  const { data: challenge, error } = await service
    .from('challenges')
    .insert({
      territory_id: territoryId,
      challenger_id: user.id,
      defender_id: territory.owner_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ challengeId: challenge.id })
}
```

- [ ] **Step 3: Test the challenge flow**

1. As a signed-in user with at least one territory adjacent to a bot territory:
2. Click an adjacent enemy hex
3. "Send Challenge" button appears
4. Click it — challenge row should appear in Supabase challenges table
5. The hex should show ⚔️ icon on the map

- [ ] **Step 4: Commit**

```bash
git add components/ui/ChallengeModal.tsx app/api/challenge/route.ts
git commit -m "feat: add challenge flow with adjacency enforcement and /api/challenge route"
```

---

## Task 12: Human vs Human Game Page + Resolve API

**Files:**
- Create: `app/game/[id]/page.tsx`
- Create: `app/api/resolve/route.ts`

- [ ] **Step 1: Write `app/game/[id]/page.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ChessGame from '@/components/chess/ChessGame'
import AICoachPanel from '@/components/chess/AICoachPanel'
import type { Challenge, Profile } from '@/lib/types'

export default function GamePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [opponentMove, setOpponentMove] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser(profile)

      const { data: ch } = await supabase
        .from('challenges')
        .select('*, territory:territories(*), challenger:profiles!challenges_challenger_id_fkey(*), defender:profiles!challenges_defender_id_fkey(*)')
        .eq('id', id)
        .single()
      setChallenge(ch)
    }
    load()
  }, [id, supabase, router])

  // Subscribe to move updates
  useEffect(() => {
    if (!challenge) return
    const channel = supabase
      .channel(`game-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Challenge
          setChallenge(prev => prev ? { ...prev, ...updated } : updated)
          // Extract last SAN move from PGN for opponent move
          if (updated.pgn) {
            const moves = updated.pgn
              .replace(/\d+\.\s*/g, '')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
            const lastMove = moves[moves.length - 1]
            if (lastMove) setOpponentMove(lastMove)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [challenge, id, supabase])

  const handleMove = useCallback(async (fen: string, pgn: string) => {
    await supabase
      .from('challenges')
      .update({ current_fen: fen, pgn })
      .eq('id', id)
  }, [id, supabase])

  const handleGameOver = useCallback(async (result: 'win' | 'loss' | 'draw' | null, pgn: string) => {
    if (!currentUser || !challenge || gameOver) return
    setGameOver(true)

    let winnerId: string | null = null
    if (result === 'win') winnerId = currentUser.id
    else if (result === 'loss') {
      winnerId = currentUser.id === challenge.challenger_id
        ? challenge.defender_id
        : challenge.challenger_id
    }

    const res = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: id, winnerId, pgn }),
    })
    const data = await res.json()
    if (data.analysis) setAnalysis(data.analysis)
  }, [currentUser, challenge, id, gameOver])

  if (!challenge || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-neutral-400 text-sm">Loading game…</div>
      </div>
    )
  }

  const isChallenger = currentUser.id === challenge.challenger_id
  const playerColor: 'white' | 'black' = isChallenger ? 'white' : 'black'
  const opponent = isChallenger
    ? (challenge.defender as Profile)
    : (challenge.challenger as Profile)

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <nav className="h-12 flex items-center px-4 border-b border-neutral-800">
        <button
          onClick={() => router.push('/')}
          className="text-neutral-400 hover:text-neutral-200 text-sm mr-4"
        >
          ← Map
        </button>
        <h1 className="font-cinzel text-sm text-[#c8a96e]">
          {(challenge.territory as any)?.name ?? 'Battle'} — {currentUser.username} vs {opponent?.username}
        </h1>
      </nav>

      <div className="flex-1 flex items-start justify-center gap-8 p-8">
        <div className="flex flex-col items-center gap-4">
          <ChessGame
            mode="human"
            initialFen={challenge.current_fen}
            playerColor={playerColor}
            onMove={handleMove}
            onGameOver={handleGameOver}
            opponentMove={opponentMove}
          />
        </div>

        {analysis && (
          <div className="w-72 mt-2">
            <AICoachPanel pgn={challenge.pgn ?? ''} initialAnalysis={analysis} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `app/api/resolve/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerClient_, createServiceClient } from '@/lib/supabase'

export async function POST(request: Request) {
  const { challengeId, winnerId, pgn } = await request.json()

  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Fetch challenge
  const { data: challenge } = await service
    .from('challenges')
    .select('*, territory:territories(*)')
    .eq('id', challengeId)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  if (challenge.status === 'completed') return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  // Transfer territory if there's a winner
  if (winnerId) {
    await service
      .from('territories')
      .update({ owner_id: winnerId })
      .eq('id', challenge.territory_id)
  }

  // Mark challenge completed
  await service
    .from('challenges')
    .update({ status: 'completed', winner_id: winnerId ?? null, pgn })
    .eq('id', challengeId)

  // Trigger AI analysis asynchronously
  let analysis: string | null = null
  if (pgn) {
    try {
      const analyzeRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ''}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal': process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        },
        body: JSON.stringify({ pgn, challengeId }),
      })
      if (analyzeRes.ok) {
        const { analysis: a } = await analyzeRes.json()
        analysis = a
      }
    } catch {}
  }

  return NextResponse.json({ success: true, analysis })
}
```

Note: The analyze call above needs the correct base URL. Update it:

```typescript
// Replace the fetch URL in resolve/route.ts:
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

const analyzeRes = await fetch(`${baseUrl}/api/analyze`, { ... })
```

- [ ] **Step 3: Commit**

```bash
git add app/game/[id]/page.tsx app/api/resolve/route.ts
git commit -m "feat: add human vs human game page with realtime moves and resolve API"
```

---

## Task 13: AI Coach

**Files:**
- Create: `app/api/analyze/route.ts`
- Create: `components/chess/AICoachPanel.tsx`

- [ ] **Step 1: Write `app/api/analyze/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: Request) {
  const { pgn, challengeId } = await request.json()

  if (!pgn) return NextResponse.json({ error: 'No PGN provided' }, { status: 400 })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Analyze this chess game PGN and give exactly 3 short bullet points for the losing player. Focus on: (1) the turning point move, (2) the best missed opportunity, (3) the key lesson. Be concise — one sentence per bullet. PGN:\n\n${pgn}`,
      },
    ],
  })

  const analysis = message.content[0].type === 'text' ? message.content[0].text : null

  // Save analysis to challenge row
  if (challengeId && analysis) {
    const service = createServiceClient()
    await service
      .from('challenges')
      .update({ ai_analysis: analysis })
      .eq('id', challengeId)
  }

  return NextResponse.json({ analysis })
}
```

- [ ] **Step 2: Write `components/chess/AICoachPanel.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'

interface Props {
  pgn: string
  initialAnalysis?: string | null
}

export default function AICoachPanel({ pgn, initialAnalysis }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(initialAnalysis ?? null)
  const [loading, setLoading] = useState(!initialAnalysis && !!pgn)

  useEffect(() => {
    if (initialAnalysis || !pgn) return
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pgn }),
    })
      .then(r => r.json())
      .then(data => {
        setAnalysis(data.analysis ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [pgn, initialAnalysis])

  if (!pgn) return null

  return (
    <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-900 space-y-3">
      <h3 className="font-cinzel text-sm font-semibold text-[#c8a96e] flex items-center gap-2">
        🧠 AI Coach
      </h3>
      {loading ? (
        <div className="text-xs text-neutral-500 animate-pulse">Analyzing your game…</div>
      ) : analysis ? (
        <div className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
          {analysis}
        </div>
      ) : (
        <div className="text-xs text-neutral-500">No analysis available.</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Test AI analysis**

1. Play and finish a game vs Stockfish
2. Verify AICoachPanel appears on game-over screen
3. Verify 3-bullet analysis appears within a few seconds
4. Check Supabase challenges table — `ai_analysis` column should be populated

- [ ] **Step 4: Commit**

```bash
git add app/api/analyze/route.ts components/chess/AICoachPanel.tsx
git commit -m "feat: add AI coach — Claude API post-game analysis with 3-bullet output"
```

---

## Task 14: Profile Creation on Sign-In

**Files:**
- Create: `app/api/auth/callback/route.ts`

Supabase's OAuth redirect needs a callback handler to exchange the code for a session.

- [ ] **Step 1: Write `app/api/auth/callback/route.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 2: Update Supabase Google OAuth redirect URL**

In Supabase dashboard → Authentication → URL Configuration → add:
```
http://localhost:3000/api/auth/callback
https://your-vercel-domain.vercel.app/api/auth/callback
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/callback/route.ts
git commit -m "feat: add OAuth callback route for Google sign-in code exchange"
```

---

## Task 15: Polish + Final QA

**Files:**
- No new files — verify existing flows end-to-end

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All hex-utils tests PASS.

- [ ] **Step 2: Verify claim flow end-to-end**

1. Sign in
2. Click a gray hex
3. Play vs Stockfish and win
4. Confirm hex turns your color on the map
5. Confirm territory_count increments in sidebar
6. Confirm AI coach bullets appear

- [ ] **Step 3: Verify challenge flow end-to-end**

1. Sign in as Player A (your account), click enemy hex adjacent to your territory
2. Send challenge
3. Sign in as Player B in another browser (use one of the bot emails: `bot1@conquest.local` / password `conquest-bot-2026`)
4. Player B sees ⚔️ notification bell count
5. Player B accepts in sidebar → both land on `/game/[id]`
6. Play through; winner takes the hex

- [ ] **Step 4: Verify realtime**

Open map in two browser windows. Claim a hex in window 1. Verify it updates in window 2 without refresh.

- [ ] **Step 5: Check mobile responsiveness**

Resize browser to 375px. The hex map should remain usable (may be scrollable — that's acceptable for a hackathon).

- [ ] **Step 6: Fix TypeScript errors**

```bash
npm run build
```

Fix any type errors. The build must pass cleanly before deploy.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: resolve any TypeScript and build errors before deploy"
```

---

## Task 16: Vercel Deploy

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/conquest.git
git push -u origin main
```

- [ ] **Step 2: Import to Vercel**

1. Go to vercel.com → New Project → Import from GitHub
2. Select the `conquest` repo
3. Framework: Next.js (auto-detected)
4. Add all environment variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
5. Deploy

- [ ] **Step 3: Update Supabase callback URL**

In Supabase → Authentication → URL Configuration, add your Vercel URL:
```
https://conquest-YOUR_HASH.vercel.app/api/auth/callback
```

- [ ] **Step 4: Smoke test production**

1. Visit production URL
2. Sign in with Google
3. Verify map loads with bot territories
4. Claim a hex vs Stockfish
5. Verify AI analysis appears

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "chore: production deploy verified"
```

---

## Self-Review: Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| 37-hex map, 3-ring pattern | Task 4 (TERRITORIES array), Task 7 (HexMap) |
| Hexes colored by owner | Task 7 (TerritoryHex fill logic) |
| Owner username on hex | Task 7 (TerritoryHex Text element) |
| ⚔️ on contested hexes | Task 7 (TerritoryHex isContested) |
| vs Stockfish claim flow | Tasks 9, 10 |
| vs Human challenge flow | Tasks 11, 12 |
| Adjacency rule enforced | Task 11 (/api/challenge adjacency check) |
| Live map via Realtime | Task 7 (HexMap channel subscription) |
| Leaderboard top 10 | Task 8 (MapSidebar) |
| Pending challenges + Accept/Forfeit | Task 8 (MapSidebar) |
| Bell with unread count | Task 8 (NotificationBell) |
| Poll every 60s | Task 8 (NotificationBell interval) |
| AI Coach 3 bullets | Task 13 |
| Post-game analysis panel | Task 13 (AICoachPanel) |
| "Upgrade to Pro" button + modal | Task 8 (ProModal) |
| Google OAuth + magic link | Task 6 (auth page) |
| profile auto-create on sign-in | Task 8 (page.tsx profile upsert) |
| territory_count trigger | Task 2 (schema SQL trigger) |
| 4 bot profiles seeded | Task 5 (seed.ts) |
| Dark war aesthetic, Cinzel font | Tasks 6, 7, 8 |
| Vercel deploy | Task 16 |
| Demo accounts for judges | Task 5 |
