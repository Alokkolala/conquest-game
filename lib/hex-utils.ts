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
