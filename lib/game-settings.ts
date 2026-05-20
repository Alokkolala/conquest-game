// Persistent game settings stored in localStorage.
// Readable by any client component; written only by AdminPanel.

export interface GameSettings {
  claimDepth: number      // Stockfish depth for neutral territory claims  (1–20)
  attackDepth: number     // Stockfish depth for bot territory attacks      (1–20)
  mapAnimations: boolean  // Pulse animations on claimable/attackable tiles
  playerColor: 'w' | 'b' | 'random'  // Preferred side in new games
}

const DEFAULTS: GameSettings = {
  claimDepth: 5,
  attackDepth: 12,
  mapAnimations: true,
  playerColor: 'w',
}

const KEY = 'cq_settings'

export function getGameSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function patchGameSettings(patch: Partial<GameSettings>): GameSettings {
  const next = { ...getGameSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function resetGameSettings(): GameSettings {
  localStorage.removeItem(KEY)
  return DEFAULTS
}

/** Human-readable label for a Stockfish depth value */
export function depthLabel(depth: number): string {
  if (depth <= 2)  return 'Beginner'
  if (depth <= 5)  return 'Easy'
  if (depth <= 9)  return 'Medium'
  if (depth <= 13) return 'Hard'
  if (depth <= 17) return 'Expert'
  return 'Master'
}
