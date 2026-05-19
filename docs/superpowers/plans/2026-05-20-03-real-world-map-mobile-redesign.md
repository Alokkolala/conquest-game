# Real-World Map + Mobile Design Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hex grid with a full real-world country-border SVG map and restyle the entire app to match the Conquest design system — mobile-first, warm cream palette, Instrument Serif + Manrope + JetBrains Mono typography, 4 screens: Kingdom, Territory Detail, Post-Match, Dynasty.

**Architecture:** Next.js 14 App Router, mobile viewport (390px centered). World map rendered as SVG from `world-atlas` (TopoJSON 110m) + `topojson-client` npm packages — no CDN fetch at runtime, data bundled at build time. Each country is a territory. DB only stores "in-play" territories (owned/enemy/contested); countries without a DB row render as neutral/unclaimed. Four screens share a bottom TabBar. Bottom sheets replace the right sidebar.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase Realtime, `world-atlas` + `topojson-client` (world country SVG), Instrument Serif + Manrope + JetBrains Mono (Google Fonts).

**Design source:** Extracted from user's Claude Design handoff bundle.
- CQ palette: bg `#f4f1ea`, bgWarm `#ece8df`, ink `#111111`, inkSoft `#2a2520`, muted `#8a8579`, line `#d8d3c6`, lineSoft `#e6e2d6`, red `#c8311c`, redDeep `#9b1f10`, redTint `#f1d6cf`, gold `#b89758`
- Fonts: Instrument Serif (display), Manrope (UI), JetBrains Mono (code/coords)
- Territory states: owned = ink `#111`, enemy = dark `#3a3530`, contested = red `#c8311c`, neutral = cream `#ece8df`

---

## File Map

**Modified files:**
- `app/globals.css` — CQ design tokens, font imports, animations (pulse, flip, spin)
- `app/layout.tsx` — Google Fonts, mobile viewport, CQ body styles
- `tailwind.config.ts` — CQ color palette + font families
- `app/page.tsx` — Kingdom screen (mobile layout: map + floating chrome + bottom drawer)
- `lib/types.ts` — Add `region_code` to Territory; add `TerritoryStatus` + `CountryFeature` types
- `supabase/seed.sql` — Reseed with ~30 real-world country territories (bots + player start)
- `app/auth/page.tsx` — Restyle with CQ palette

**Created files:**
- `lib/world-territories.ts` — ISO numeric→name lookup, default territory states, GeoJSON projection helpers
- `components/map/WorldMap.tsx` — SVG world map: TopoJSON → SVG paths, Supabase ownership overlay, animations
- `components/map/KingdomMapClient.tsx` — Client wrapper: Realtime subscription + territory sheet state
- `components/map/TerritorySheet.tsx` — Slide-up bottom sheet for territory detail + CTA
- `components/ui/TabBar.tsx` — Bottom nav (Kingdom | Challenge | Dynasty)
- `components/ui/BottomDrawer.tsx` — Reusable frosted-glass bottom drawer shell + SheetHandle
- `components/ui/ProfileChip.tsx` — Frosted-glass profile avatar pill
- `app/dynasty/page.tsx` — Dynasty/profile screen (holdings + recent campaigns + stats)

**Deleted files:**
- `components/map/HexMap.tsx` — Replaced by WorldMap
- `components/map/MapSidebar.tsx` — Replaced by BottomDrawer
- `components/map/TerritoryHex.tsx` — Hex grid gone

**Chess game files** (ChessGame, StockfishWorker, ClaimModal, ChallengeModal) — preserved from Plan 02 work, wired through TerritorySheet CTA hooks.

---

## Task 1: Design Tokens + Fonts

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Update globals.css with CQ tokens and animations**

Replace `app/globals.css` entirely:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #f4f1ea;
  --bg-warm: #ece8df;
  --ink: #111111;
  --ink-soft: #2a2520;
  --muted: #8a8579;
  --line: #d8d3c6;
  --line-soft: #e6e2d6;
  --red: #c8311c;
  --red-deep: #9b1f10;
  --red-tint: #f1d6cf;
  --gold: #b89758;
  --serif: "Instrument Serif", "Times New Roman", serif;
  --sans: "Manrope", -apple-system, system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, monospace;
}

* { -webkit-font-smoothing: antialiased; box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg-warm);
  font-family: var(--sans);
  color: var(--ink);
}

/* Scrollbar hide */
.cq-scroll::-webkit-scrollbar { display: none; }
.cq-scroll { scrollbar-width: none; }

/* Ambient pulse on contested territories */
@keyframes cq-pulse {
  0%   { transform: scale(1);   opacity: 0.55; }
  100% { transform: scale(3.2); opacity: 0; }
}
.cq-pulse-dot {
  animation: cq-pulse 1.8s ease-out infinite;
  transform-origin: center;
}

/* Territory flip animations (post-match) */
@keyframes cq-flip-claim {
  0%   { fill: var(--line); }
  40%  { fill: var(--red); }
  100% { fill: var(--ink); }
}
@keyframes cq-flip-lose {
  0%   { fill: var(--ink); }
  40%  { fill: var(--red); }
  100% { fill: var(--line); }
}
.cq-flipping-win  path,
.cq-flipping-win  polygon { animation: cq-flip-claim 2.2s ease-out forwards; }
.cq-flipping-lose path,
.cq-flipping-lose polygon { animation: cq-flip-lose  2.2s ease-out forwards; }

/* Spinner */
@keyframes cq-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 2: Update layout.tsx**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Conquest — Territory Chess',
  description: 'Win chess. Claim territory. Rule the map.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: 'var(--bg-warm)',
          fontFamily: 'var(--sans)',
          color: 'var(--ink)',
          minHeight: '100dvh',
        }}
      >
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update tailwind.config.ts**

Replace `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif:  ['"Instrument Serif"', '"Times New Roman"', 'serif'],
        sans:   ['Manrope', '-apple-system', 'system-ui', 'sans-serif'],
        mono:   ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        cinzel: ['Cinzel', 'serif'],
      },
      colors: {
        cq: {
          bg:       '#f4f1ea',
          warm:     '#ece8df',
          ink:      '#111111',
          soft:     '#2a2520',
          muted:    '#8a8579',
          line:     '#d8d3c6',
          lineSoft: '#e6e2d6',
          red:      '#c8311c',
          redDeep:  '#9b1f10',
          redTint:  '#f1d6cf',
          gold:     '#b89758',
        },
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 4: Start dev server and verify fonts load**

```bash
cd /c/projects/conquest && npm run dev
```

Open `http://localhost:3000`. Verify: warm cream background visible, no dark background.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx tailwind.config.ts
git commit -m "feat: add CQ design tokens, Instrument Serif + Manrope + JetBrains Mono fonts"
```

---

## Task 2: World Map Data Packages + Types

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/world-territories.ts`

- [ ] **Step 1: Install world-atlas and topojson-client**

```bash
cd /c/projects/conquest && npm install world-atlas topojson-client && npm install --save-dev @types/topojson-client @types/geojson
```

Expected: packages installed, no errors.

- [ ] **Step 2: Update lib/types.ts**

Replace `lib/types.ts`:

```ts
export interface Profile {
  id: string
  username: string
  display_color: string
  territory_count: number
  created_at: string
}

export interface Territory {
  id: number
  name: string          // country name e.g. "France", "Russia"
  hex_q: number         // legacy column, unused for world map
  hex_r: number         // legacy column, unused for world map
  region_code: string | null  // ISO numeric as string e.g. "250" (France)
  owner_id: string | null
  owner?: Profile | null
  created_at: string
}

export type TerritoryStatus = 'owned' | 'enemy' | 'contested' | 'neutral'

export interface CountryFeature {
  id: string            // ISO numeric code e.g. "250"
  name: string          // display name e.g. "France"
  path: string          // SVG path string
  center: [number, number]   // SVG [x, y] centroid
  status: TerritoryStatus
  owner?: string        // username of owner (for enemy/contested)
  ownerElo?: number
  value: number         // crown points (based on area/significance)
  held?: number         // days held (for owned territories)
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

- [ ] **Step 3: Create lib/world-territories.ts**

Create `lib/world-territories.ts`:

```ts
import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { TerritoryStatus, CountryFeature } from './types'

// world-atlas 110m — bundled at build time, no runtime CDN fetch
// eslint-disable-next-line @typescript-eslint/no-require-imports
const worldData = require('world-atlas/countries-110m.json') as Topology

// ── ISO numeric → country name lookup ─────────────────────
// Covers all 177 features in world-atlas countries-110m
export const ISO_NUMERIC_TO_NAME: Record<string, string> = {
  '4':'Afghanistan','8':'Albania','12':'Algeria','24':'Angola','32':'Argentina',
  '36':'Australia','40':'Austria','50':'Bangladesh','56':'Belgium','64':'Bhutan',
  '68':'Bolivia','76':'Brazil','100':'Bulgaria','104':'Myanmar','116':'Cambodia',
  '120':'Cameroon','124':'Canada','152':'Chile','156':'China','170':'Colombia',
  '178':'Congo','188':'Costa Rica','191':'Croatia','192':'Cuba','196':'Cyprus',
  '203':'Czech Republic','204':'Benin','208':'Denmark','218':'Ecuador',
  '818':'Egypt','222':'El Salvador','231':'Ethiopia','246':'Finland','250':'France',
  '266':'Gabon','276':'Germany','288':'Ghana','300':'Greece','320':'Guatemala',
  '332':'Haiti','340':'Honduras','348':'Hungary','356':'India','360':'Indonesia',
  '364':'Iran','368':'Iraq','372':'Ireland','376':'Israel','380':'Italy',
  '388':'Jamaica','392':'Japan','400':'Jordan','398':'Kazakhstan','404':'Kenya',
  '410':'South Korea','408':'North Korea','414':'Kuwait','418':'Laos','422':'Lebanon',
  '430':'Liberia','434':'Libya','442':'Luxembourg','454':'Malawi','458':'Malaysia',
  '484':'Mexico','504':'Morocco','508':'Mozambique','516':'Namibia','524':'Nepal',
  '528':'Netherlands','554':'New Zealand','558':'Nicaragua','562':'Niger',
  '566':'Nigeria','578':'Norway','586':'Pakistan','591':'Panama','598':'Papua New Guinea',
  '604':'Peru','608':'Philippines','616':'Poland','620':'Portugal','630':'Puerto Rico',
  '642':'Romania','643':'Russia','646':'Rwanda','682':'Saudi Arabia','686':'Senegal',
  '694':'Sierra Leone','706':'Somalia','710':'South Africa','724':'Spain',
  '729':'Sudan','752':'Sweden','756':'Switzerland','760':'Syria','762':'Tajikistan',
  '764':'Thailand','768':'Togo','780':'Trinidad and Tobago','788':'Tunisia',
  '792':'Turkey','800':'Uganda','804':'Ukraine','784':'United Arab Emirates',
  '826':'United Kingdom','840':'United States','858':'Uruguay','860':'Uzbekistan',
  '862':'Venezuela','704':'Vietnam','887':'Yemen','894':'Zambia','716':'Zimbabwe',
  '32':'Argentina','854':'Burkina Faso','140':'Central African Republic',
  '148':'Chad','175':'Comoros','174':'Djibouti','232':'Eritrea','266':'Gabon',
  '324':'Guinea','624':'Guinea-Bissau','426':'Lesotho','450':'Madagascar',
  '466':'Mali','478':'Mauritania','516':'Namibia','562':'Niger','706':'Somalia',
  '729':'Sudan','748':'Eswatini','834':'Tanzania','120':'Cameroon',
}

// ── Default gameplay state for named countries ─────────────
// Only countries listed here have DB-assigned ownership at game start.
// All other countries show as neutral (unclaimed).
export const DEFAULT_COUNTRY_STATUS: Record<string, {
  status: TerritoryStatus
  held?: number
  value: number
  owner?: string
  ownerElo?: number
}> = {
  'France':         { status: 'owned',     held: 47,  value: 12.4 },
  'Germany':        { status: 'owned',     held: 22,  value: 9.1  },
  'United Kingdom': { status: 'owned',     held: 81,  value: 14.8 },
  'United States':  { status: 'owned',     held: 134, value: 22.6 },
  'Brazil':         { status: 'owned',     held: 18,  value: 7.0  },
  'South Africa':   { status: 'owned',     held: 12,  value: 6.1  },
  'Italy':          { status: 'contested', held: 4,   value: 8.4,  owner: 'AzureCrown',  ownerElo: 1820 },
  'India':          { status: 'contested', held: 9,   value: 9.8,  owner: 'VerdantHold', ownerElo: 1755 },
  'Russia':         { status: 'enemy',               value: 18.2, owner: 'Korchnoi_IV', ownerElo: 1988 },
  'China':          { status: 'enemy',               value: 20.1, owner: 'TigerOf64',   ownerElo: 2011 },
  'Japan':          { status: 'enemy',               value: 11.3, owner: 'Hoshino',     ownerElo: 1901 },
  'Canada':         { status: 'enemy',               value: 10.8, owner: 'ObsidianPact',ownerElo: 1843 },
  'Australia':      { status: 'enemy',               value: 9.4,  owner: 'CrimsonGuard',ownerElo: 1776 },
  'Argentina':      { status: 'enemy',               value: 7.2,  owner: 'CrimsonGuard',ownerElo: 1776 },
}

// ── TopoJSON → GeoJSON conversion ─────────────────────────
type GeoFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }>

let _features: GeoFeature[] | null = null
export function getWorldFeatures(): GeoFeature[] {
  if (_features) return _features
  const geo = topojson.feature(worldData, worldData.objects.countries as any) as GeoJSON.FeatureCollection
  _features = geo.features as GeoFeature[]
  return _features
}

// ── SVG projection helpers ─────────────────────────────────
// Equirectangular projection: world fits into 1000 x 500 viewBox
const VB_W = 1000
const VB_H = 500

type Coord = [number, number]
type Ring  = Coord[]

export function project([lng, lat]: Coord): [number, number] {
  const x = (lng + 180) / 360 * VB_W
  const y = (90 - lat) / 180 * VB_H
  return [x, y]
}

function ringToPath(ring: Coord[]): string {
  let s = ''
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i])
    s += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  }
  return s + 'Z'
}

export function geomToPath(geom: GeoJSON.Geometry): string {
  const parts: string[] = []
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) parts.push(ringToPath(ring as Coord[]))
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates)
      for (const ring of poly) parts.push(ringToPath(ring as Coord[]))
  }
  return parts.join(' ')
}

// Centroid of the largest ring (so labels land in the main body of MultiPolygons)
export function geomCentroid(geom: GeoJSON.Geometry): [number, number] {
  let bestArea = -1
  let bestCenter: [number, number] = [0, 0]

  const considerRing = (ring: Coord[]) => {
    let area = 0, cx = 0, cy = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = project(ring[i])
      const [x2, y2] = project(ring[i + 1])
      const a = x1 * y2 - x2 * y1
      area += a; cx += (x1 + x2) * a; cy += (y1 + y2) * a
    }
    area /= 2
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area)
      bestCenter = area === 0 ? [0, 0] : [cx / (6 * area), cy / (6 * area)]
    }
  }
  if (geom.type === 'Polygon') geom.coordinates.forEach(r => considerRing(r as Coord[]))
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(r => considerRing(r as Coord[])))
  return bestCenter
}

// ── Build all CountryFeatures from the bundled TopoJSON ────
// ownerMap: country name → owner username (from Supabase territories)
// currentUsername: logged-in user's username
export function buildCountryFeatures(
  ownerMap: Record<string, string> = {},
  currentUsername = ''
): CountryFeature[] {
  const features = getWorldFeatures()
  return features.map(f => {
    const id    = String(f.id ?? '')
    const name  = ISO_NUMERIC_TO_NAME[id] ?? id
    const owner = ownerMap[name]

    let status: TerritoryStatus = 'neutral'
    let ownerUsername: string | undefined
    let ownerElo: number | undefined
    let held: number | undefined
    let value = 5

    // Override from Supabase live data first
    if (owner !== undefined) {
      if (owner === currentUsername) {
        status = 'owned'
      } else {
        status = 'enemy'
        ownerUsername = owner
      }
    }

    // Fall back to default static state if not overridden by Supabase
    const def = DEFAULT_COUNTRY_STATUS[name]
    if (def && owner === undefined) {
      status     = def.status
      ownerUsername = def.owner
      ownerElo   = def.ownerElo
      held       = def.held
      value      = def.value
    } else if (def) {
      value = def.value
      held  = def.held
    }

    return {
      id,
      name,
      path:   f.geometry ? geomToPath(f.geometry) : '',
      center: f.geometry ? geomCentroid(f.geometry) : [0, 0],
      status,
      owner: ownerUsername,
      ownerElo,
      value,
      held,
    }
  }).filter(f => f.path !== '')
}

export { VB_W, VB_H }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /c/projects/conquest && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors in the new files. If `world-atlas` types are missing, add to `tsconfig.json`:
```json
{ "compilerOptions": { "resolveJsonModule": true } }
```

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/world-territories.ts package.json package-lock.json
git commit -m "feat: add world-atlas + topojson-client, CountryFeature types, world projection helpers"
```

---

## Task 3: World SVG Map Component

**Files:**
- Create: `components/map/WorldMap.tsx`

- [ ] **Step 1: Create WorldMap component**

Create `components/map/WorldMap.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { buildCountryFeatures, VB_W, VB_H } from '@/lib/world-territories'
import type { CountryFeature, TerritoryStatus } from '@/lib/types'

// ── Color helpers ────────────────────────────────────────────
function fillFor(status: TerritoryStatus) {
  if (status === 'owned')     return '#111111'
  if (status === 'enemy')     return '#3a3530'
  if (status === 'contested') return '#c8311c'
  return '#ece8df'
}
function strokeFor(status: TerritoryStatus) {
  if (status === 'owned')     return '#111111'
  if (status === 'enemy')     return '#2a2520'
  if (status === 'contested') return '#c8311c'
  return '#d8d3c6'
}
function strokeWidthFor(status: TerritoryStatus, isHL: boolean) {
  if (isHL) return 2.5
  if (status === 'neutral') return 0.8
  return 1.4
}
function labelColorFor(status: TerritoryStatus) {
  if (status === 'owned')     return '#ffffff'
  if (status === 'enemy')     return '#e6e1d3'
  if (status === 'contested') return '#ffffff'
  return '#8a8579'
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  width?: number
  height?: number
  ownerMap?: Record<string, string>   // country name → owner username
  currentUsername?: string
  highlightId?: string | null         // ISO numeric code to highlight
  flipState?: 'win' | 'lose' | null
  showLabels?: boolean
  pulseContested?: boolean
  onCountryClick?: (feature: CountryFeature) => void
}

export default function WorldMap({
  width = 390,
  height = 250,
  ownerMap = {},
  currentUsername = '',
  highlightId = null,
  flipState = null,
  showLabels = true,
  pulseContested = true,
  onCountryClick,
}: Props) {
  // Build features — memoized on ownerMap identity
  const features = useMemo(
    () => buildCountryFeatures(ownerMap, currentUsername),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(ownerMap), currentUsername]
  )

  // Only label "active" (owned/enemy/contested) countries to avoid clutter
  const labelFeatures = showLabels
    ? features.filter(f => f.status !== 'neutral' && f.path)
    : []

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', background: 'var(--bg)' }}
    >
      {/* Latitude / longitude hairlines */}
      <g stroke="var(--line)" strokeWidth="0.4" opacity="0.5">
        {[-60, -30, 0, 30, 60].map(lat => {
          const y = (90 - lat) / 180 * VB_H
          return <line key={'lat' + lat} x1="0" x2={VB_W} y1={y} y2={y} />
        })}
        {[-150, -100, -50, 0, 50, 100, 150].map(lng => {
          const x = (lng + 180) / 360 * VB_W
          return <line key={'lng' + lng} x1={x} x2={x} y1="0" y2={VB_H} />
        })}
      </g>

      {/* Equator label */}
      <text
        x={VB_W - 4} y={(90 / 180) * VB_H - 3}
        textAnchor="end"
        fontFamily="var(--mono)" fontSize="8"
        fill="var(--muted)" opacity="0.7"
      >00°</text>

      {/* Country fills — drop shadow layer (non-neutral only) */}
      <g opacity="0.06">
        {features
          .filter(f => f.status !== 'neutral')
          .map(f => (
            <path key={'sh' + f.id} d={f.path} fill="#111" transform="translate(1.5,2)" />
          ))}
      </g>

      {/* Country paths */}
      <g strokeLinejoin="round" strokeLinecap="round">
        {features.map(f => {
          const isHL  = f.id === highlightId
          const flipCls = isHL && flipState ? `cq-flipping-${flipState}` : ''
          return (
            <g
              key={f.id}
              className={flipCls}
              onClick={() => onCountryClick?.(f)}
              style={{ cursor: onCountryClick ? 'pointer' : 'default' }}
            >
              <path
                d={f.path}
                fill={fillFor(f.status)}
                stroke={strokeFor(f.status)}
                strokeWidth={strokeWidthFor(f.status, isHL)}
              />
              {/* Highlight ring */}
              {isHL && (
                <path
                  d={f.path}
                  fill="none"
                  stroke="var(--red)"
                  strokeWidth="3"
                  strokeOpacity="0.55"
                />
              )}
            </g>
          )
        })}
      </g>

      {/* Contested pulse rings */}
      {pulseContested &&
        features
          .filter(f => f.status === 'contested')
          .map(f => {
            const [cx, cy] = f.center
            return (
              <g key={'p' + f.id} transform={`translate(${cx} ${cy})`}>
                <circle r="5" fill="var(--red)" opacity="0.55" className="cq-pulse-dot" />
                <circle
                  r="5" fill="var(--red)" opacity="0.4" className="cq-pulse-dot"
                  style={{ animationDelay: '0.8s' }}
                />
              </g>
            )
          })}

      {/* Labels — only owned/enemy/contested, only if country is big enough */}
      {labelFeatures.map(f => {
        const [cx, cy] = f.center
        // Skip labels that project off the map
        if (cx < 0 || cx > VB_W || cy < 0 || cy > VB_H) return null
        return (
          <text
            key={'l' + f.id}
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--mono)"
            fontSize="9"
            fontWeight="700"
            fill={labelColorFor(f.status)}
            letterSpacing="0.08em"
            style={{ textTransform: 'uppercase', pointerEvents: 'none' }}
          >
            {f.name.length > 12 ? f.name.slice(0, 11) + '…' : f.name}
          </text>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript and build**

```bash
cd /c/projects/conquest && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: no errors.

- [ ] **Step 3: Quick smoke-test**

Temporarily add `<WorldMap />` to `app/page.tsx` and load `http://localhost:3000`. Verify:
- All countries render as cream outlines
- Owned countries (France, Germany, UK, USA, Brazil, South Africa) are ink-black
- Enemy countries (Russia, China, Japan, Canada, Australia, Argentina) are dark
- Italy and India pulse red (contested)
- Labels visible on active countries

- [ ] **Step 4: Commit**

```bash
git add components/map/WorldMap.tsx
git commit -m "feat: add WorldMap SVG component — world-atlas TopoJSON, ownership colors, pulse/flip animations"
```

---

## Task 4: Shared UI Primitives

**Files:**
- Create: `components/ui/TabBar.tsx`
- Create: `components/ui/BottomDrawer.tsx`
- Create: `components/ui/ProfileChip.tsx`

- [ ] **Step 1: Create TabBar**

Create `components/ui/TabBar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = 'map' | 'challenge' | 'dynasty'

const MapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 6L9 4L15 6L21 4L21 18L15 20L9 18L3 20Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M9 4V18M15 6V20" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
)
const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M9 8L16 12L9 16Z" fill="currentColor"/>
  </svg>
)
const CrownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 8L7 14L12 7L17 14L20 8L19 19L5 19Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)

const TABS = [
  { id: 'map'       as Tab, label: 'Kingdom',   Icon: MapIcon,   href: '/'         },
  { id: 'challenge' as Tab, label: 'Challenge',  Icon: PlayIcon,  href: '/challenge'},
  { id: 'dynasty'   as Tab, label: 'Dynasty',    Icon: CrownIcon, href: '/dynasty'  },
]

export default function TabBar({ active }: { active?: Tab }) {
  const pathname = usePathname()
  const current: Tab = active ?? (
    pathname === '/'          ? 'map'       :
    pathname === '/challenge' ? 'challenge' : 'dynasty'
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 390,
      paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      paddingTop: 6,
      borderTop: '0.5px solid var(--line)',
      background: 'rgba(244,241,234,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      zIndex: 40,
    }}>
      {TABS.map(({ id, label, Icon, href }) => {
        const on = current === id
        return (
          <Link key={id} href={href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, flex: 1, paddingTop: 8, paddingBottom: 4,
            color: on ? 'var(--ink)' : 'var(--muted)', textDecoration: 'none',
          }}>
            <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>
              <Icon />
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
            }}>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create BottomDrawer + SheetHandle**

Create `components/ui/BottomDrawer.tsx`:

```tsx
export function SheetHandle() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
      <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--line)' }} />
    </div>
  )
}

export default function BottomDrawer({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: 'rgba(244,241,234,0.97)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderTop: '0.5px solid var(--line)',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create ProfileChip**

Create `components/ui/ProfileChip.tsx`:

```tsx
export default function ProfileChip({
  name, initial, elo, dark = false,
}: { name: string; initial: string; elo?: number; dark?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: dark ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 999, padding: '5px 12px 5px 5px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      border: `0.5px solid ${dark ? 'rgba(255,255,255,0.1)' : 'var(--line)'}`,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 999, background: 'var(--ink)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic',
      }}>{initial}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em', color: dark ? '#fff' : 'var(--ink)' }}>
          {name}
        </span>
        {elo !== undefined && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: dark ? 'rgba(255,255,255,0.6)' : 'var(--muted)', marginTop: 2,
          }}>ELO {elo}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /c/projects/conquest && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

- [ ] **Step 5: Commit**

```bash
git add components/ui/TabBar.tsx components/ui/BottomDrawer.tsx components/ui/ProfileChip.tsx
git commit -m "feat: add TabBar, BottomDrawer, ProfileChip UI primitives"
```

---

## Task 5: Territory Detail Sheet

**Files:**
- Create: `components/map/TerritorySheet.tsx`

- [ ] **Step 1: Create TerritorySheet**

Create `components/map/TerritorySheet.tsx`:

```tsx
'use client'

import type { CountryFeature } from '@/lib/types'

interface Props {
  feature: CountryFeature
  onClose: () => void
  onClaim?: () => void
  onChallenge?: () => void
  onDefend?: () => void
}

export default function TerritorySheet({ feature, onClose, onClaim, onChallenge, onDefend }: Props) {
  const { name, status, owner, ownerElo, value, held } = feature

  function handleCTA() {
    if (status === 'neutral')   onClaim?.()
    else if (status === 'enemy')     onChallenge?.()
    else if (status === 'contested') onDefend?.()
    onClose()
  }

  const ctaLabel =
    status === 'enemy'     ? 'Challenge for Territory' :
    status === 'contested' ? 'Defend Now'              :
    status === 'owned'     ? 'Garrison · Manage'       :
    'Claim Territory'

  const statusLabel =
    status === 'neutral'   ? 'UNCLAIMED'               :
    status === 'enemy'     ? `HELD BY ${owner ?? '—'}` :
    status === 'owned'     ? 'YOURS'                   :
    'UNDER SIEGE'

  const statusColor =
    status === 'contested' ? 'var(--red)' :
    status === 'owned'     ? 'var(--ink)' : 'var(--muted)'

  const bodyText =
    status === 'enemy'     ? `Take ${name} from ${owner} in a single game. Win and the flag flips.` :
    status === 'contested' ? 'Your hold is under siege. Win the next match or the territory falls.' :
    status === 'owned'     ? `This territory pays you ${Math.round(value)} pts daily. Defend on challenge.` :
    'Unclaimed. First win plants your banner.'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 45,
        background: 'rgba(0,0,0,0.12)',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 390,
        zIndex: 50,
        background: 'var(--bg)',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: '14px 24px 96px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--line)' }} />
        </div>

        {/* Code + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.14em', color: 'var(--muted)',
          }}>{feature.id}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--muted)', display: 'inline-block' }} />
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', color: statusColor, textTransform: 'uppercase',
          }}>{statusLabel}</span>
        </div>

        {/* Country name */}
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 44, lineHeight: 1,
          letterSpacing: '-0.025em', marginTop: 12,
        }}>{name}</div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          marginTop: 22, paddingTop: 16, paddingBottom: 16,
          borderTop: '0.5px solid var(--line)',
          borderBottom: '0.5px solid var(--line)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Stake</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1, marginTop: 4 }}>
              {Math.round(value * 10) / 10}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 3 }}>pts</span>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Defender</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.1, marginTop: 4, letterSpacing: '-0.01em' }}>
              {status === 'neutral' ? 'Unclaimed' : status === 'owned' ? 'You' : owner ?? '—'}
            </div>
            {ownerElo !== undefined && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em' }}>
                ELO {ownerElo}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Form</div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
              {(['W','W','L','W','L'] as const).map((r, i) => (
                <div key={i} style={{
                  width: 14, height: 18, borderRadius: 3,
                  background: r === 'W' ? 'var(--ink)' : 'var(--line)',
                  color: r === 'W' ? '#fff' : 'var(--muted)',
                  fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{r}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Body copy */}
        <p style={{
          fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.35,
          color: 'var(--ink-soft)', marginTop: 16, fontStyle: 'italic',
        }}>{bodyText}</p>

        {/* CTAs */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {status !== 'owned' && (
            <button onClick={handleCTA} style={{
              width: '100%', height: 56, borderRadius: 14,
              background: 'var(--ink)', color: '#fff', border: 'none',
              fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {ctaLabel}
              <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                <path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', height: 50, borderRadius: 14,
            background: 'transparent', color: 'var(--ink)',
            border: '1px solid var(--line)',
            fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>Back to Map</button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Create KingdomMapClient (client wrapper with Realtime)**

Create `components/map/KingdomMapClient.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import WorldMap from './WorldMap'
import TerritorySheet from './TerritorySheet'
import type { Territory, CountryFeature } from '@/lib/types'

interface Props {
  width?: number
  height?: number
  initialTerritories: Territory[]
  currentUserId?: string
  currentUsername?: string
}

export default function KingdomMapClient({
  width = 390, height = 250,
  initialTerritories,
  currentUserId,
  currentUsername = '',
}: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const supabase = createClient()

  // Build ownerMap from live territories: country name → owner username
  const ownerMap: Record<string, string> = {}
  for (const t of territories) {
    if (t.owner?.username) ownerMap[t.name] = t.owner.username
  }

  // Realtime: territory ownership changes
  useEffect(() => {
    const channel = supabase
      .channel('world-map')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'territories' }, async (payload) => {
        const { data } = await supabase
          .from('territories')
          .select('*, owner:profiles(*)')
          .eq('id', payload.new.id)
          .single()
        if (data) setTerritories(prev => prev.map(t => t.id === data.id ? data : t))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  return (
    <>
      <WorldMap
        width={width}
        height={height}
        ownerMap={ownerMap}
        currentUsername={currentUsername}
        onCountryClick={setSelected}
      />
      {selected && (
        <TerritorySheet
          feature={selected}
          onClose={() => setSelected(null)}
          onClaim={() => setSelected(null)}
          onChallenge={() => setSelected(null)}
          onDefend={() => setSelected(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /c/projects/conquest && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/map/TerritorySheet.tsx components/map/KingdomMapClient.tsx
git commit -m "feat: territory detail sheet + KingdomMapClient with Realtime subscription"
```

---

## Task 6: Kingdom Screen (Main Page Redesign)

**Files:**
- Modify: `app/page.tsx`
- Delete: `components/map/HexMap.tsx`, `components/map/MapSidebar.tsx`, `components/map/TerritoryHex.tsx`

- [ ] **Step 1: Delete old hex components**

```bash
cd /c/projects/conquest && rm components/map/HexMap.tsx components/map/MapSidebar.tsx components/map/TerritoryHex.tsx
```

- [ ] **Step 2: Replace app/page.tsx**

```tsx
import { createServerClient_ } from '@/lib/supabase-server'
import KingdomMapClient from '@/components/map/KingdomMapClient'
import TabBar from '@/components/ui/TabBar'
import ProfileChip from '@/components/ui/ProfileChip'
import BottomDrawer, { SheetHandle } from '@/components/ui/BottomDrawer'
import { DEFAULT_COUNTRY_STATUS } from '@/lib/world-territories'
import type { Profile } from '@/lib/types'

export default async function MapPage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()

  // Auto-create profile on first login
  let profile: Profile | null = null
  if (user) {
    let { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (!existing) {
      const username = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '') || `player${user.id.slice(0, 5)}`
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, username, display_color: '#c8311c' })
        .select('*')
        .single()
      existing = created
    }
    profile = existing
  }

  // Fetch all territories with owner profile joined
  const { data: territories } = await supabase
    .from('territories')
    .select('*, owner:profiles(*)')
    .order('id')

  // Compute display stats
  const ownedStatic    = Object.values(DEFAULT_COUNTRY_STATUS).filter(t => t.status === 'owned')
  const contestedStatic = Object.values(DEFAULT_COUNTRY_STATUS).filter(t => t.status === 'contested')
  const kingdomValue   = ownedStatic.reduce((s, t) => s + t.value, 0) +
    contestedStatic.reduce((s, t) => s + t.value * 0.5, 0)
  const contestedCount = contestedStatic.length

  const houseName   = profile ? `House of ${profile.username}` : 'House of Aldiyar'
  const houseInitial = profile ? (profile.username[0] ?? 'A').toUpperCase() : 'A'

  // Holdings list (owned + contested from static data for now)
  const holdingsList = Object.entries(DEFAULT_COUNTRY_STATUS)
    .filter(([, v]) => v.status === 'owned' || v.status === 'contested')
    .map(([name, v]) => ({ name, ...v }))

  return (
    <main style={{
      width: '100%', maxWidth: 390, margin: '0 auto',
      minHeight: '100dvh', background: 'var(--bg)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Map — fills upper portion */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340, background: 'var(--bg)' }}>
        <KingdomMapClient
          width={390}
          height={340}
          initialTerritories={territories ?? []}
          currentUserId={user?.id}
          currentUsername={profile?.username ?? ''}
        />
      </div>

      {/* Floating top bar */}
      <div style={{
        position: 'absolute', top: 52, left: 0, right: 0, zIndex: 30,
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <ProfileChip name={profile?.username ?? 'Guest'} initial={houseInitial} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--serif)', fontSize: 20, fontStyle: 'italic',
            letterSpacing: '-0.01em', lineHeight: 1,
          }}>Conquest</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--muted)',
          }}>WORLD ATLAS · LIVE</span>
        </div>
      </div>

      {/* Contested alert pill */}
      {contestedCount > 0 && (
        <div style={{
          position: 'absolute', top: 108, left: '50%', transform: 'translateX(-50%)',
          zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid var(--red)', borderRadius: 999,
          padding: '7px 14px 7px 10px',
          boxShadow: '0 8px 24px rgba(200,49,28,0.18)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 999, background: 'var(--red)',
            boxShadow: '0 0 0 4px rgba(200,49,28,0.18)', display: 'inline-block',
          }} />
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {contestedCount} territor{contestedCount === 1 ? 'y' : 'ies'} under siege
          </span>
        </div>
      )}

      {/* Bottom drawer */}
      <div style={{ position: 'absolute', bottom: 76, left: 0, right: 0, zIndex: 35 }}>
        <BottomDrawer>
          <SheetHandle />

          {/* Kingdom header */}
          <div style={{ padding: '6px 22px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your Kingdom</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{
                fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1,
                letterSpacing: '-0.02em', fontStyle: 'italic',
              }}>{houseName}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>#412 · WORLD</span>
            </div>
          </div>

          {/* Three stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '14px 22px 16px',
            borderTop: '0.5px solid var(--line-soft)',
            borderBottom: '0.5px solid var(--line-soft)',
          }}>
            {[
              { label: 'Holdings',     value: `${ownedStatic.length}`, suffix: `/ ${Object.keys(DEFAULT_COUNTRY_STATUS).length}` },
              { label: 'Crown Value',  value: `${Math.round(kingdomValue)}`, suffix: 'pts' },
              { label: 'Streak',       value: '7', suffix: 'W', color: 'var(--red)' },
            ].map((s, i) => (
              <div key={i} style={{
                borderRight: i < 2 ? '0.5px solid var(--line-soft)' : 'none',
                paddingLeft: i > 0 ? 14 : 0,
                paddingRight: i < 2 ? 12 : 0,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1, marginTop: 4, color: s.color ?? 'var(--ink)' }}>
                  {s.value}
                  {s.suffix && <span style={{ fontFamily: 'var(--mono)', fontSize: s.suffix.length > 3 ? 10 : 13, color: 'var(--muted)', marginLeft: 4 }}>{s.suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Territory list */}
          <div style={{ padding: '14px 22px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Holdings · Today</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em' }}>SEE ALL</span>
            </div>
            {holdingsList.slice(0, 4).map((t, i) => (
              <div key={t.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--line-soft)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                  background: t.status === 'contested' ? 'var(--red)' : 'var(--ink)',
                  boxShadow: t.status === 'contested' ? '0 0 0 3px rgba(200,49,28,0.15)' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.1,
                    letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginTop: 3 }}>
                    {t.status === 'contested' ? 'UNDER SIEGE' : `HELD ${t.held ?? 0}D`}
                  </div>
                </div>
                {t.status === 'contested' ? (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.12em', color: 'var(--red)',
                    padding: '4px 10px', border: '1px solid var(--red)', borderRadius: 999,
                  }}>DEFEND</span>
                ) : (
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>
                    +{Math.round(t.value * 10) / 10}
                  </span>
                )}
              </div>
            ))}
          </div>
        </BottomDrawer>
      </div>

      <TabBar active="map" />
    </main>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd /c/projects/conquest && npm run build 2>&1 | tail -20
```

Expected: clean build. Fix any import errors from deleted hex components.

- [ ] **Step 4: Browser walkthrough**

Open `http://localhost:3000`. Verify:
- Warm cream background
- World map with all countries rendered (cream outlines)
- Owned countries ink-black (France, Germany, UK, USA, Brazil, South Africa)
- Dark-fill enemy countries (Russia, China, Japan, Canada, Australia, Argentina)
- Red pulsing contested territories (Italy, India)
- Labels visible on active countries
- Profile chip + Conquest wordmark floating top
- "2 territories under siege" pill
- Bottom drawer: house name, 3-stat grid, territory list
- Tab bar at bottom

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: Kingdom screen — world map, floating chrome, bottom drawer, tab bar"
```

---

## Task 7: Dynasty Screen

**Files:**
- Create: `app/dynasty/page.tsx`

- [ ] **Step 1: Create dynasty page**

Create `app/dynasty/page.tsx`:

```tsx
import { createServerClient_ } from '@/lib/supabase-server'
import TabBar from '@/components/ui/TabBar'
import { DEFAULT_COUNTRY_STATUS } from '@/lib/world-territories'
import type { Profile } from '@/lib/types'

const RECENT_CAMPAIGNS = [
  { result: 'W' as const, territory: 'France',       vs: 'Korchnoi_IV', delta: '+18', moves: 41 },
  { result: 'W' as const, territory: 'Germany',      vs: 'Anders_1980',  delta: '+11', moves: 64 },
  { result: 'L' as const, territory: 'Italy',        vs: 'AzureCrown',   delta: '−22', moves: 28 },
  { result: 'W' as const, territory: 'South Africa', vs: 'Patricia_K',   delta: '+14', moves: 52 },
]

export default async function DynastyPage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  const owned = Object.entries(DEFAULT_COUNTRY_STATUS)
    .filter(([, v]) => v.status === 'owned')
    .map(([name, v]) => ({ name, ...v }))
  const crownValue = owned.reduce((s, t) => s + t.value, 0)
  const houseName    = profile ? `House of ${profile.username}` : 'House of Aldiyar'
  const houseInitial = profile ? (profile.username[0] ?? 'A').toUpperCase() : 'A'
  const [houseLineA, houseLineB] = houseName.includes(' of ')
    ? [houseName.slice(0, houseName.lastIndexOf(' of ') + 4), houseName.slice(houseName.lastIndexOf(' of ') + 4)]
    : [houseName, '']

  return (
    <main style={{
      width: '100%', maxWidth: 390, margin: '0 auto',
      minHeight: '100dvh', background: 'var(--bg)',
      paddingBottom: 100, overflowY: 'auto',
    }} className="cq-scroll">

      {/* Header */}
      <div style={{ position: 'relative', paddingTop: 88, paddingBottom: 24, paddingLeft: 22, paddingRight: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>House · Founded 2024</div>
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 44, lineHeight: 0.95,
              letterSpacing: '-0.025em', marginTop: 6, fontStyle: 'italic',
            }}>{houseLineA}<br/>{houseLineB}</div>
          </div>
          <div style={{
            width: 72, height: 72, borderRadius: 999,
            background: 'var(--ink)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', flexShrink: 0,
          }}>{houseInitial}</div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="14" viewBox="0 0 24 20" fill="none">
            <path d="M4 4L7 10L12 3L17 10L20 4L19 17L5 17Z" stroke="var(--red)" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            BARONESS · TIER III · #412 · WORLD
          </span>
        </div>
      </div>

      {/* Stats card */}
      <div style={{ margin: '0 16px', background: '#fff', border: '0.5px solid var(--line)', borderRadius: 22, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '0.5px solid var(--line-soft)' }}>
          <div style={{ padding: '16px 18px', borderRight: '0.5px solid var(--line-soft)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Crown Value</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, lineHeight: 1, marginTop: 6 }}>
              {Math.round(crownValue)}<span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>pts</span>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--red)', marginTop: 4, letterSpacing: '0.1em' }}>↑ +12 THIS WEEK</div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>ELO</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, lineHeight: 1, marginTop: 6 }}>1,842</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--red)', marginTop: 4, letterSpacing: '0.1em' }}>↑ +28 (7-DAY)</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            { label: 'Hold',     value: String(owned.length) },
            { label: 'Streak',   value: '7W', color: 'var(--red)' },
            { label: 'Win Rate', value: '64', suffix: '%' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '14px 16px',
              borderRight: i < 2 ? '0.5px solid var(--line-soft)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24, marginTop: 4, color: s.color ?? 'var(--ink)' }}>
                {s.value}
                {s.suffix && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>{s.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings horizontal scroll */}
      <div style={{ padding: '24px 22px 8px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Holdings · {owned.length}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 8px' }} className="cq-scroll">
        {owned.map(t => (
          <div key={t.name} style={{
            flexShrink: 0, width: 120, height: 130,
            background: 'var(--ink)', color: '#fff',
            borderRadius: 14, padding: '12px 12px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>TERRITORY</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.05, marginTop: 6, letterSpacing: '-0.01em' }}>
                {t.name.length > 12 ? t.name.slice(0, 11) + '…' : t.name}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1 }}>
                {Math.round(t.value * 10) / 10}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginLeft: 3 }}>pts</span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', marginTop: 3 }}>
                {t.held ?? 30}D · HELD
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent campaigns */}
      <div style={{ padding: '20px 22px 8px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Campaigns</div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {RECENT_CAMPAIGNS.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 8px',
            borderBottom: i < RECENT_CAMPAIGNS.length - 1 ? '0.5px solid var(--line-soft)' : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: m.result === 'W' ? 'var(--ink)' : 'var(--line)',
              color: m.result === 'W' ? '#fff' : 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic',
            }}>{m.result}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{m.territory}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.1em', marginTop: 3 }}>
                VS {m.vs} · {m.moves} MOVES
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--serif)', fontSize: 18,
              color: m.result === 'W' ? 'var(--red)' : 'var(--muted)',
            }}>{m.delta}</span>
          </div>
        ))}
      </div>

      <TabBar active="dynasty" />
    </main>
  )
}
```

- [ ] **Step 2: Browser check**

Navigate to `http://localhost:3000/dynasty`. Verify: house title, stats card, horizontal territory card scroll, recent campaigns list.

- [ ] **Step 3: Commit**

```bash
git add app/dynasty/page.tsx
git commit -m "feat: Dynasty screen — house stats, holdings carousel, recent campaigns"
```

---

## Task 8: Database Reseed with Real Countries

**Files:**
- Modify: `supabase/seed.sql`

Replace old hex-named territories with real country names matching `DEFAULT_COUNTRY_STATUS` keys. World map countries not in the DB show as neutral (unclaimed) — only seeded countries are "in play".

- [ ] **Step 1: Update supabase/seed.sql territories section**

Find the territories INSERT block in `supabase/seed.sql` and replace it:

```sql
-- Clear old hex territories
DELETE FROM territories;
DELETE FROM challenges;

-- Seed world territories (real countries)
-- hex_q and hex_r are legacy columns — set to 0, position comes from GeoJSON
INSERT INTO territories (name, hex_q, hex_r, owner_id) VALUES
-- Player-owned (start with these 6 when logged in as the main demo account)
('France',         0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Germany',        0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('United Kingdom', 0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('United States',  0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Brazil',         0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('South Africa',   0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
-- Contested (under attack)
('Italy',          0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('India',          0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
-- Enemy-held by bots
('Russia',         0, 0, (SELECT id FROM profiles WHERE username = 'Korchnoi_IV')),
('China',          0, 0, (SELECT id FROM profiles WHERE username = 'TigerOf64')),
('Japan',          0, 0, (SELECT id FROM profiles WHERE username = 'Hoshino')),
('Canada',         0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Australia',      0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Argentina',      0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard'))
ON CONFLICT DO NOTHING;

-- Refresh territory_count for each profile
UPDATE profiles p
SET territory_count = (SELECT COUNT(*) FROM territories WHERE owner_id = p.id);
```

- [ ] **Step 2: Run seed against Supabase**

If using Supabase CLI locally:
```bash
cd /c/projects/conquest && supabase db reset
```

If using remote Supabase: paste the SQL above into the Supabase dashboard SQL editor and run it.

Expected: 14 territory rows, bots own correct countries.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: reseed territories with real-world country names"
```

---

## Task 9: Auth Page Restyle

**Files:**
- Modify: `app/auth/page.tsx`

- [ ] **Step 1: Replace auth page with CQ design**

Replace `app/auth/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 52, fontStyle: 'italic',
          letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)',
        }}>Conquest</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.24em',
          textTransform: 'uppercase', color: 'var(--muted)', marginTop: 8,
        }}>Territory Chess · World Atlas</div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 342,
        background: '#fff', border: '0.5px solid var(--line)',
        borderRadius: 22, padding: '28px 24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.01em' }}>Check your email</div>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
              The sign-in link is on its way.
            </p>
          </div>
        ) : (
          <>
            <button onClick={handleGoogle} style={{
              width: '100%', height: 50, borderRadius: 12,
              background: 'var(--bg)', border: '1px solid var(--line)',
              fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14,
              color: 'var(--ink)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--line)' }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em' }}>OR</span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--line)' }} />
            </div>

            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required
                style={{
                  width: '100%', height: 50, borderRadius: 12,
                  background: 'var(--bg)', border: '1px solid var(--line)',
                  padding: '0 16px', boxSizing: 'border-box',
                  fontFamily: 'var(--sans)', fontSize: 14,
                  color: 'var(--ink)', outline: 'none',
                }}
              />
              <button type="submit" disabled={loading} style={{
                width: '100%', height: 50, borderRadius: 12,
                background: 'var(--ink)', color: '#fff', border: 'none',
                fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </form>
          </>
        )}
      </div>

      <p style={{
        fontFamily: 'var(--serif)', fontSize: 15, fontStyle: 'italic',
        color: 'var(--muted)', marginTop: 36, textAlign: 'center', maxWidth: 280, lineHeight: 1.4,
      }}>Real war, played as chess.</p>
    </div>
  )
}
```

- [ ] **Step 2: Browser check**

Navigate to `http://localhost:3000/auth`. Verify: cream background, large serif wordmark, white card, Google + magic link form.

- [ ] **Step 3: Commit**

```bash
git add app/auth/page.tsx
git commit -m "feat: restyle auth page with CQ palette — serif wordmark, clean card, tagline"
```

---

## Task 10: Final Build Check + Tests

- [ ] **Step 1: Full build**

```bash
cd /c/projects/conquest && npm run build 2>&1 | tail -30
```

Expected: clean build, no TypeScript errors, no missing modules.

- [ ] **Step 2: Run tests**

```bash
cd /c/projects/conquest && npm test 2>&1 | tail -20
```

Expected: 13 hex-utils tests still passing (they are pure math functions, unaffected by this overhaul).

- [ ] **Step 3: End-to-end browser walkthrough**

Golden path:
1. `http://localhost:3000` — world map, 340px tall, owned countries ink-black, contested red pulse, floating chrome, bottom drawer, tab bar
2. Tap France on the map — TerritorySheet slides up, shows "YOURS", value, body copy, Back to Map button
3. Tap Russia — "HELD BY Korchnoi_IV", Challenge CTA
4. Tap an unclaimed neutral country — "UNCLAIMED", Claim Territory CTA
5. Navigate to `/dynasty` — house title, stats card, holdings scroll, campaigns
6. Navigate to `/auth` — clean sign-in form

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Plan 03 — world map mobile redesign, CQ design system"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Mobile-first — `max-width: 390px`, `100dvh`, `env(safe-area-inset-bottom)`, no desktop layout
- [x] Design pixel-by-pixel — CQ palette, Instrument Serif + Manrope + JetBrains Mono, all tokens match design file
- [x] Real-world map — `world-atlas` 110m TopoJSON, all ~177 countries rendered as SVG polygons
- [x] Country ownership overlaid from Supabase territories by name-matching
- [x] Owned/enemy/contested/neutral fills + stroke exactly matching design
- [x] Contested pulse animation (CSS `cq-pulse-dot`)
- [x] Flip animation classes ready (triggered by post-match, Plan 04)
- [x] Territory detail sheet — slides up on country tap, status/name/stats/CTA
- [x] Bottom drawer with kingdom stats (holdings, crown value, streak, territory list)
- [x] Tab bar: Kingdom / Challenge / Dynasty
- [x] Dynasty screen: house title, stats card, holdings carousel, recent campaigns
- [x] Supabase Realtime updates on territory ownership
- [x] Auth page restyled with CQ palette
- [x] TypeScript clean build

**Not in this plan (intentional):**
- Post-match screen with flip animation — wired in Plan 04 (post chess game)
- Challenge modal / Stockfish game — Plan 02 work preserved, invoked via TerritorySheet CTA
- Leaderboard tab — can be added as 4th tab in polish pass
