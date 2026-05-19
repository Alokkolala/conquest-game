export interface Profile {
  id: string
  username: string
  display_color: string
  territory_count: number
  created_at: string
}

export interface Territory {
  id: number
  name: string
  hex_q: number
  hex_r: number
  owner_id: string | null
  owner?: Profile | null
  created_at: string
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
