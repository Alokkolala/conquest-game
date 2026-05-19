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
