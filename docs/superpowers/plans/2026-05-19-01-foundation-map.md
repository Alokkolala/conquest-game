# Conquest — Plan 01: Foundation + Live Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js app, wire up Supabase auth and DB, seed 37 territories with 4 bot owners, and render a live-updating hex grid map where territory colors reflect real ownership.

**Architecture:** Next.js 14 App Router. Supabase handles auth (magic link + Google OAuth), Postgres, and realtime. The hex grid is a client component wrapping react-hex-grid, fed by a server component that fetches all territories with owner profiles. Supabase Realtime channel pushes territory `UPDATE` events so the map reflects changes without a page reload.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, `@supabase/ssr`, react-hex-grid, Vitest, Google Fonts (Cinzel + Inter)

**What this plan does NOT include:** Chess, Stockfish, challenges, AI coach — those are Plans 02–04.

**Deliverable:** Sign in → see a dark themed map with 37 hexes, 4 bots owning 12 colored hexes, your username in the nav, a leaderboard sidebar, and live updates when any territory changes owner in the DB.

---

## File Map

```
/app
  layout.tsx                  — root layout, Cinzel + Inter fonts, dark bg
  page.tsx                    — server component: fetches territories + user, renders map
  /auth/page.tsx              — sign-in page (magic link + Google)
  /api/auth/callback/route.ts — OAuth code → session exchange

/components
  /map
    HexMap.tsx                — client component: react-hex-grid, realtime sub, click stubs
    TerritoryHex.tsx          — single hex: fill color, owner label, name label
    MapSidebar.tsx            — leaderboard top-10 + player card
  /ui
    ProModal.tsx              — "Upgrade to Pro" stub modal (nav button)

/lib
  types.ts                    — Profile, Territory interfaces
  supabase.ts                 — createClient (browser) + createServerClient_ (server)
  hex-utils.ts                — TERRITORIES array (37 coords+names), hexDistance, isAdjacent, canChallenge
  seed.ts                     — Node script: insert 37 territories + 4 bot profiles

/supabase
  schema.sql                  — CREATE TABLE profiles/territories/challenges, RLS, trigger

/__tests__
  hex-utils.test.ts           — unit tests for hex math

middleware.ts                 — redirect unauthenticated users to /auth
tailwind.config.ts
next.config.ts
vitest.config.ts
.env.local                    — Supabase + Anthropic keys (not committed)
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.local`

- [ ] **Step 1: Initialize Next.js**

```bash
cd C:/projects/conquest
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Answer prompts: Yes to all defaults. This creates `app/`, `tailwind.config.ts`, `tsconfig.json`, `package.json`.

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  react-hex-grid

npm install -D \
  vitest \
  @vitejs/plugin-react \
  jsdom \
  tsx
```

- [ ] **Step 3: Write `next.config.ts`**

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

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 5: Add test script to `package.json`**

Open `package.json`. In the `"scripts"` object, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Write `.env.local`**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
EOF
```

Fill in real values from your Supabase project → Settings → API.

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: `✓ Ready in Xms` at http://localhost:3000 (shows default Next.js page). Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 14 app with Supabase and react-hex-grid deps"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create the schema file**

Create `supabase/schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────
create table if not exists profiles (
  id            uuid references auth.users primary key,
  username      text unique not null,
  display_color text not null default '#4a90d9',
  territory_count int not null default 0,
  created_at    timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- ─────────────────────────────────────────
-- territories
-- ─────────────────────────────────────────
create table if not exists territories (
  id         serial primary key,
  name       text not null,
  hex_q      int not null,
  hex_r      int not null,
  owner_id   uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(hex_q, hex_r)
);

alter table territories enable row level security;

create policy "territories_select_all" on territories
  for select using (true);

-- Service role bypasses RLS for server-side writes
create policy "territories_update_all" on territories
  for update using (true);

-- ─────────────────────────────────────────
-- challenges (stub — needed for FK later)
-- ─────────────────────────────────────────
create table if not exists challenges (
  id            uuid primary key default gen_random_uuid(),
  territory_id  int references territories(id),
  challenger_id uuid references profiles(id),
  defender_id   uuid references profiles(id),
  current_fen   text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn           text not null default '',
  status        text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'forfeited')),
  winner_id     uuid references profiles(id),
  ai_analysis   text,
  created_at    timestamptz default now()
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

-- ─────────────────────────────────────────
-- Auto-sync territory_count on ownership change
-- ─────────────────────────────────────────
create or replace function sync_territory_counts()
returns trigger language plpgsql security definer as $$
begin
  if OLD.owner_id is not null then
    update profiles set territory_count = territory_count - 1 where id = OLD.owner_id;
  end if;
  if NEW.owner_id is not null then
    update profiles set territory_count = territory_count + 1 where id = NEW.owner_id;
  end if;
  return NEW;
end;
$$;

create trigger on_territory_owner_change
  after update of owner_id on territories
  for each row
  when (OLD.owner_id is distinct from NEW.owner_id)
  execute function sync_territory_counts();
```

- [ ] **Step 2: Run schema in Supabase**

In Supabase dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run.

Expected: No errors. Verify in Table Editor: tables `profiles`, `territories`, `challenges` exist.

- [ ] **Step 3: Enable Realtime on territories**

Supabase dashboard → Database → Replication → find `territories` table → toggle on Realtime. Do the same for `challenges`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema — profiles, territories, challenges, territory_count trigger"
```

---

## Task 3: Types + Supabase Clients

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`

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

// ── Browser client (Client Components) ──────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Server client (Server Components + API Routes) ───────────
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// ── Service role client (privileged writes in API routes) ────
export function createServiceClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/supabase.ts
git commit -m "feat: add shared TypeScript types and Supabase client factories"
```

---

## Task 4: Hex Utilities (TDD)

**Files:**
- Create: `lib/hex-utils.ts`
- Create: `__tests__/hex-utils.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `__tests__/hex-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  hexDistance,
  isAdjacent,
  canChallenge,
  TERRITORIES,
} from '../lib/hex-utils'

describe('hexDistance', () => {
  it('returns 0 for same hex', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0)
  })

  it('returns 1 for adjacent hexes', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1)
  })

  it('returns 2 for two-step hex', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2)
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2)
  })

  it('returns 3 for ring-3 hex from center', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3)
    expect(hexDistance({ q: 0, r: 0 }, { q: -3, r: 3 })).toBe(3)
  })
})

describe('isAdjacent', () => {
  it('returns true for distance-1 pair', () => {
    expect(isAdjacent({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(true)
  })

  it('returns false for same hex', () => {
    expect(isAdjacent({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(false)
  })

  it('returns false for distance-2 pair', () => {
    expect(isAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false)
  })
})

describe('canChallenge', () => {
  it('allows challenge when a player hex is adjacent to target', () => {
    expect(canChallenge([{ q: 0, r: 0 }], { q: 1, r: 0 })).toBe(true)
  })

  it('disallows challenge when no player hex is adjacent', () => {
    expect(canChallenge([{ q: 0, r: 0 }], { q: 2, r: 0 })).toBe(false)
  })

  it('allows when any of multiple player hexes is adjacent', () => {
    expect(canChallenge([{ q: 0, r: 0 }, { q: 3, r: 0 }], { q: 2, r: 0 })).toBe(true)
  })
})

describe('TERRITORIES', () => {
  it('has exactly 37 entries', () => {
    expect(TERRITORIES).toHaveLength(37)
  })

  it('has unique coordinates', () => {
    const keys = TERRITORIES.map(t => `${t.q},${t.r}`)
    expect(new Set(keys).size).toBe(37)
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

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: `Cannot find module '../lib/hex-utils'`

- [ ] **Step 3: Write `lib/hex-utils.ts`**

```typescript
export interface HexCoord {
  q: number
  r: number
}

/** Axial/cube distance between two hex coordinates. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  const ds = -dq - dr
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))
}

/** True iff the two hexes share an edge (distance exactly 1). */
export function isAdjacent(a: HexCoord, b: HexCoord): boolean {
  return hexDistance(a, b) === 1
}

/**
 * Returns true if the player can challenge `target` —
 * at least one hex in `myHexes` must be adjacent to it.
 */
export function canChallenge(myHexes: HexCoord[], target: HexCoord): boolean {
  return myHexes.some(mine => isAdjacent(mine, target))
}

/**
 * All 37 territory definitions for the 3-ring axial hex map.
 * Names are hardcoded per spec — do not rename or reorder.
 */
export const TERRITORIES: Array<HexCoord & { name: string }> = [
  // Ring 0 — center
  { q:  0, r:  0, name: 'The High Seat' },
  // Ring 1
  { q:  1, r:  0, name: 'Ironhold' },
  { q:  0, r:  1, name: 'Goldenport' },
  { q: -1, r:  1, name: 'Ashridge' },
  { q: -1, r:  0, name: 'Mistveil' },
  { q:  0, r: -1, name: 'Greyspire' },
  { q:  1, r: -1, name: 'Emberglass' },
  // Ring 2
  { q:  2, r:  0, name: 'The Deep Hollow' },
  { q:  2, r: -1, name: 'Stonegate' },
  { q:  2, r: -2, name: 'The Ember Shelf' },
  { q:  1, r: -2, name: 'The Iron Pass' },
  { q:  0, r: -2, name: 'The Amber Vale' },
  { q: -1, r: -1, name: 'Windfell' },
  { q: -2, r:  0, name: 'The Pale Marsh' },
  { q: -2, r:  1, name: 'The Rust Hills' },
  { q: -2, r:  2, name: 'Copperfield' },
  { q: -1, r:  2, name: 'The Still Water' },
  { q:  0, r:  2, name: 'Sunken Gate' },
  { q:  1, r:  1, name: 'Driftmark' },
  // Ring 3
  { q:  3, r:  0, name: 'Redmount' },
  { q:  3, r: -1, name: 'The Dark Helm' },
  { q:  3, r: -2, name: 'Wavecrest' },
  { q:  3, r: -3, name: 'Cinderfen' },
  { q:  2, r: -3, name: 'The Pale Crown' },
  { q:  1, r: -3, name: 'Sandwatch' },
  { q:  0, r: -3, name: "The Raven's Keep" },
  { q: -1, r: -2, name: 'Frostmere' },
  { q: -2, r: -1, name: 'Dusthaven' },
  { q: -3, r:  0, name: 'The Black Ford' },
  { q: -3, r:  1, name: 'Thornwall' },
  { q: -3, r:  2, name: 'Coldwater Bay' },
  { q: -3, r:  3, name: 'The Long Shore' },
  { q: -2, r:  3, name: 'The Sable Moor' },
  { q: -1, r:  3, name: "Crow's Reach" },
  { q:  0, r:  3, name: 'Northern Ridge' },
  { q:  1, r:  2, name: 'Coastal Flats' },
  { q:  2, r:  1, name: 'Saltmere' },
]
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: 10 tests PASS, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/hex-utils.ts __tests__/hex-utils.test.ts
git commit -m "feat: add hex coordinate utilities with 10 passing tests"
```

---

## Task 5: Seed Script + Demo Data

**Files:**
- Create: `supabase/seed.sql`
- Create: `lib/seed.ts`

- [ ] **Step 1: Write `supabase/seed.sql`**

```sql
-- Insert 37 territories (owner_id NULL = unclaimed)
-- Run this AFTER schema.sql
insert into territories (name, hex_q, hex_r) values
  ('The High Seat',    0,  0),
  ('Ironhold',         1,  0),
  ('Goldenport',       0,  1),
  ('Ashridge',        -1,  1),
  ('Mistveil',        -1,  0),
  ('Greyspire',        0, -1),
  ('Emberglass',       1, -1),
  ('The Deep Hollow',  2,  0),
  ('Stonegate',        2, -1),
  ('The Ember Shelf',  2, -2),
  ('The Iron Pass',    1, -2),
  ('The Amber Vale',   0, -2),
  ('Windfell',        -1, -1),
  ('The Pale Marsh',  -2,  0),
  ('The Rust Hills',  -2,  1),
  ('Copperfield',     -2,  2),
  ('The Still Water', -1,  2),
  ('Sunken Gate',      0,  2),
  ('Driftmark',        1,  1),
  ('Redmount',         3,  0),
  ('The Dark Helm',    3, -1),
  ('Wavecrest',        3, -2),
  ('Cinderfen',        3, -3),
  ('The Pale Crown',   2, -3),
  ('Sandwatch',        1, -3),
  ('The Raven''s Keep',0, -3),
  ('Frostmere',       -1, -2),
  ('Dusthaven',       -2, -1),
  ('The Black Ford',  -3,  0),
  ('Thornwall',       -3,  1),
  ('Coldwater Bay',   -3,  2),
  ('The Long Shore',  -3,  3),
  ('The Sable Moor',  -2,  3),
  ('Crow''s Reach',   -1,  3),
  ('Northern Ridge',   0,  3),
  ('Coastal Flats',    1,  2),
  ('Saltmere',         2,  1)
on conflict (hex_q, hex_r) do nothing;
```

- [ ] **Step 2: Write `lib/seed.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

// Load .env.local manually when running as a Node script
import { config } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOTS = [
  {
    username: 'CrimsonGuard',
    display_color: '#8b2020',
    email: 'bot1@conquest.local',
    hexes: [[1, 0], [2, -1], [1, 1]] as [number, number][],   // Ironhold, Stonegate, Driftmark
  },
  {
    username: 'AzureCrown',
    display_color: '#1a4a8b',
    email: 'bot2@conquest.local',
    hexes: [[-1, 1], [-2, 1], [-2, 2]] as [number, number][], // Ashridge, Rust Hills, Copperfield
  },
  {
    username: 'VerdantHold',
    display_color: '#1a6b2a',
    email: 'bot3@conquest.local',
    hexes: [[-1, 0], [-2, 0], [-1, -1]] as [number, number][],// Mistveil, Pale Marsh, Windfell
  },
  {
    username: 'ObsidianPact',
    display_color: '#6b1a8b',
    email: 'bot4@conquest.local',
    hexes: [[0, -1], [0, -2], [1, -2]] as [number, number][], // Greyspire, Amber Vale, Iron Pass
  },
]

async function seed() {
  console.log('Seeding bot profiles and territories...\n')

  for (const bot of BOTS) {
    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: bot.email,
      password: 'conquest-bot-2026',
      email_confirm: true,
    })
    if (authErr) {
      console.error(`  ✗ Auth error for ${bot.username}: ${authErr.message}`)
      continue
    }
    const userId = authData.user.id

    // Upsert profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      username: bot.username,
      display_color: bot.display_color,
    })
    if (profileErr) {
      console.error(`  ✗ Profile error for ${bot.username}: ${profileErr.message}`)
      continue
    }

    // Assign territories
    for (const [q, r] of bot.hexes) {
      const { error } = await supabase
        .from('territories')
        .update({ owner_id: userId })
        .eq('hex_q', q)
        .eq('hex_r', r)
      if (error) console.error(`  ✗ Territory (${q},${r}): ${error.message}`)
    }

    console.log(`  ✓ ${bot.username} — owns ${bot.hexes.length} territories`)
  }

  console.log('\nSeed complete.')
}

seed().catch(console.error)
```

- [ ] **Step 3: Run seed.sql in Supabase**

Supabase dashboard → SQL Editor → paste `supabase/seed.sql` → Run.

Expected: 37 rows inserted into `territories` with no errors.

- [ ] **Step 4: Run the bot seed script**

```bash
NEXT_PUBLIC_SUPABASE_URL="$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2-)" \
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2-)" \
npx tsx lib/seed.ts
```

Expected:
```
Seeding bot profiles and territories...

  ✓ CrimsonGuard — owns 3 territories
  ✓ AzureCrown — owns 3 territories
  ✓ VerdantHold — owns 3 territories
  ✓ ObsidianPact — owns 3 territories

Seed complete.
```

Verify in Supabase Table Editor: `profiles` has 4 rows, 12 territory rows have non-null `owner_id`, `territory_count` column shows 3 for each bot (trigger fired).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql lib/seed.ts
git commit -m "feat: add territory seed SQL and bot profile seed script"
```

---

## Task 6: Auth + Middleware

**Files:**
- Create: `app/auth/page.tsx`
- Create: `app/api/auth/callback/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write `app/auth/page.tsx`**

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
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm space-y-8 p-8 border border-neutral-800 rounded-lg">
        <div className="text-center">
          <h1 className="font-cinzel text-3xl font-bold text-[#c8a96e] tracking-widest">
            CONQUEST
          </h1>
          <p className="mt-2 text-sm text-neutral-500">Territory Chess</p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-neutral-300">
            Check your email for the sign-in link.
          </p>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleGoogle}
              className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-sm font-medium transition-colors"
            >
              Continue with Google
            </button>

            <div className="relative flex items-center">
              <div className="flex-1 border-t border-neutral-800" />
              <span className="px-3 text-xs text-neutral-600">or</span>
              <div className="flex-1 border-t border-neutral-800" />
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

- [ ] **Step 2: Write `app/api/auth/callback/route.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

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

  return NextResponse.redirect(new URL('/', request.url))
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
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuth = request.nextUrl.pathname.startsWith('/auth')
  const isApi  = request.nextUrl.pathname.startsWith('/api')

  if (!user && !isAuth && !isApi) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Configure Supabase redirect URLs**

Supabase dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs (add both):
  - `http://localhost:3000/api/auth/callback`
  - `https://YOUR_VERCEL_DOMAIN/api/auth/callback` (fill in after deploy)

For Google OAuth: Authentication → Providers → Google → enable → paste Client ID + Secret from Google Cloud Console.

- [ ] **Step 5: Test auth**

```bash
npm run dev
```

1. Visit http://localhost:3000 → should redirect to `/auth`
2. Enter your email → "Check your email" message appears
3. Click the link in the email → redirected to `http://localhost:3000/` (blank page for now)
4. Visiting `/auth` while signed in should pass through (no redirect loop)

- [ ] **Step 6: Commit**

```bash
git add app/auth/page.tsx app/api/auth/callback/route.ts middleware.ts
git commit -m "feat: add auth page (magic link + Google), OAuth callback, and auth middleware"
```

---

## Task 7: Root Layout + Global Styles

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Write `app/globals.css`**

Replace the full file:

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #0a0a0a;
  color: #e5e5e5;
  font-family: 'Inter', system-ui, sans-serif;
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-200 antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
      },
      colors: {
        accent:  '#c8a96e',
        danger:  '#8b2020',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css tailwind.config.ts
git commit -m "feat: add dark war aesthetic root layout with Cinzel font"
```

---

## Task 8: Hex Map Components

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

function hexFill(t: Territory, uid: string | null): string {
  if (!t.owner_id) return '#2a2a2a'
  if (t.owner_id === uid) return '#1a3a1a'
  return t.owner?.display_color ?? '#444444'
}

function hexStroke(t: Territory, isContested: boolean, uid: string | null): string {
  if (isContested) return '#8b2020'
  if (t.owner_id === uid) return '#c8a96e'
  return '#555555'
}

export default function TerritoryHex({ territory, isContested, currentUserId, onClick }: Props) {
  const fill   = hexFill(territory, currentUserId)
  const stroke = hexStroke(territory, isContested, currentUserId)
  const s      = -territory.hex_q - territory.hex_r

  // Trim long names to fit inside hex
  const label = territory.name.replace(/^The /, '').slice(0, 11)

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
      }}
    >
      {/* Territory name */}
      <Text
        style={{
          fontSize: '0.22rem',
          fill: territory.owner_id === currentUserId ? '#c8a96e' : '#cccccc',
          fontFamily: 'Cinzel, serif',
          pointerEvents: 'none',
        }}
      >
        {label}
      </Text>

      {/* Owner username */}
      {territory.owner && (
        <Text
          y={0.42}
          style={{ fontSize: '0.17rem', fill: '#999999', pointerEvents: 'none' }}
        >
          {territory.owner.username.slice(0, 10)}
        </Text>
      )}

      {/* Contested icon */}
      {isContested && (
        <Text
          y={-0.4}
          style={{ fontSize: '0.28rem', pointerEvents: 'none' }}
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

import { useState, useEffect } from 'react'
import { HexGrid, Layout } from 'react-hex-grid'
import { createClient } from '@/lib/supabase'
import type { Territory, Challenge, Profile } from '@/lib/types'
import TerritoryHex from './TerritoryHex'

interface Props {
  initialTerritories: Territory[]
  currentUser: Profile | null
}

export default function HexMap({ initialTerritories, currentUser }: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [contestedIds, setContestedIds] = useState<Set<number>>(new Set())
  const supabase = createClient()

  // ── Realtime: territory ownership changes ──────────────────
  useEffect(() => {
    const channel = supabase
      .channel('hex-map')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'territories' },
        async (payload) => {
          const { data } = await supabase
            .from('territories')
            .select('*, owner:profiles(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setTerritories(prev => prev.map(t => t.id === data.id ? data : t))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenges' },
        async () => {
          const { data } = await supabase
            .from('challenges')
            .select('territory_id')
            .in('status', ['pending', 'active'])
          if (data) setContestedIds(new Set(data.map(c => c.territory_id)))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // ── Initial contested set ──────────────────────────────────
  useEffect(() => {
    supabase
      .from('challenges')
      .select('territory_id')
      .in('status', ['pending', 'active'])
      .then(({ data }) => {
        if (data) setContestedIds(new Set(data.map(c => c.territory_id)))
      })
  }, [supabase])

  // Placeholder click handler — Plans 02 & 03 wire this up
  function handleHexClick(territory: Territory) {
    if (!currentUser) return
    console.log('Clicked:', territory.name, '| owner:', territory.owner?.username ?? 'unclaimed')
  }

  return (
    <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <style>{`
        @keyframes pulse-border {
          0%, 100% { stroke-opacity: 1; }
          50%       { stroke-opacity: 0.3; }
        }
        .contested { animation: pulse-border 1.5s ease-in-out infinite; }
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
              isContested={contestedIds.has(t.id)}
              currentUserId={currentUser?.id ?? null}
              onClick={handleHexClick}
            />
          ))}
        </Layout>
      </HexGrid>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/map/TerritoryHex.tsx components/map/HexMap.tsx
git commit -m "feat: add TerritoryHex and HexMap with Supabase Realtime subscription"
```

---

## Task 9: Sidebar + Main Page

**Files:**
- Create: `components/map/MapSidebar.tsx`
- Create: `components/ui/ProModal.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Write `components/map/MapSidebar.tsx`**

```typescript
import type { Profile } from '@/lib/types'

interface Props {
  currentUser: Profile | null
  leaderboard: Profile[]
}

export default function MapSidebar({ currentUser, leaderboard }: Props) {
  const myRank = leaderboard.findIndex(p => p.id === currentUser?.id) + 1

  return (
    <aside className="w-[280px] border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
      {/* Player card */}
      {currentUser && (
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: currentUser.display_color }}
            />
            <span className="font-cinzel text-sm font-semibold text-[#c8a96e] truncate">
              {currentUser.username}
            </span>
          </div>
          <div className="text-xs text-neutral-400 space-y-0.5 ml-5">
            <div>{currentUser.territory_count} territories</div>
            {myRank > 0 && <div>Rank #{myRank}</div>}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Leaderboard
        </h3>
        <ol className="space-y-1">
          {leaderboard.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded ${
                p.id === currentUser?.id ? 'bg-neutral-800' : ''
              }`}
            >
              <span className="text-neutral-600 w-4 text-right shrink-0">{i + 1}</span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.display_color }}
              />
              <span className="flex-1 text-neutral-300 truncate">{p.username}</span>
              <span className="text-[#c8a96e] font-medium tabular-nums">{p.territory_count}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Write `components/ui/ProModal.tsx`**

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

- [ ] **Step 3: Write `app/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerClient_ } from '@/lib/supabase'
import HexMap from '@/components/map/HexMap'
import MapSidebar from '@/components/map/MapSidebar'
import ProModal from '@/components/ui/ProModal'
import type { Profile } from '@/lib/types'

const DISPLAY_COLORS = ['#4a90d9', '#d94a4a', '#4ad94a', '#d9a84a', '#9a4ad9', '#d94a90']

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
    const username = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '') || `player${user.id.slice(0, 5)}`
    const display_color = DISPLAY_COLORS[Math.floor(Math.random() * DISPLAY_COLORS.length)]
    const { data: created } = await supabase
      .from('profiles')
      .insert({ id: user.id, username, display_color })
      .select('*')
      .single()
    profile = created
  }

  // Fetch all territories with owner profile joined
  const { data: territories } = await supabase
    .from('territories')
    .select('*, owner:profiles(*)')
    .order('id')

  // Leaderboard: top 10 by territory count
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, username, display_color, territory_count, created_at')
    .order('territory_count', { ascending: false })
    .limit(10)

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Nav */}
      <nav className="h-12 flex items-center justify-between px-4 border-b border-neutral-800 shrink-0">
        <h1 className="font-cinzel text-lg font-bold text-[#c8a96e] tracking-widest">
          CONQUEST
        </h1>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-xs text-neutral-400 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: profile.display_color }}
              />
              {profile.username}
            </span>
          )}
          <ProModal />
        </div>
      </nav>

      {/* Body: map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <HexMap
          initialTerritories={territories ?? []}
          currentUser={profile as Profile | null}
        />
        <MapSidebar
          currentUser={profile as Profile | null}
          leaderboard={(leaderboard ?? []) as Profile[]}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/map/MapSidebar.tsx components/ui/ProModal.tsx app/page.tsx
git commit -m "feat: add main map page, sidebar leaderboard, and Pro modal stub"
```

---

## Task 10: Smoke Test + Verify

- [ ] **Step 1: Run the app**

```bash
npm run dev
```

- [ ] **Step 2: Verify the map page**

1. Visit http://localhost:3000 → redirects to `/auth` if not signed in
2. Sign in via magic link
3. You land on `/` — verify:
   - Dark nav with "CONQUEST" in Cinzel gold font
   - Your username in the nav (auto-created from email)
   - "Upgrade to Pro" button → opens modal
   - 37 hexes render on the grid
   - 12 hexes owned by bots show in their colors (red, blue, green, purple)
   - Unclaimed hexes are dark gray
   - Owner usernames appear on owned hexes
   - Sidebar shows leaderboard with 4 bots ranked by territory count

- [ ] **Step 3: Verify realtime**

Open two browser windows on http://localhost:3000.

In Supabase SQL Editor, run:
```sql
update territories set owner_id = null where hex_q = 1 and hex_r = 0;
```

Both browser windows should update Ironhold to gray without a page refresh.

Reset it:
```sql
update territories
set owner_id = (select id from profiles where username = 'CrimsonGuard')
where hex_q = 1 and hex_r = 0;
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: 10 tests PASS.

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, successful build. Fix any errors before proceeding.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: all Plan 01 smoke tests passing, build clean"
```

---

## Self-Review: Spec Coverage

| Spec Requirement | Task |
|---|---|
| Next.js 14 App Router | Task 1 |
| Supabase auth (Google + magic link) | Task 6 |
| 37-hex map, 3-ring axial layout | Task 4 (TERRITORIES), Task 8 |
| Hexes colored by owner | Task 8 (TerritoryHex fill) |
| Owner username on hex | Task 8 (TerritoryHex Text) |
| Gray unclaimed hexes | Task 8 (hexFill `#2a2a2a`) |
| ⚔️ icon on contested hexes | Task 8 (TerritoryHex isContested) |
| Live map updates via Realtime | Task 8 (HexMap channel) |
| Leaderboard top 10 | Task 9 (MapSidebar) |
| Player card: username, color, count, rank | Task 9 (MapSidebar) |
| "Upgrade to Pro" button + modal | Task 9 (ProModal) |
| Profile auto-created on first sign-in | Task 9 (page.tsx upsert) |
| territory_count trigger | Task 2 (schema.sql trigger) |
| 4 demo bot profiles seeded | Task 5 (seed.ts) |
| Dark war aesthetic (#0a0a0a, #c8a96e) | Tasks 7, 8, 9 |
| Cinzel font for headings | Tasks 7, 8, 9 |

**Not in this plan (covered in Plans 02–04):**
- Claim flow (Stockfish game) → Plan 02
- Challenge flow (human vs human) → Plan 03
- Pending challenges in sidebar → Plan 03
- Notification bell → Plan 03
- AI Coach → Plan 04
- Vercel deploy → Plan 04
