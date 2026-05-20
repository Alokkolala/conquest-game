# Onboarding Country Picker + Map Quality & Animations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text region picker in onboarding with a vivid interactive world map where new players tap a free country to claim it; add CSS pulse animations for claimable/attackable countries on the main map; and improve overall map visual quality (ocean color, territory colors, borders).

**Architecture:** Four independent tasks: (1) new onboarding country picker component + wiring, (2) map color/quality overhaul in `ConquestMap.tsx` and `game-state.ts`, (3) CSS keyframe animations applied post-render via DOM injection in `ConquestMap.tsx`, (4) first-visit welcome banner in `KingdomMapClient.tsx`. All changes are additive—no database schema changes needed.

**Tech Stack:** Next.js 14 App Router, react-svg-worldmap (SVG, ISO alpha-2 codes), CSS custom properties, Supabase client-side auth, `/api/claim` route.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `components/onboarding/CountryPickerMap.tsx` | **Create** | Interactive picker map: bot territories colored, free territories gold/clickable, selected territory highlighted |
| `app/onboarding/page.tsx` | **Modify** | Replace `StepStartingRegion` with `StepCountryPicker`; add `countryCode`/`countryName` state; `handleCreate` calls `/api/claim` then navigates with `?firstVisit=1` |
| `components/map/ConquestMap.tsx` | **Modify** | Dark ocean background, richer territory colors, CSS animation injection via `useEffect` + DOM ref |
| `lib/game-state.ts` | **Modify** | More vivid bot cluster colors |
| `app/globals.css` | **Modify** | Add `@keyframes cq-claimable-pulse` and `cq-attackable-pulse` |
| `components/map/KingdomMapClient.tsx` | **Modify** | Read `?firstVisit=1` search param; show welcome banner for new players |

---

## Task 1: Interactive Country Picker Map Component

**Files:**
- Create: `components/onboarding/CountryPickerMap.tsx`

### Context
The onboarding step 4 currently shows a static text list of "Starting Regions". We replace it with an interactive world map. During onboarding the user has no account yet, so we derive territory availability purely from `buildBotOwnerMap()` (no DB call needed). Bot countries get their cluster colors (not clickable). All other 144 countries are claimable (gold, pointer cursor). Clicking one fires `onSelect(code, name)`.

Note: `react-svg-worldmap`'s `data` prop only receives countries you explicitly list; unlisted countries render with the library default. To make ALL 144 countries show as gold by default, we pass all 144 codes in `mapData`.

- [ ] **Step 1: Create the component file**

```tsx
// components/onboarding/CountryPickerMap.tsx
'use client'

import { useMemo } from 'react'
import WorldMap from 'react-svg-worldmap'
import { buildBotOwnerMap, buildBotColorMap } from '@/lib/game-state'
import { ALPHA2_TO_NAME } from '@/lib/country-codes'

interface Props {
  selectedCode: string | null
  onSelect: (code: string, name: string) => void
}

export default function CountryPickerMap({ selectedCode, onSelect }: Props) {
  const botOwnerMap = useMemo(() => buildBotOwnerMap(), [])
  const botColorMap = useMemo(() => buildBotColorMap(), [])

  // All 144 known countries: bot=2, selected=5, claimable=3
  const mapData = useMemo(() =>
    Object.keys(ALPHA2_TO_NAME).map(code => ({
      country: code,
      value: botOwnerMap[code] ? 2 : code === selectedCode ? 5 : 3,
    })),
    [botOwnerMap, selectedCode]
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function styleFunction(context: any) {
    const code = (context.countryCode ?? '').toLowerCase()
    const value = context.countryValue

    if (value === 5) {
      // Selected territory — bright gold fill
      return { fill: '#c9a84c', stroke: '#7a5c1e', strokeWidth: 2.5, cursor: 'pointer', fillOpacity: 1 }
    }
    if (value === 2) {
      // Bot territory — cluster color, not clickable
      return { fill: botColorMap[code] ?? '#3a2a2a', stroke: '#111', strokeWidth: 0.7, cursor: 'default', fillOpacity: 1 }
    }
    // Claimable (value=3) — gold-tinted cream
    return { fill: '#f0e8d0', stroke: '#b89758', strokeWidth: 1, cursor: 'pointer', fillOpacity: 1 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(context: any) {
    const code = (context.countryCode ?? '').toLowerCase()
    if (!code) return
    if (botOwnerMap[code]) return // enemy territory, ignore click
    const name = ALPHA2_TO_NAME[code]
    if (!name) return
    onSelect(code, name)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tooltipText(context: any) {
    const code = (context.countryCode ?? '').toLowerCase()
    const name = ALPHA2_TO_NAME[code] ?? context.countryName ?? ''
    if (botOwnerMap[code]) return `${name} — Enemy territory`
    return `${name} — Tap to claim`
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <WorldMap
        color="#b89758"
        backgroundColor="#1a2e45"
        size="responsive"
        data={mapData as any}
        styleFunction={styleFunction}
        onClickFunction={handleClick}
        tooltipTextFunction={tooltipText}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the file saved — no TypeScript errors expected at this point**

```bash
cd C:\projects\conquest && npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: zero errors, or only pre-existing errors unrelated to this file.

---

## Task 2: Wire Country Picker Into Onboarding Page

**Files:**
- Modify: `app/onboarding/page.tsx`

### Changes needed
1. Add `countryCode` (`string | null`) and `countryName` (`string`) to component state.
2. Replace `region` / `StepStartingRegion` with `countryCode` / `StepCountryPicker`.
3. Add `StepCountryPicker` component inside the file.
4. Update `handleCreate()` to call `/api/claim` with the selected country name after account creation, then navigate to `/?firstVisit=1`.
5. Remove `STARTING_REGIONS` constant (no longer needed).
6. Update the `StepDots total` from 6→6 (count stays the same; steps are still 0-5).

- [ ] **Step 1: Add imports and state — modify the top of `OnboardingPage`**

In `app/onboarding/page.tsx`, replace:
```tsx
import { useState } from 'react'
```
with:
```tsx
import { useState } from 'react'
import CountryPickerMap from '@/components/onboarding/CountryPickerMap'
```

- [ ] **Step 2: Remove `STARTING_REGIONS` constant and add state**

Remove the `STARTING_REGIONS` array entirely (lines 18-24 in current file).

Change the state block inside `OnboardingPage` from:
```tsx
  const [region, setRegion]           = useState<number | null>(null)
```
to:
```tsx
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [countryName, setCountryName] = useState<string>('')
```

- [ ] **Step 3: Update `handleCreate` to claim territory and navigate with firstVisit flag**

Replace the last 3 lines of `handleCreate()`:
```tsx
    router.push('/')
```
with:
```tsx
    // 3. Claim starting territory if the user selected one
    if (countryCode && countryName) {
      try {
        await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ territory_name: countryName }),
        })
      } catch {
        // Non-fatal — user can claim from the map later
      }
    }

    router.push('/?firstVisit=1')
```

- [ ] **Step 4: Replace step 4 in the `steps` array**

Change:
```tsx
    <StepStartingRegion key={4} selected={region} onSelect={setRegion} onNext={() => setStep(5)} />,
```
to:
```tsx
    <StepCountryPicker key={4} selectedCode={countryCode} selectedName={countryName}
      onSelect={(code, name) => { setCountryCode(code); setCountryName(name) }}
      onNext={() => setStep(5)} />,
```

- [ ] **Step 5: Delete `StepStartingRegion` function and add `StepCountryPicker` in its place**

Delete the entire `StepStartingRegion` function (search for `function StepStartingRegion`).

Add this new function in its place (before `StepReady`):

```tsx
/* ─── Step 4: Country Picker ──────────────────────── */
function StepCountryPicker({ selectedCode, selectedName, onSelect, onNext }: {
  selectedCode: string | null
  selectedName: string
  onSelect: (code: string, name: string) => void
  onNext: () => void
}) {
  return (
    <div style={{
      minHeight: '100dvh', width: '100%',
      background: '#1a2e45',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Header overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        padding: 'env(safe-area-inset-top, 52px) 24px 20px',
        background: 'linear-gradient(to bottom, rgba(26,46,69,0.97) 55%, transparent)',
        pointerEvents: 'none',
      }}>
        <StepDots total={6} current={4} dark />
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'rgba(244,241,234,0.4)', marginBottom: 8,
        }}>
          Step 4 of 5
        </div>
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 30, fontStyle: 'italic',
          color: '#f4f1ea', lineHeight: 1.1, letterSpacing: '-0.02em',
        }}>
          {selectedCode ? selectedName : 'Where Will You Rise?'}
        </div>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 13,
          color: 'rgba(244,241,234,0.45)', marginTop: 5,
        }}>
          {selectedCode
            ? 'Your banner will fly here first'
            : 'Tap any gold territory to plant your banner'}
        </div>
      </div>

      {/* Map — fills entire screen */}
      <div style={{ flex: 1, width: '100%', height: '100dvh' }}>
        <CountryPickerMap selectedCode={selectedCode} onSelect={onSelect} />
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: '20px 24px env(safe-area-inset-bottom, 32px)',
        background: 'linear-gradient(to top, rgba(26,46,69,0.97) 55%, transparent)',
      }}>
        <button
          onClick={onNext}
          disabled={!selectedCode}
          style={{
            width: '100%', height: 58, borderRadius: 16, border: 'none',
            background: selectedCode ? '#f4f1ea' : 'rgba(244,241,234,0.12)',
            color: selectedCode ? 'var(--ink)' : 'rgba(244,241,234,0.25)',
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
            letterSpacing: '0.05em',
            cursor: selectedCode ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {selectedCode ? `Claim ${selectedName}` : 'Select a Territory First'}
          {selectedCode && (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
              <path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: TypeScript check and commit**

```bash
cd C:\projects\conquest && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

```bash
cd C:\projects\conquest && git add components/onboarding/CountryPickerMap.tsx app/onboarding/page.tsx && git commit -m "feat: replace text region picker with interactive country map in onboarding"
```

---

## Task 3: Map Visual Quality Overhaul

**Files:**
- Modify: `lib/game-state.ts` — more vivid bot cluster colors
- Modify: `components/map/ConquestMap.tsx` — dark ocean, richer territory palette, thicker borders
- Modify: `app/globals.css` — add pulse keyframes

### Context
The map looks washed out because:
- Ocean is the same parchment as everything else (`var(--bg)`)
- Bot colors are very dark/desaturated
- Claimable/attackable borders are thin

We fix this by: (1) deep navy ocean (`#1a2e45`), (2) more saturated bot cluster colors, (3) richer fill/stroke styles in `styleFunction`.

- [ ] **Step 1: Update bot cluster colors in `game-state.ts`**

In `lib/game-state.ts`, replace the `BOT_CLUSTERS` constant:

```typescript
export const BOT_CLUSTERS: BotCluster[] = [
  {
    username: 'CrimsonGuard',
    color: '#9b2424',          // rich crimson (was #8b2020)
    countries: ['fr', 'es', 'pt', 'be', 'nl'],
  },
  {
    username: 'AzureCrown',
    color: '#1a4a8a',          // vivid azure (was #1a3a6b)
    countries: ['ru', 'ua', 'by', 'pl', 'ro'],
  },
  {
    username: 'VerdantHold',
    color: '#1c6835',          // rich forest green (was #1a5c2a)
    countries: ['in', 'pk', 'bd', 'mm', 'th'],
  },
  {
    username: 'ObsidianPact',
    color: '#4a3520',          // warm obsidian brown (was #3a2a1a)
    countries: ['tr', 'ir', 'iq', 'sa', 'eg'],
  },
]
```

- [ ] **Step 2: Overhaul `ConquestMap.tsx` colors and ocean**

In `components/map/ConquestMap.tsx`, replace the `STATUS_COLORS` constant:

```typescript
const STATUS_COLORS = {
  player:     '#1a1410',   // rich dark (warmer than pure black)
  bot:        '#3a2a2a',   // fallback bot fill
  claimable:  '#b89758',   // gold stroke accent
  attackable: '#c8311c',   // red stroke accent
  neutral:    '#d8d3c6',   // slightly more contrast than before
}
```

And in `styleFunction`, replace the entire function body:

```typescript
  function styleFunction(context: {
    countryCode: string
    countryValue?: number
    minValue: number
    maxValue: number
    color: string
  }) {
    const code = context.countryCode.toLowerCase()
    const state = stateByCode[code]

    if (!state) {
      // Unlisted country — neutral ocean-adjacent styling
      return { fill: '#cfc9bc', stroke: '#bfb9ac', strokeWidth: 0.4, cursor: 'default', fillOpacity: 1 }
    }

    switch (state.status) {
      case 'player':
        return {
          fill: '#1a1410',
          stroke: '#444',
          strokeWidth: 1.2,
          cursor: 'pointer',
          fillOpacity: 1,
        }
      case 'bot':
        return {
          fill: botColorMap[code] ?? STATUS_COLORS.bot,
          stroke: '#111',
          strokeWidth: 0.7,
          cursor: 'default',
          fillOpacity: 1,
        }
      case 'claimable':
        return {
          fill: '#f0e8d0',
          stroke: '#b89758',
          strokeWidth: 1.8,
          cursor: 'pointer',
          fillOpacity: 1,
        }
      case 'attackable':
        return {
          fill: '#2e1010',
          stroke: '#c8311c',
          strokeWidth: 1.8,
          cursor: 'pointer',
          fillOpacity: 1,
        }
      case 'neutral':
      default:
        return {
          fill: '#d8d3c6',
          stroke: '#c4bfb2',
          strokeWidth: 0.4,
          cursor: 'default',
          fillOpacity: 1,
        }
    }
  }
```

And change the `backgroundColor` in the `WorldMap` render:

```tsx
      <WorldMap
        color="#b89758"
        backgroundColor="#1a2e45"   // deep ocean navy
```

- [ ] **Step 3: Add pulse keyframes to `globals.css`**

At the end of `app/globals.css`, append:

```css
/* Claimable country pulse */
@keyframes cq-claimable-pulse {
  0%, 100% { fill: #f0e8d0; stroke: #b89758; }
  50%       { fill: #e0d0a0; stroke: #d4aa5e; }
}

/* Attackable country pulse */
@keyframes cq-attackable-pulse {
  0%, 100% { fill: #2e1010; stroke: #c8311c; }
  50%       { fill: #4a1818; stroke: #e84030; }
}
```

- [ ] **Step 4: Commit visual quality changes**

```bash
cd C:\projects\conquest && git add lib/game-state.ts components/map/ConquestMap.tsx app/globals.css && git commit -m "feat: overhaul map visual quality — dark ocean, vivid bot colors, richer territory palette"
```

---

## Task 4: Post-Render Pulse Animation on Claimable / Attackable Countries

**Files:**
- Modify: `components/map/ConquestMap.tsx`

### Context
CSS `animation` cannot be set via SVG inline `style` (browsers ignore `animation` on inline styles). Instead, after `WorldMap` renders, we inject a `<style>` tag into `<head>` that targets claimable/attackable SVG paths by matching their fill color. We then apply CSS class names to those paths so the `@keyframes` animations from Task 3 run.

The fill colors we set in `styleFunction` are distinctive:
- Claimable: `#f0e8d0` — only claimable countries have this exact fill
- Attackable: `#2e1010` — only attackable countries have this exact fill

So we can safely query `svg path` elements by their `style.fill` value.

- [ ] **Step 1: Add `wrapperRef` and `useRef` import in `ConquestMap.tsx`**

At the top of `ConquestMap.tsx`, ensure `useRef` and `useEffect` are imported:

```tsx
import { useMemo, useRef, useEffect } from 'react'
```

Inside the `ConquestMap` component, add the ref declaration after the existing `useMemo` hooks:

```tsx
  const wrapperRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 2: Add the animation `useEffect` after the `handleClick` function**

Add this `useEffect` block inside `ConquestMap`, after `handleClick` and before the `return` statement:

```tsx
  // Inject CSS animation onto claimable/attackable SVG paths after each render
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    // Small delay to ensure WorldMap has painted its paths
    const timer = setTimeout(() => {
      const paths = wrapper.querySelectorAll<SVGPathElement>('svg path')

      // Clear previous animation class tags to avoid stale selectors
      let styleTag = document.getElementById('cq-country-anim') as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = 'cq-country-anim'
        document.head.appendChild(styleTag)
      }

      const claimSelectors: string[] = []
      const attackSelectors: string[] = []

      paths.forEach((path, i) => {
        // Remove any previously added classes
        path.classList.remove('cq-claimable-path', 'cq-attackable-path')

        const fill = path.style.fill
        if (fill === '#f0e8d0') {
          path.classList.add(`cq-anim-${i}`)
          claimSelectors.push(`.cq-anim-${i}`)
        } else if (fill === '#2e1010') {
          path.classList.add(`cq-anim-${i}`)
          attackSelectors.push(`.cq-anim-${i}`)
        }
      })

      styleTag.textContent = [
        claimSelectors.length > 0
          ? `${claimSelectors.join(',')} { animation: cq-claimable-pulse 2.4s ease-in-out infinite; }`
          : '',
        attackSelectors.length > 0
          ? `${attackSelectors.join(',')} { animation: cq-attackable-pulse 1.7s ease-in-out infinite; }`
          : '',
      ].filter(Boolean).join('\n')
    }, 120) // 120ms lets react-svg-worldmap paint before we query

    return () => {
      clearTimeout(timer)
      const styleTag = document.getElementById('cq-country-anim')
      if (styleTag) styleTag.textContent = ''
    }
  }, [gameState]) // re-run when game state changes (ownership updates via Realtime)
```

- [ ] **Step 3: Attach the `wrapperRef` to the container div**

In the `return` statement of `ConquestMap`, change:

```tsx
    <div style={{ width: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
```
to:
```tsx
    <div ref={wrapperRef} style={{ width: '100%', background: '#1a2e45', overflow: 'hidden' }}>
```

(Changing the background from `var(--bg)` to `#1a2e45` makes the outer wrapper match the ocean color in case of any gap between the container and the SVG.)

- [ ] **Step 4: TypeScript check**

```bash
cd C:\projects\conquest && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
cd C:\projects\conquest && git add components/map/ConquestMap.tsx && git commit -m "feat: add post-render pulse animation on claimable and attackable countries"
```

---

## Task 5: First-Visit Welcome Banner

**Files:**
- Modify: `components/map/KingdomMapClient.tsx`

### Context
After onboarding, the user is redirected to `/?firstVisit=1`. We detect this in `KingdomMapClient`, show a brief banner ("Your banner flies over [Country Name]"), and auto-dismiss it after 4 seconds. This confirms to the player that their territory was claimed and draws attention to the highlighted claimable countries nearby.

- [ ] **Step 1: Add `useSearchParams` import and `firstVisit` state**

In `components/map/KingdomMapClient.tsx`, add `useSearchParams` to the import:

```tsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
```

Inside `KingdomMapClient`, add state after the existing state declarations:

```tsx
  const searchParams = useSearchParams()
  const [welcomeBanner, setWelcomeBanner] = useState(
    searchParams.get('firstVisit') === '1'
  )
```

- [ ] **Step 2: Auto-dismiss the banner after 4 seconds**

Add a `useEffect` after the Realtime subscription effect:

```tsx
  // Auto-dismiss first-visit welcome banner
  useEffect(() => {
    if (!welcomeBanner) return
    const t = setTimeout(() => setWelcomeBanner(false), 4000)
    return () => clearTimeout(t)
  }, [welcomeBanner])
```

- [ ] **Step 3: Derive the player's first territory name for the banner**

Add a `useMemo` after `liveBotOwnerMap`:

```tsx
  const firstTerritoryName = useMemo(() => {
    const t = territories.find(t => t.owner?.username === currentUsername)
    return t?.name ?? null
  }, [territories, currentUsername])
```

- [ ] **Step 4: Render the welcome banner in the JSX**

In the `return` statement of `KingdomMapClient`, after the `actionLoading` overlay block, add:

```tsx
      {/* First-visit welcome banner */}
      {welcomeBanner && firstTerritoryName && (
        <div
          onClick={() => setWelcomeBanner(false)}
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'var(--ink)',
            color: '#f4f1ea',
            borderRadius: 14,
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            animation: 'cq-banner-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 2 }}>
            Banner planted
          </span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', letterSpacing: '-0.01em' }}>
            {firstTerritoryName}
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'rgba(244,241,234,0.45)', marginTop: 2 }}>
            Tap gold territories to expand your empire
          </span>
        </div>
      )}
```

- [ ] **Step 5: Add the banner slide-in keyframe to `globals.css`**

At the end of `app/globals.css`, append:

```css
/* First-visit welcome banner slide-in */
@keyframes cq-banner-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.92); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd C:\projects\conquest && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 7: Commit**

```bash
cd C:\projects\conquest && git add components/map/KingdomMapClient.tsx app/globals.css && git commit -m "feat: show first-visit welcome banner after onboarding country claim"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|---|---|
| Onboarding shows interactive map for country selection | Task 1 + 2 |
| Can only choose free (non-bot) countries | Task 1 — bot countries get `cursor: default`, click ignored |
| After picking, navigates to map dashboard | Task 2 — `handleCreate` → `router.push('/?firstVisit=1')` |
| Player shown on map automatically after login | Native — map fetches territories from DB incl. newly claimed one |
| Claimable countries highlighted/animated | Task 3 (colors) + Task 4 (pulse animation) |
| Attackable countries highlighted | Task 3 + Task 4 (attackable pulse) |
| Map visual quality improved | Task 3 — dark ocean, vivid territory colors |
| Map "details" added | Task 3 — richer borders, contrast improvements |
| First-visit confirmation of claimed territory | Task 5 — welcome banner |

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:**
- `CountryPickerMap` props: `{ selectedCode: string | null, onSelect: (code: string, name: string) => void }` — consistent in Task 1 and Task 2.
- `StepCountryPicker` props: `{ selectedCode, selectedName, onSelect, onNext }` — consistent in Task 2 steps 4 and 5.
- `firstTerritoryName` derived from `territories` same pattern as `playerCodes` in existing code.
- `wrapperRef` typed `useRef<HTMLDivElement>` attached to `<div>` — correct.
