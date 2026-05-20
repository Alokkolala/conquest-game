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
    color: '#9b2424',
    countries: ['fr', 'es', 'pt', 'be', 'nl'],  // Western Europe
  },
  {
    username: 'AzureCrown',
    color: '#1a4a8a',
    countries: ['ru', 'ua', 'by', 'pl', 'ro'],  // Eastern Europe
  },
  {
    username: 'VerdantHold',
    color: '#1c6835',
    countries: ['in', 'pk', 'bd', 'mm', 'th'],  // South/Southeast Asia
  },
  {
    username: 'ObsidianPact',
    color: '#4a3520',
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

  return Object.keys(ALPHA2_TO_NAME).map(code => {
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
