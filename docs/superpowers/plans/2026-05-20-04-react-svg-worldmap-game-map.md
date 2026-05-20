# React-SVG-Worldmap Game Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buggy custom TopoJSON/EurasiaMap with `react-svg-worldmap`, add a geographic adjacency system, and wire up claimable/attackable logic with geographically clustered bots.

**Architecture:** Install `react-svg-worldmap` and create a thin `ConquestMap` wrapper that maps game state to the library's `data`/`styleFunction` props. Game logic (adjacency, bot clusters, claimable countries) lives in pure helper files (`lib/country-codes.ts`, `lib/game-state.ts`) so it can be tested independently. `KingdomMapClient` manages live Supabase state and calls into these helpers.

**Tech Stack:** react-svg-worldmap (bundled SVG, ISO alpha-2 codes), TypeScript, Supabase Realtime, Next.js App Router

---

## File Map

| Action | File | Role |
|--------|------|------|
| Create | `lib/country-codes.ts` | ISO alpha-2 ↔ name mapping + NEIGHBORS adjacency graph |
| Create | `lib/game-state.ts` | Pure game logic: claimable/attackable sets, bot cluster definitions, map data builder |
| Create | `components/map/ConquestMap.tsx` | react-svg-worldmap wrapper with styleFunction + onClickFunction |
| Modify | `components/map/KingdomMapClient.tsx` | Swap EurasiaMap → ConquestMap, wire game-state helpers |
| Modify | `lib/types.ts` | Make `path` and `center` optional on CountryFeature (react-svg-worldmap handles rendering) |
| Modify | `supabase/seed.sql` | Geographic bot clusters (W.Europe / E.Europe / S.Asia / Middle East) |
| Modify | `app/page.tsx` | Pass `playerCountryCodes` to KingdomMapClient |
| Delete | `components/map/EurasiaMap.tsx` | Replaced by ConquestMap |
| Delete | `components/map/CountryShape.tsx` | Replaced by ConquestMap |

---

## Task 1: Install react-svg-worldmap + create lib/country-codes.ts

**Files:**
- Run: `npm install react-svg-worldmap`
- Create: `lib/country-codes.ts`

- [ ] **Step 1: Install package**

```bash
cd C:/projects/conquest && npm install react-svg-worldmap
```

Expected: `added 1 package` (no peer dep warnings — it requires React >=16.8 which is satisfied)

- [ ] **Step 2: Verify import works**

```bash
node -e "require('./node_modules/react-svg-worldmap/dist/index.cjs.js')" 2>&1 | head -3
```

Expected: no error (or benign React peer warning)

- [ ] **Step 3: Create lib/country-codes.ts**

```typescript
// lib/country-codes.ts
// ISO 3166-1 alpha-2 ↔ display name mapping
// react-svg-worldmap uses lowercase alpha-2 codes like "fr", "de", "cn"

export const ALPHA2_TO_NAME: Record<string, string> = {
  af: 'Afghanistan', al: 'Albania', dz: 'Algeria', ao: 'Angola', ar: 'Argentina',
  am: 'Armenia', au: 'Australia', at: 'Austria', az: 'Azerbaijan', bh: 'Bahrain',
  bd: 'Bangladesh', by: 'Belarus', be: 'Belgium', bj: 'Benin', bt: 'Bhutan',
  bo: 'Bolivia', ba: 'Bosnia', bw: 'Botswana', br: 'Brazil', bg: 'Bulgaria',
  bf: 'Burkina Faso', bi: 'Burundi', kh: 'Cambodia', cm: 'Cameroon', ca: 'Canada',
  cf: 'C.African Rep.', td: 'Chad', cl: 'Chile', cn: 'China', co: 'Colombia',
  cd: 'DR Congo', cg: 'Congo', cr: 'Costa Rica', hr: 'Croatia', cu: 'Cuba',
  cy: 'Cyprus', cz: 'Czech Rep.', dk: 'Denmark', dj: 'Djibouti', ec: 'Ecuador',
  eg: 'Egypt', sv: 'El Salvador', er: 'Eritrea', ee: 'Estonia', et: 'Ethiopia',
  fi: 'Finland', fr: 'France', ga: 'Gabon', de: 'Germany', gh: 'Ghana',
  gr: 'Greece', gt: 'Guatemala', gn: 'Guinea', ht: 'Haiti', hn: 'Honduras',
  hu: 'Hungary', in: 'India', id: 'Indonesia', ir: 'Iran', iq: 'Iraq',
  ie: 'Ireland', il: 'Israel', it: 'Italy', jm: 'Jamaica', jp: 'Japan',
  jo: 'Jordan', kz: 'Kazakhstan', ke: 'Kenya', kp: 'North Korea', kr: 'South Korea',
  kw: 'Kuwait', kg: 'Kyrgyzstan', la: 'Laos', lv: 'Latvia', lb: 'Lebanon',
  lr: 'Liberia', ly: 'Libya', lt: 'Lithuania', lu: 'Luxembourg', mg: 'Madagascar',
  mw: 'Malawi', my: 'Malaysia', ml: 'Mali', mr: 'Mauritania', mx: 'Mexico',
  md: 'Moldova', mn: 'Mongolia', ma: 'Morocco', mz: 'Mozambique', mm: 'Myanmar',
  na: 'Namibia', np: 'Nepal', nl: 'Netherlands', nz: 'New Zealand', ni: 'Nicaragua',
  ne: 'Niger', ng: 'Nigeria', mk: 'North Macedonia', no: 'Norway', om: 'Oman',
  pk: 'Pakistan', pa: 'Panama', py: 'Paraguay', pe: 'Peru', ph: 'Philippines',
  pl: 'Poland', pt: 'Portugal', qa: 'Qatar', ro: 'Romania', ru: 'Russia',
  rw: 'Rwanda', sa: 'Saudi Arabia', sn: 'Senegal', rs: 'Serbia', sl: 'Sierra Leone',
  so: 'Somalia', za: 'South Africa', ss: 'South Sudan', es: 'Spain', lk: 'Sri Lanka',
  sd: 'Sudan', se: 'Sweden', ch: 'Switzerland', sy: 'Syria', tw: 'Taiwan',
  tj: 'Tajikistan', tz: 'Tanzania', th: 'Thailand', tg: 'Togo', tn: 'Tunisia',
  tr: 'Turkey', tm: 'Turkmenistan', ug: 'Uganda', ua: 'Ukraine', ae: 'UAE',
  gb: 'United Kingdom', us: 'United States', uy: 'Uruguay', uz: 'Uzbekistan',
  ve: 'Venezuela', vn: 'Vietnam', ye: 'Yemen', zm: 'Zambia', zw: 'Zimbabwe',
}

export const NAME_TO_ALPHA2: Record<string, string> = Object.fromEntries(
  Object.entries(ALPHA2_TO_NAME).map(([k, v]) => [v, k])
)

// Land border adjacency — key country borders all values
// Focuses on Europe, Asia, Africa, Americas where the game is played
export const NEIGHBORS: Record<string, string[]> = {
  // Western Europe
  fr: ['es', 'be', 'lu', 'de', 'ch', 'it'],
  es: ['fr', 'pt', 'ma'],
  pt: ['es'],
  be: ['fr', 'lu', 'nl', 'de'],
  nl: ['be', 'de'],
  lu: ['fr', 'be', 'de'],
  de: ['fr', 'be', 'nl', 'lu', 'ch', 'at', 'cz', 'pl', 'dk'],
  ch: ['fr', 'de', 'at', 'it'],
  at: ['de', 'ch', 'it', 'si', 'sk', 'hu', 'cz'],
  it: ['fr', 'ch', 'at', 'si'],
  dk: ['de'],
  no: ['se', 'fi', 'ru'],
  se: ['no', 'fi'],
  fi: ['no', 'se', 'ru'],
  ie: ['gb'],
  gb: ['ie', 'fr'],  // channel tunnel

  // Eastern Europe
  pl: ['de', 'cz', 'sk', 'ua', 'by', 'lt', 'ru'],
  cz: ['de', 'at', 'sk', 'pl'],
  sk: ['cz', 'at', 'hu', 'pl', 'ua'],
  hu: ['at', 'sk', 'ro', 'rs', 'hr', 'si', 'ua'],
  ro: ['hu', 'md', 'ua', 'bg', 'rs'],
  bg: ['ro', 'rs', 'mk', 'gr', 'tr'],
  rs: ['hu', 'ro', 'bg', 'mk', 'ba', 'hr', 'me', 'al'],
  hr: ['si', 'hu', 'rs', 'ba'],
  ba: ['hr', 'rs', 'me'],
  si: ['it', 'at', 'hu', 'hr'],
  mk: ['rs', 'bg', 'gr', 'al'],
  al: ['rs', 'mk', 'gr'],
  gr: ['al', 'mk', 'bg', 'tr'],
  ua: ['ro', 'md', 'hu', 'sk', 'pl', 'by', 'ru'],
  md: ['ro', 'ua'],
  by: ['pl', 'lt', 'lv', 'ua', 'ru'],
  lt: ['pl', 'by', 'lv'],
  lv: ['lt', 'ee', 'by', 'ru'],
  ee: ['lv', 'ru'],
  ru: ['no', 'fi', 'ee', 'lv', 'lt', 'pl', 'by', 'ua', 'ge', 'az', 'kz', 'cn', 'mn', 'kp'],

  // Caucasus
  ge: ['ru', 'tr', 'am', 'az'],
  am: ['ge', 'tr', 'az', 'ir'],
  az: ['ge', 'am', 'ru', 'ir', 'tr'],

  // Middle East
  tr: ['ge', 'am', 'az', 'ir', 'iq', 'sy', 'gr', 'bg'],
  sy: ['tr', 'lb', 'il', 'jo', 'iq'],
  lb: ['sy', 'il'],
  il: ['lb', 'sy', 'jo', 'eg'],
  jo: ['il', 'sy', 'iq', 'sa'],
  iq: ['tr', 'sy', 'jo', 'sa', 'kw', 'ir'],
  ir: ['tr', 'am', 'az', 'tm', 'af', 'pk', 'iq'],
  kw: ['iq', 'sa'],
  sa: ['jo', 'iq', 'kw', 'ae', 'om', 'ye'],
  ae: ['sa', 'om'],
  om: ['ae', 'sa', 'ye'],
  ye: ['sa', 'om'],
  qa: ['sa'],

  // Central Asia
  kz: ['ru', 'cn', 'kg', 'uz', 'tm'],
  uz: ['kz', 'kg', 'tj', 'af', 'tm'],
  tm: ['kz', 'uz', 'af', 'ir'],
  kg: ['kz', 'cn', 'tj', 'uz'],
  tj: ['kg', 'cn', 'af', 'uz'],
  af: ['tm', 'uz', 'tj', 'cn', 'pk', 'ir'],

  // South Asia
  pk: ['ir', 'af', 'cn', 'in'],
  in: ['pk', 'cn', 'np', 'bt', 'bd', 'mm'],
  np: ['in', 'cn'],
  bt: ['in', 'cn'],
  bd: ['in', 'mm'],
  lk: ['in'],  // sea border — treated as adjacent for gameplay
  mm: ['in', 'bd', 'cn', 'la', 'th'],

  // Southeast Asia
  th: ['mm', 'la', 'kh', 'my'],
  la: ['mm', 'cn', 'vn', 'kh', 'th'],
  vn: ['cn', 'la', 'kh'],
  kh: ['th', 'la', 'vn'],
  my: ['th', 'id'],
  id: ['my', 'pg'],
  ph: ['my'],
  pg: ['id', 'au'],

  // East Asia
  cn: ['ru', 'mn', 'kz', 'kg', 'tj', 'af', 'pk', 'in', 'np', 'bt', 'mm', 'la', 'vn', 'kp'],
  mn: ['ru', 'cn'],
  kp: ['ru', 'cn', 'kr'],
  kr: ['kp'],
  jp: ['kr'],  // sea border

  // Africa
  eg: ['il', 'ly', 'sd'],
  ly: ['eg', 'tn', 'dz', 'ne', 'td', 'sd'],
  tn: ['ly', 'dz'],
  dz: ['tn', 'ly', 'ne', 'ml', 'mr', 'ma'],
  ma: ['dz', 'es'],
  mr: ['dz', 'ml', 'sn'],
  ml: ['dz', 'ne', 'bf', 'gn', 'sn', 'mr'],
  ne: ['ly', 'dz', 'ml', 'bf', 'ng', 'td'],
  td: ['ly', 'ne', 'ng', 'cm', 'cf', 'sd'],
  sd: ['eg', 'ly', 'td', 'cf', 'ss', 'et', 'er'],
  ss: ['sd', 'et', 'ke', 'ug', 'cd', 'cf'],
  et: ['er', 'dj', 'so', 'ke', 'ss', 'sd'],
  er: ['et', 'dj', 'sd'],
  dj: ['er', 'et', 'so'],
  so: ['dj', 'et', 'ke'],
  ke: ['et', 'so', 'ug', 'tz', 'ss'],
  ug: ['ss', 'ke', 'tz', 'rw', 'bi', 'cd'],
  tz: ['ke', 'ug', 'rw', 'bi', 'mw', 'zm', 'mz', 'cd'],
  rw: ['ug', 'tz', 'bi', 'cd'],
  bi: ['rw', 'cd', 'tz'],
  cd: ['cf', 'ss', 'ug', 'rw', 'bi', 'tz', 'zm', 'ao', 'cg'],
  cg: ['cm', 'cf', 'cd', 'ga', 'ao'],
  cf: ['td', 'sd', 'ss', 'cd', 'cg', 'cm'],
  cm: ['ng', 'td', 'cf', 'cg', 'ga'],
  ng: ['ne', 'td', 'cm', 'bj'],
  bj: ['ng', 'bf', 'tg', 'ne'],
  tg: ['bj', 'gh', 'bf'],
  gh: ['tg', 'ci', 'bf'],
  bf: ['ml', 'ne', 'bj', 'tg', 'gh', 'ci'],
  ci: ['bf', 'ml', 'gn', 'lr', 'gh'],
  gn: ['ml', 'sl', 'lr', 'ci', 'sn'],
  sl: ['gn', 'lr'],
  lr: ['sl', 'gn', 'ci'],
  sn: ['mr', 'ml', 'gn'],
  ga: ['cm', 'cg', 'ao'],
  ao: ['ga', 'cg', 'cd', 'na', 'zm'],
  na: ['ao', 'zm', 'bw', 'za'],
  zm: ['ao', 'cd', 'tz', 'mw', 'mz', 'zw', 'bw', 'na'],
  zw: ['zm', 'bw', 'mz', 'za'],
  bw: ['na', 'zm', 'zw', 'za'],
  mz: ['tz', 'zm', 'mw', 'zw', 'za'],
  mw: ['tz', 'zm', 'mz'],
  za: ['na', 'bw', 'zw', 'mz'],
  mg: ['mz'],  // sea border

  // Americas
  us: ['ca', 'mx'],
  ca: ['us'],
  mx: ['us', 'gt'],
  gt: ['mx', 'bz', 'hn', 'sv'],
  bz: ['mx', 'gt'],
  hn: ['gt', 'sv', 'ni'],
  sv: ['gt', 'hn'],
  ni: ['hn', 'cr'],
  cr: ['ni', 'pa'],
  pa: ['cr', 'co'],
  co: ['pa', 've', 'br', 'pe', 'ec'],
  ec: ['co', 'pe'],
  ve: ['co', 'br', 'gy'],
  gy: ['ve', 'br', 'sr'],
  sr: ['gy', 'br'],
  br: ['ve', 'gy', 'sr', 'bo', 'pe', 'co', 'ar', 'uy', 'py'],
  pe: ['ec', 'co', 'br', 'bo', 'cl'],
  bo: ['br', 'pe', 'cl', 'ar', 'py'],
  cl: ['pe', 'bo', 'ar'],
  ar: ['cl', 'bo', 'br', 'py', 'uy'],
  py: ['br', 'bo', 'ar'],
  uy: ['br', 'ar'],
}
```

- [ ] **Step 4: Commit**

```bash
cd C:/projects/conquest
git add lib/country-codes.ts
git commit -m "feat: add ISO alpha-2 country codes + adjacency graph"
```

---

## Task 2: Create lib/game-state.ts

**Files:**
- Create: `lib/game-state.ts`

- [ ] **Step 1: Create lib/game-state.ts**

```typescript
// lib/game-state.ts
// Pure game logic — no React, no Supabase imports
// All functions are deterministic given their inputs

import { NEIGHBORS, ALPHA2_TO_NAME } from './country-codes'

// ── Bot territory clusters (geographic) ───────────────────────
export interface BotCluster {
  username: string
  color: string      // CSS color for map display
  countries: string[] // ISO alpha-2 codes
}

export const BOT_CLUSTERS: BotCluster[] = [
  {
    username: 'CrimsonGuard',
    color: '#8b2020',
    countries: ['fr', 'es', 'pt', 'be', 'nl'],  // Western Europe
  },
  {
    username: 'AzureCrown',
    color: '#1a3a6b',
    countries: ['ru', 'ua', 'by', 'pl', 'ro'],  // Eastern Europe
  },
  {
    username: 'VerdantHold',
    color: '#1a5c2a',
    countries: ['in', 'pk', 'bd', 'mm', 'th'],  // South/Southeast Asia
  },
  {
    username: 'ObsidianPact',
    color: '#3a2a1a',
    countries: ['tr', 'ir', 'iq', 'sa', 'eg'],  // Middle East
  },
]

// Build a lookup: alpha-2 → bot username
export function buildBotOwnerMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const bot of BOT_CLUSTERS) {
    for (const code of bot.countries) {
      map[code] = bot.username
    }
  }
  return map
}

// Build a lookup: alpha-2 → bot color
export function buildBotColorMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const bot of BOT_CLUSTERS) {
    for (const code of bot.countries) {
      map[code] = bot.color
    }
  }
  return map
}

// ── Game state derivation ──────────────────────────────────────

export type GameCountryStatus = 'player' | 'bot' | 'claimable' | 'attackable' | 'neutral'

export interface GameCountryState {
  code: string          // ISO alpha-2
  name: string
  status: GameCountryStatus
  ownerUsername?: string
  botColor?: string
}

/**
 * Compute the status of every country given:
 * - playerCodes: countries the current player owns
 * - botOwnerMap: alpha-2 → bot username (from territories table)
 * - isNewUser: first-time player, can claim any neutral country
 */
export function buildGameState(
  playerCodes: string[],
  botOwnerMap: Record<string, string>,
  isNewUser: boolean,
): GameCountryState[] {
  const playerSet = new Set(playerCodes)
  const botSet = new Set(Object.keys(botOwnerMap))
  const botColorMap = buildBotColorMap()

  // Countries adjacent to player territories
  const adjacentToPlayer = new Set<string>()
  for (const code of playerCodes) {
    for (const neighbor of (NEIGHBORS[code] ?? [])) {
      if (!playerSet.has(neighbor)) {
        adjacentToPlayer.add(neighbor)
      }
    }
  }

  // All known codes: player + bot + neighbors
  const allKnown = new Set([...playerSet, ...botSet, ...adjacentToPlayer])

  return Array.from(allKnown).map(code => {
    const name = ALPHA2_TO_NAME[code] ?? code.toUpperCase()

    if (playerSet.has(code)) {
      return { code, name, status: 'player' as const }
    }
    if (botSet.has(code)) {
      const ownerUsername = botOwnerMap[code]
      const isAttackable = adjacentToPlayer.has(code)
      return {
        code, name,
        status: isAttackable ? 'attackable' as const : 'bot' as const,
        ownerUsername,
        botColor: botColorMap[code],
      }
    }
    // Neutral — claimable if adjacent to player OR new user (no territories yet)
    const isClaimable = isNewUser || adjacentToPlayer.has(code)
    return { code, name, status: isClaimable ? 'claimable' as const : 'neutral' as const }
  })
}

/**
 * Build the data array for react-svg-worldmap.
 * react-svg-worldmap uses { country: string, value: number }.
 * We encode status as a number so styleFunction can read it.
 *
 * Encoding: 0=neutral, 1=player, 2=bot, 3=claimable, 4=attackable
 */
export const STATUS_ENCODING: Record<GameCountryStatus, number> = {
  neutral:    0,
  player:     1,
  bot:        2,
  claimable:  3,
  attackable: 4,
}

export function buildMapData(
  gameState: GameCountryState[],
): { country: string; value: number }[] {
  return gameState.map(s => ({
    country: s.code,
    value: STATUS_ENCODING[s.status],
  }))
}

/**
 * Get all countries that can be claimed (neutral, adjacent to player, or new user)
 */
export function getClaimableCountries(
  playerCodes: string[],
  botOwnerMap: Record<string, string>,
  isNewUser: boolean,
): string[] {
  return buildGameState(playerCodes, botOwnerMap, isNewUser)
    .filter(s => s.status === 'claimable')
    .map(s => s.code)
}

/**
 * Get all bot-owned countries that can be attacked (adjacent to player territory)
 */
export function getAttackableCountries(
  playerCodes: string[],
  botOwnerMap: Record<string, string>,
): string[] {
  return buildGameState(playerCodes, botOwnerMap, false)
    .filter(s => s.status === 'attackable')
    .map(s => s.code)
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/projects/conquest
git add lib/game-state.ts
git commit -m "feat: add pure game-state helpers (claimable/attackable/bot clusters)"
```

---

## Task 3: Create components/map/ConquestMap.tsx

**Files:**
- Install: `npm install react-svg-worldmap` (may already be done from Task 1)
- Create: `components/map/ConquestMap.tsx`

- [ ] **Step 1: Create ConquestMap.tsx**

```tsx
// components/map/ConquestMap.tsx
'use client'

import { useMemo } from 'react'
import WorldMap from 'react-svg-worldmap'
import { buildGameState, buildMapData, buildBotColorMap } from '@/lib/game-state'
import { ALPHA2_TO_NAME } from '@/lib/country-codes'
import type { CountryFeature, TerritoryStatus } from '@/lib/types'

interface Props {
  playerCodes: string[]         // ISO alpha-2 codes the player owns
  botOwnerMap: Record<string, string>  // alpha-2 → bot username (from DB)
  currentUsername: string
  isNewUser: boolean
  size?: string | number        // react-svg-worldmap size: 'sm','md','lg','xl','xxl' or px
  onCountryClick?: (feature: CountryFeature) => void
}

// Map game status to fill colors
const STATUS_COLORS = {
  player:     '#111111',   // --ink
  bot:        '#3a2a2a',   // dark enemy — desaturated
  claimable:  '#b89758',   // --gold — actionable
  attackable: '#8b2020',   // --red — danger/opportunity
  neutral:    '#ece8df',   // warm off-white
}

export default function ConquestMap({
  playerCodes,
  botOwnerMap,
  currentUsername,
  isNewUser,
  size = 'xxl',
  onCountryClick,
}: Props) {
  const botColorMap = useMemo(() => buildBotColorMap(), [])

  const gameState = useMemo(
    () => buildGameState(playerCodes, botOwnerMap, isNewUser),
    [playerCodes, botOwnerMap, isNewUser]
  )

  const stateByCode = useMemo(() => {
    const map: Record<string, typeof gameState[number]> = {}
    for (const s of gameState) map[s.code] = s
    return map
  }, [gameState])

  const mapData = useMemo(() => buildMapData(gameState), [gameState])

  // react-svg-worldmap styleFunction: called per country
  // context.countryCode is lowercase alpha-2, context.countryValue is our encoding
  function styleFunction(context: {
    countryCode: string
    countryValue?: number
    minValue: number
    maxValue: number
    color: string
  }) {
    const code = context.countryCode.toLowerCase()
    const state = stateByCode[code]

    let fill = STATUS_COLORS.neutral
    let stroke = '#d0c8bc'
    let strokeWidth = 0.5
    let cursor = 'default'

    if (state) {
      switch (state.status) {
        case 'player':
          fill = STATUS_COLORS.player
          stroke = '#333'
          strokeWidth = 1
          break
        case 'bot':
          fill = botColorMap[code] ?? STATUS_COLORS.bot
          stroke = '#222'
          strokeWidth = 0.8
          break
        case 'claimable':
          fill = '#f4f0e6'
          stroke = STATUS_COLORS.claimable
          strokeWidth = 1.5
          cursor = 'pointer'
          break
        case 'attackable':
          fill = '#3a1a1a'
          stroke = STATUS_COLORS.attackable
          strokeWidth = 1.5
          cursor = 'pointer'
          break
        case 'neutral':
        default:
          fill = STATUS_COLORS.neutral
          stroke = '#d0c8bc'
          strokeWidth = 0.5
      }
    }

    return {
      fill,
      stroke,
      strokeWidth,
      cursor,
      fillOpacity: 1,
    }
  }

  // react-svg-worldmap onClickFunction: called on country click
  function handleClick(
    event: React.MouseEvent<SVGElement, MouseEvent>,
    countryCode: string,
    countryName: string,
    countryValue: number | undefined,
  ) {
    if (!onCountryClick) return

    const code = countryCode.toLowerCase()
    const state = stateByCode[code]

    // Only allow clicking claimable or attackable countries
    if (!state || (state.status !== 'claimable' && state.status !== 'attackable' && state.status !== 'player')) {
      return
    }

    // Build a CountryFeature-compatible object
    // path/center are left empty — rendering is handled by react-svg-worldmap
    const feature: CountryFeature = {
      id: code,
      name: ALPHA2_TO_NAME[code] ?? countryName,
      path: '',
      center: [0, 0],
      status: state.status === 'player' ? 'owned'
            : state.status === 'bot' || state.status === 'attackable' ? 'enemy'
            : 'neutral',
      owner: state.ownerUsername,
      value: 1,
    }

    onCountryClick(feature)
  }

  return (
    <div style={{
      width: '100%',
      background: 'var(--bg)',
      borderRadius: 0,
      overflow: 'hidden',
    }}>
      <WorldMap
        color="#b89758"
        backgroundColor="var(--bg)"
        size={size}
        data={mapData}
        styleFunction={styleFunction}
        onClickFunction={handleClick}
        tooltipTextFunction={(context: { countryCode: string; countryName: string; countryValue?: number }) => {
          const code = context.countryCode.toLowerCase()
          const state = stateByCode[code]
          if (!state) return context.countryName
          const statusLabel = {
            player: `Yours`,
            bot: `${state.ownerUsername ?? 'Enemy'} territory`,
            claimable: 'Click to claim',
            attackable: `Attack ${state.ownerUsername ?? 'enemy'}`,
            neutral: context.countryName,
          }
          return `${ALPHA2_TO_NAME[code] ?? context.countryName} — ${statusLabel[state.status]}`
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/projects/conquest
git add components/map/ConquestMap.tsx
git commit -m "feat: add ConquestMap component wrapping react-svg-worldmap"
```

---

## Task 4: Update lib/types.ts + KingdomMapClient.tsx

**Files:**
- Modify: `lib/types.ts` — make `path` and `center` optional
- Modify: `components/map/KingdomMapClient.tsx` — swap EurasiaMap → ConquestMap

- [ ] **Step 1: Update lib/types.ts**

In `lib/types.ts`, change `CountryFeature` to make path and center optional:

```typescript
export interface CountryFeature {
  id: string            // ISO alpha-2 code e.g. "fr"
  name: string          // display name e.g. "France"
  path?: string         // SVG path — only populated when using custom map rendering
  center?: [number, number]   // SVG [x, y] centroid — only populated when using custom map rendering
  status: TerritoryStatus
  owner?: string        // username of owner (for enemy/contested)
  ownerElo?: number
  value: number         // crown points
  held?: number         // days held (for owned territories)
}
```

- [ ] **Step 2: Update KingdomMapClient.tsx**

Replace the full contents of `components/map/KingdomMapClient.tsx`:

```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import ConquestMap from './ConquestMap'
import TerritorySheet from './TerritorySheet'
import type { Territory, CountryFeature } from '@/lib/types'
import { NAME_TO_ALPHA2 } from '@/lib/country-codes'
import { buildBotOwnerMap } from '@/lib/game-state'

interface Props {
  initialTerritories: Territory[]
  currentUserId?: string
  currentUsername?: string
  isNewUser?: boolean
}

export default function KingdomMapClient({
  initialTerritories,
  currentUserId: _currentUserId,
  currentUsername = '',
  isNewUser = false,
}: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const supabase = useMemo(() => createClient(), [])

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

  // Player's country codes (alpha-2)
  const playerCodes = useMemo(() => {
    return territories
      .filter(t => t.owner?.username === currentUsername)
      .map(t => NAME_TO_ALPHA2[t.name] ?? t.name.toLowerCase().slice(0, 2))
      .filter(Boolean)
  }, [territories, currentUsername])

  // Bot owner map from live territories: alpha-2 → bot username
  const liveBotOwnerMap = useMemo(() => {
    const staticBotMap = buildBotOwnerMap()
    const liveMap: Record<string, string> = { ...staticBotMap }
    // Override with live DB state
    for (const t of territories) {
      const code = NAME_TO_ALPHA2[t.name]
      if (code && t.owner?.username && t.owner.username !== currentUsername) {
        liveMap[code] = t.owner.username
      }
    }
    return liveMap
  }, [territories, currentUsername])

  return (
    <>
      <ConquestMap
        playerCodes={playerCodes}
        botOwnerMap={liveBotOwnerMap}
        currentUsername={currentUsername}
        isNewUser={isNewUser}
        size="xxl"
        onCountryClick={setSelected}
      />
      {selected && (
        <TerritorySheet
          feature={selected}
          isNewUser={isNewUser}
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

- [ ] **Step 3: Commit**

```bash
cd C:/projects/conquest
git add lib/types.ts components/map/KingdomMapClient.tsx
git commit -m "feat: wire KingdomMapClient to ConquestMap with live game-state"
```

---

## Task 5: Update supabase/seed.sql + app/page.tsx

**Files:**
- Modify: `supabase/seed.sql` — geographic bot clusters matching BOT_CLUSTERS in game-state.ts
- Modify: `app/page.tsx` — pass `playerCountryCodes` if needed, remove old width/height props

- [ ] **Step 1: Update supabase/seed.sql**

Replace the content of `supabase/seed.sql`:

```sql
-- Clear old data
DELETE FROM challenges;
DELETE FROM territories;

-- Seed world territories matching BOT_CLUSTERS in lib/game-state.ts
-- CrimsonGuard = Western Europe (fr, es, pt, be, nl)
INSERT INTO territories (name, hex_q, hex_r, owner_id) VALUES
('France',       0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Spain',        0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Portugal',     0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Belgium',      0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Netherlands',  0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),

-- AzureCrown = Eastern Europe (ru, ua, by, pl, ro)
('Russia',       0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Ukraine',      0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Belarus',      0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Poland',       0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Romania',      0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),

-- VerdantHold = South/SE Asia (in, pk, bd, mm, th)
('India',        0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Pakistan',     0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Bangladesh',   0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Myanmar',      0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Thailand',     0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),

-- ObsidianPact = Middle East (tr, ir, iq, sa, eg)
('Turkey',       0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Iran',         0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Iraq',         0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Saudi Arabia', 0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Egypt',        0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact'))

ON CONFLICT DO NOTHING;

-- Refresh territory_count for each profile
UPDATE profiles p
SET territory_count = (SELECT COUNT(*) FROM territories WHERE owner_id = p.id);
```

- [ ] **Step 2: Update app/page.tsx to remove width/height props**

In `app/page.tsx`, find the `<KingdomMapClient` usage and remove `width` and `height` props since `ConquestMap` uses responsive `size="xxl"` instead:

Current call (find and update):
```tsx
<KingdomMapClient
  width={390}
  height={250}
  initialTerritories={territories}
  currentUserId={user?.id}
  currentUsername={profile?.username ?? ''}
  isNewUser={isNewUser}
/>
```

Update to:
```tsx
<KingdomMapClient
  initialTerritories={territories}
  currentUserId={user?.id}
  currentUsername={profile?.username ?? ''}
  isNewUser={isNewUser}
/>
```

Also remove `width` and `height` from the `Props` interface at the top of `KingdomMapClient.tsx` if not already done.

- [ ] **Step 3: Run seed in Supabase dashboard**

The seed must be re-run in Supabase SQL editor. Remind the developer:
```
Open Supabase dashboard → SQL Editor → paste contents of supabase/seed.sql → Run
```

- [ ] **Step 4: Commit**

```bash
cd C:/projects/conquest
git add supabase/seed.sql app/page.tsx
git commit -m "feat: geographic bot clusters in seed + update page props"
```

---

## Task 6: Cleanup old map files + build check

**Files:**
- Delete: `components/map/EurasiaMap.tsx`
- Delete: `components/map/CountryShape.tsx`
- Delete (optional): `components/map/WorldMap.tsx` (older TopoJSON world map — only delete if not referenced)

- [ ] **Step 1: Check for any remaining imports of old files**

```bash
cd C:/projects/conquest
grep -r "EurasiaMap\|CountryShape\|WorldMap" --include="*.tsx" --include="*.ts" -l
```

Expected: only files that don't import them (or this list is empty).
If any files still import them, update those imports first before deleting.

- [ ] **Step 2: Delete old map components**

```bash
cd C:/projects/conquest
rm components/map/EurasiaMap.tsx
rm components/map/CountryShape.tsx
```

Delete `components/map/WorldMap.tsx` only if the grep in Step 1 shows it's not imported anywhere:
```bash
# Only run if WorldMap.tsx is not imported anywhere
rm components/map/WorldMap.tsx
```

- [ ] **Step 3: Run TypeScript build check**

```bash
cd C:/projects/conquest
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors. If there are errors:
- `Property 'path' does not exist` → check `lib/types.ts` has `path?:` (optional)
- `Property 'center' does not exist` → check `lib/types.ts` has `center?:`
- Import errors for deleted files → remove the import from the referencing file

- [ ] **Step 4: Start dev server and verify map renders**

```bash
cd C:/projects/conquest
npm run dev
```

Open http://localhost:3000 and verify:
- World map renders (colored countries visible)
- CrimsonGuard cluster (France, Spain, Portugal, Belgium, Netherlands) shown in their color
- AzureCrown cluster (Russia, Ukraine, Belarus, Poland, Romania) shown in their color
- VerdantHold (India, Pakistan, Bangladesh, Myanmar, Thailand) shown in their color
- ObsidianPact (Turkey, Iran, Iraq, Saudi Arabia, Egypt) shown in their color
- Hovering a claimable/attackable country shows tooltip
- Clicking a claimable country opens TerritorySheet

- [ ] **Step 5: Commit**

```bash
cd C:/projects/conquest
git add -A
git commit -m "chore: remove legacy EurasiaMap/CountryShape, world map migration complete"
```

---

## Self-Review

### Spec coverage
- ✅ Login → pick a country (isNewUser=true → all neutral countries are claimable)
- ✅ Click nearer areas to claim (adjacency graph in NEIGHBORS, getClaimableCountries)
- ✅ Bots own geographic clusters (BOT_CLUSTERS, seed.sql)
- ✅ Attack bot countries when adjacent (getAttackableCountries, status='attackable')
- ✅ react-svg-worldmap replaces buggy EurasiaMap
- ✅ TerritorySheet preserved for claim/challenge flows
- ✅ Supabase Realtime still works (in KingdomMapClient)

### Type consistency
- `CountryFeature.id` is ISO alpha-2 throughout (was ISO numeric before)
- `CountryFeature.path` and `.center` are optional — ConquestMap leaves them empty
- `GameCountryStatus` ('player'|'bot'|'claimable'|'attackable'|'neutral') is separate from `TerritoryStatus` ('owned'|'enemy'|'contested'|'neutral') — conversion happens in ConquestMap handleClick
- `BOT_CLUSTERS` in game-state.ts matches seed.sql country names exactly

### Potential issues
- `NAME_TO_ALPHA2` must have entries for all country names in the DB (France → fr, etc.). The ALPHA2_TO_NAME map covers all seeded countries.
- react-svg-worldmap `countryCode` in callbacks may be uppercase — `code.toLowerCase()` guards this.
