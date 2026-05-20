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
  path?: string          // SVG path string
  center?: [number, number]   // SVG [x, y] centroid
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
