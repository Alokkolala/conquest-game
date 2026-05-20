# Map Fix & Full Functionality

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four bugs that make the map non-functional after onboarding: (1) new users can't see or click claimable countries, (2) claiming/challenging neutral territories silently fails because they have no DB row, (3) the map is cramped in a 340px container with a large empty gap below, (4) the world count shows wrong (14 instead of 144).

**Architecture:** Four independent fixes across `lib/game-state.ts`, `app/api/claim/route.ts`, `app/api/challenge/route.ts`, `app/page.tsx`, and `components/map/ConquestMap.tsx`. No schema changes needed. No new components. Each task produces a self-contained working fix.

**Root causes:**
- `buildGameState`: `allKnown` is `playerSet ∪ botSet ∪ adjacentToPlayer`. For a new user all three sets are small (0 + 20 + 0), so only 20 bot countries are ever iterated. All 124 neutral countries never appear in `stateByCode`, so `handleClick` hits `!state → return` for every one.
- `/api/claim`: does `UPDATE … WHERE name=? AND owner_id IS NULL`. For neutral countries (no row in `territories`), 0 rows match — no error, silent no-op.
- `/api/challenge`: does `.eq('name', …).single()` — throws 404 for any country without a DB row. `KingdomMapClient` ignores non-`challenge_id` responses silently.
- `app/page.tsx` map container: `height: 340` fixed — leaves ~460px empty parchment gap below map.

**Tech Stack:** Next.js 14 App Router, Supabase (service client for privileged writes), react-svg-worldmap, TypeScript.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `lib/game-state.ts` | **Modify** | `buildGameState` iterates `Object.keys(ALPHA2_TO_NAME)` instead of `allKnown` |
| `app/api/claim/route.ts` | **Modify** | `maybeSingle()` check — INSERT neutral row if missing, UPDATE if unclaimed |
| `app/api/challenge/route.ts` | **Modify** | `maybeSingle()` check — INSERT neutral row before creating challenge if missing |
| `app/page.tsx` | **Modify** | Map container `height: 340` → `bottom: 0` (full screen); fix `totalTerritories` count |
| `components/map/ConquestMap.tsx` | **Modify** | Wrapper div gets `height: '100%'` so ocean fills full container |

---

## Task 1: Fix `buildGameState` — iterate all 144 countries

**File:** `lib/game-state.ts`

### Context
`buildGameState` currently builds `allKnown = new Set([...playerSet, ...botSet, ...adjacentToPlayer])` then maps over it. For a fresh user (playerCodes=[], isNewUser=true), that set contains only the 20 bot countries. Neutral countries are never included so they never reach the `isClaimable` branch.

Fix: replace `Array.from(allKnown).map(...)` with `Object.keys(ALPHA2_TO_NAME).map(...)` so all 144 countries are always evaluated. `ALPHA2_TO_NAME` is already imported.

- [ ] **Step 1: Replace the iteration in `buildGameState`**

In `lib/game-state.ts`, replace:

```typescript
  // All known codes: player + bot + neighbors
  const allKnown = new Set([...playerSet, ...botSet, ...adjacentToPlayer])

  return Array.from(allKnown).map(code => {
```

with:

```typescript
  return Object.keys(ALPHA2_TO_NAME).map(code => {
```

The `allKnown` Set variable is no longer needed — delete that line entirely.

- [ ] **Step 2: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero errors (or only pre-existing errors).

- [ ] **Step 3: Verify the fix manually**

In a Node REPL or quick test, confirm `buildGameState([], buildBotOwnerMap(), true)` returns ~144 items with most having `status: 'claimable'`, and 20 having `status: 'bot'`.

```bash
cd "C:/projects/conquest" && node -e "
const { buildGameState, buildBotOwnerMap } = require('./lib/game-state.ts')
" 2>&1 | head -5
```

(This will fail with a TypeScript import — just read the code logically. The fix is a one-line change that clearly makes the loop iterate all 144 keys instead of 20.)

- [ ] **Step 4: Commit**

```bash
cd "C:/projects/conquest" && git add lib/game-state.ts && git commit -m "fix: buildGameState iterates all 144 countries — new users can see claimable territories"
```

---

## Task 2: Fix `/api/claim` — auto-insert missing neutral territory row

**File:** `app/api/claim/route.ts`

### Context
The territories table only has 20 rows (the 4 bot clusters × 5 countries). When the user picks a neutral country in onboarding, the UPDATE hits 0 rows and returns `{ ok: true }` with no territory ever assigned. Fix: check for the row first; INSERT if missing, UPDATE if unclaimed, reject if already owned.

The `region_code` column exists and is required — use `'world'` as a safe default. `hex_q` and `hex_r` are legacy nullable fields; omit them.

- [ ] **Step 1: Replace the claim route body**

Replace the entire content of `app/api/claim/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { territory_name } = await req.json() as { territory_name: string }
  if (!territory_name) return NextResponse.json({ error: 'territory_name required' }, { status: 400 })

  const service = createServiceClient()

  // Check whether a row already exists for this territory
  const { data: existing } = await service
    .from('territories')
    .select('id, owner_id')
    .eq('name', territory_name)
    .maybeSingle()

  if (!existing) {
    // Neutral country — no row yet. Create one and assign immediately.
    const { error } = await service
      .from('territories')
      .insert({ name: territory_name, owner_id: user.id, region_code: 'world' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (existing.owner_id === null) {
    // Row exists but unclaimed — update
    const { error } = await service
      .from('territories')
      .update({ owner_id: user.id })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Already owned (bot or other player)
    return NextResponse.json({ error: 'Territory already owned' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/projects/conquest" && git add app/api/claim/route.ts && git commit -m "fix: claim route inserts neutral territory row when missing instead of silent no-op"
```

---

## Task 3: Fix `/api/challenge` — auto-insert missing neutral territory row

**File:** `app/api/challenge/route.ts`

### Context
`/api/challenge` does `.eq('name', territory_name).single()` which throws a PostgREST error (404) when no row exists. `KingdomMapClient.handleClaim` calls the API, gets back `{ error: 'Territory not found' }` (no `challenge_id`), and silently does nothing. Fix: use `maybeSingle()` and INSERT the territory row if missing before creating the challenge.

- [ ] **Step 1: Replace territory lookup with maybeSingle + auto-insert**

In `app/api/challenge/route.ts`, replace:

```typescript
  const { data: territory } = await service
    .from('territories')
    .select('id')
    .eq('name', territory_name)
    .single()
  if (!territory) return NextResponse.json({ error: 'Territory not found' }, { status: 404 })
```

with:

```typescript
  // Find existing row, or create one for neutral countries
  let { data: territory } = await service
    .from('territories')
    .select('id')
    .eq('name', territory_name)
    .maybeSingle()

  if (!territory) {
    const { data: created, error: insertErr } = await service
      .from('territories')
      .insert({ name: territory_name, owner_id: null, region_code: 'world' })
      .select('id')
      .single()
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    territory = created
  }
```

- [ ] **Step 2: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/projects/conquest" && git add app/api/challenge/route.ts && git commit -m "fix: challenge route auto-inserts neutral territory row to unblock claim/attack flow"
```

---

## Task 4: Fix map layout — full-screen container and correct territory count

**Files:**
- `app/page.tsx` — map container height, totalTerritories fix
- `components/map/ConquestMap.tsx` — wrapper div height

### Context
The map container in `app/page.tsx` has `height: 340` which leaves a ~460px blank parchment gap between the map and the drawer on a typical mobile screen. The fix: change the container to `position: absolute, inset: 0` so it fills the entire viewport. The KingdomDrawer is already `position: absolute, bottom: 76` so it naturally overlays the map.

`ConquestMap` wrapper div has `width: 100%` but no height, causing the ocean-blue background to collapse. Add `height: '100%'` so the ocean fills the full container.

`totalTerritories` currently shows `Object.keys(DEFAULT_COUNTRY_STATUS).length` (= 14, a static mock). Replace with `144` (the real number of countries in ALPHA2_TO_NAME).

- [ ] **Step 1: Expand map container to full screen in `app/page.tsx`**

Replace:
```tsx
      {/* Map — fills upper portion */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340, background: 'var(--bg)' }}>
        <KingdomMapClient
```

with:
```tsx
      {/* Map — fills entire viewport, drawer overlays from bottom */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <KingdomMapClient
```

- [ ] **Step 2: Fix totalTerritories count**

Replace:
```tsx
        totalTerritories={Object.keys(DEFAULT_COUNTRY_STATUS).length}
```
with:
```tsx
        totalTerritories={144}
```

- [ ] **Step 3: Add `height: '100%'` to ConquestMap wrapper div**

In `components/map/ConquestMap.tsx`, replace:
```tsx
    <div ref={wrapperRef} style={{ width: '100%', background: '#1a2e45', overflow: 'hidden' }}>
```
with:
```tsx
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', background: '#1a2e45', overflow: 'hidden' }}>
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
cd "C:/projects/conquest" && git add app/page.tsx components/map/ConquestMap.tsx && git commit -m "fix: full-screen map layout — remove 340px cap, ocean fills viewport, fix territory count"
```

---

## Task 5: Improve map visual — switch to responsive sizing for full world view

**File:** `components/map/ConquestMap.tsx`

### Context
With `size="xxl"`, the SVG renders at 800px wide. In a 390px mobile container, the right half of the world (Asia, Pacific) is always clipped and invisible at `scale=1`. `react-svg-worldmap` with `size="responsive"` renders at `width="100%"`, fitting exactly in the container so the full world map is always visible. Users zoom in with pinch/scroll to see country detail.

The MapPanZoom clamping works correctly when content width = container width (which `responsive` achieves at scale=1).

- [ ] **Step 1: Change `size` default and prop usage**

In `components/map/ConquestMap.tsx`, the `size` prop currently defaults to `'xxl'`. The `app/page.tsx` passes `size="xxl"`. We want the main map to use `"responsive"`.

Change the default:
```tsx
  size = 'responsive' as 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'responsive',
```

And update the `WorldMap` render — change:
```tsx
        size={size}
```

No change needed there; it already uses the prop. Just confirm it's `responsive` by default.

In `app/page.tsx`, remove the explicit `size="xxl"` prop so the default kicks in:

Replace:
```tsx
          size="xxl"
          onCountryClick={setSelected}
```
with:
```tsx
          onCountryClick={setSelected}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/projects/conquest" && git add components/map/ConquestMap.tsx app/page.tsx && git commit -m "feat: switch main map to responsive sizing — full world visible without horizontal clipping"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| New user can see claimable countries (gold) | Task 1 — buildGameState iterates all 144 |
| Clicking a claimable country opens TerritorySheet | Task 1 — stateByCode now has all countries |
| Claim via onboarding actually saves to DB | Task 2 — /api/claim inserts missing row |
| Claim/attack from main map works | Task 3 — /api/challenge inserts missing row |
| Map fills screen (no empty gap) | Task 4 — container uses inset:0 |
| Map shows full world (no horizontal clipping) | Task 5 — size=responsive |
| Holdings count shows correct denominator | Task 4 — totalTerritories=144 |

**Placeholder scan:** None found. All code changes are complete and explicit.

**Type consistency:**
- `maybeSingle()` returns `data: T | null` — both API routes check `if (!territory)` / `if (!existing)` before use. ✓
- `size` prop type includes `'responsive'` in the union — already in the existing type. ✓
- `inset: 0` is valid CSS shorthand supported by React inline styles. ✓
