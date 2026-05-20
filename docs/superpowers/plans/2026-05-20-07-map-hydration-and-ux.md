# Map Hydration Fix + Country Name UX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the React hydration error crashing the map, and make the map actually usable: claimable territories must visually stand out (gold borders), and any country tap must show its name so players can navigate the world.

**Root causes identified:**
- `react-svg-worldmap` with `size="responsive"` measures the DOM container for dimensions. The server has no DOM → renders 1300×900. The browser measures the real container → renders 640×480. React sees the mismatch and throws a hydration error, breaking styleFunction application (all countries render with default styles = uniform beige).
- Claimable territories have only a subtle gold border difference vs neutral, which is invisible when styling is broken.
- `handleClick` in `ConquestMap` returns early for any country not in `stateByCode` as claimable/attackable/player — so tapping neutral or bot territories (which covers most of the map for an established player) silently does nothing, making country identification impossible without hover tooltips (which don't work on mobile).

**Architecture:** Three independent fixes in three files. No schema changes. No new components.

**Tech Stack:** Next.js 14 dynamic import, react-svg-worldmap, CSS.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `components/map/ConquestMap.tsx` | **Modify** | Replace static `import WorldMap` with `dynamic(() => import('react-svg-worldmap'), { ssr: false })` — eliminates hydration mismatch; also make claimable fill brighter gold (#e8c97a) and attackable fill deeper red (#3d1212) for visibility |
| `components/map/ConquestMap.tsx` | **Modify** | Remove the `handleClick` early return guard — allow clicking any country to surface `onCountryClick`, passing status as `'neutral'` for unactionable countries |
| `components/map/TerritorySheet.tsx` | **Modify** | Handle `feature.status === 'neutral'` — show country name + "Out of reach" label instead of crashing or showing a broken CTA |

---

## Task 1: Dynamic import — kill the hydration error

**File:** `components/map/ConquestMap.tsx`

### Context
`react-svg-worldmap` is a browser-only library. Importing it statically causes it to run during SSR where it can't measure the DOM, producing dimensions that differ from the client. Using `next/dynamic` with `ssr: false` means the component only renders on the browser, eliminating the mismatch entirely.

The `loading` prop shows the dark ocean background while JS loads — no layout shift.

- [ ] **Step 1: Replace static import with dynamic**

In `components/map/ConquestMap.tsx`, replace line 4:
```tsx
import WorldMap from 'react-svg-worldmap'
```
with:
```tsx
import dynamic from 'next/dynamic'
// Loaded client-only to avoid SSR dimension mismatch (library measures DOM)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WorldMap = dynamic(() => import('react-svg-worldmap'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: '#1a2e45' }} />,
}) as any
```

- [ ] **Step 2: Brighten claimable and attackable fill colors**

Still in `components/map/ConquestMap.tsx`, in `styleFunction`, update the two cases:

Claimable — change `fill: '#f0e8d0'` to `fill: '#e8d48a'` (more saturated gold, easier to distinguish from neutral beige):
```tsx
      case 'claimable':
        return {
          fill: '#e8d48a',
          stroke: '#b89758',
          strokeWidth: 2,
          cursor: 'pointer',
          fillOpacity: 1,
        }
```

Attackable — change `fill: '#2e1010'` to `fill: '#5c1a1a'` (slightly lighter so it's visible against the ocean):
```tsx
      case 'attackable':
        return {
          fill: '#5c1a1a',
          stroke: '#e84030',
          strokeWidth: 2,
          cursor: 'pointer',
          fillOpacity: 1,
        }
```

- [ ] **Step 3: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/projects/conquest" && git add components/map/ConquestMap.tsx && git commit -m "fix: dynamic import WorldMap (no SSR) to kill hydration error; brighter claimable/attackable fills"
```

---

## Task 2: Show country name on any tap

**File:** `components/map/ConquestMap.tsx`

### Context
`handleClick` currently bails out early with `return` if the country is not `claimable`, `attackable`, or `player`. On mobile there are no hover tooltips — so tapping a neutral country or an unreachable bot territory produces no feedback. The player can't tell what they're looking at.

Fix: always call `onCountryClick` for any country that exists in `ALPHA2_TO_NAME` (i.e. any valid alpha-2 code). Pass `status: 'neutral'` for unactionable ones. `TerritorySheet` will render a harmless "Out of reach" state for those.

For countries not in `stateByCode` at all (i.e. truly unknown codes the library might pass), keep the early return.

- [ ] **Step 1: Update `handleClick` in `ConquestMap.tsx`**

Replace the entire `handleClick` function:

```tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(context: any) {
    if (!onCountryClick) return
    const code = context.countryCode?.toLowerCase()
    if (!code || !ALPHA2_TO_NAME[code]) return  // unknown code — ignore

    const state = stateByCode[code]
    const status = state?.status ?? 'neutral'

    // Only navigate for actionable territories
    if (status !== 'claimable' && status !== 'attackable' && status !== 'player') {
      // Still surface the name for info display — TerritorySheet shows "Out of reach"
      onCountryClick({
        id: code,
        name: ALPHA2_TO_NAME[code],
        path: '',
        center: [0, 0],
        status: 'neutral',
        owner: state?.ownerUsername,
        value: 1,
      })
      return
    }

    const feature: CountryFeature = {
      id: code,
      name: ALPHA2_TO_NAME[code] ?? context.countryName ?? code,
      path: '' as string,
      center: [0, 0],
      status: state.status === 'player' ? 'owned'
            : state.status === 'attackable' ? 'enemy'
            : 'neutral',
      owner: state.ownerUsername,
      value: 1,
    }
    onCountryClick(feature)
  }
```

- [ ] **Step 2: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/projects/conquest" && git add components/map/ConquestMap.tsx && git commit -m "feat: show country name sheet on any tap — not just claimable/attackable territories"
```

---

## Task 3: Handle neutral status in TerritorySheet

**File:** `components/map/TerritorySheet.tsx`

### Context
`TerritorySheet` currently receives `feature.status` as `'owned' | 'enemy' | 'neutral'`. With Task 2, bot-owned unreachable territories and out-of-range neutral territories will now open the sheet with `status: 'neutral'`. We need a graceful display for those — show the country name, show the owner (if bot), and say "Out of reach — expand your empire first."

Read the current `TerritorySheet.tsx` first to understand its exact structure, then add the neutral branch.

- [ ] **Step 1: Read `components/map/TerritorySheet.tsx`**

Read the file to understand the current JSX structure.

- [ ] **Step 2: Add neutral/out-of-reach display**

After reading, locate the section that renders the CTA buttons (Claim / Attack / Defend). Add a branch for `feature.status === 'neutral'`:

The neutral display should show:
- Country name (large, serif)
- Owner name if `feature.owner` is set (e.g. "Held by CrimsonGuard")
- A muted label: "Out of reach — expand your borders to challenge this territory"
- A close button (same style as existing close button)

No action buttons — no Claim, no Attack, no Defend.

- [ ] **Step 3: TypeScript check**

```bash
cd "C:/projects/conquest" && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/projects/conquest" && git add components/map/TerritorySheet.tsx && git commit -m "feat: TerritorySheet shows country name for out-of-reach neutral/bot territories"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| Hydration error eliminated | Task 1 — dynamic import with ssr:false |
| Claimable territories visually distinct | Task 1 — brighter gold fill (#e8d48a) |
| Any country tap shows its name | Task 2 — handleClick always fires for valid alpha-2 |
| No crash on neutral tap | Task 3 — TerritorySheet handles status=neutral |
| Player territory visible after claim | Unblocked once hydration fixed — styling now applies |

**Placeholder scan:** Task 3 Step 2 says "add a branch" — complete code is intentionally deferred to after reading the file (the file content is unknown at plan-write time, so Step 1 reads it first). The agent must write complete code after reading — not skip.

**Type consistency:** `CountryFeature.status` is `'owned' | 'enemy' | 'neutral'` per `lib/types.ts` — passing `'neutral'` is already a valid value. ✓
