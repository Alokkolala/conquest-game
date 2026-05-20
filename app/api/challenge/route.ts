import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { NAME_TO_ALPHA2 } from '@/lib/country-codes'

// Derive unique hex coords from a country's alpha-2 code.
// Range [100–2600] × [1–26] never collides with the bot seed's (0, 0).
function hexCoords(name: string): { hex_q: number; hex_r: number } {
  const a2 = NAME_TO_ALPHA2[name] ?? 'xx'
  return {
    hex_q: (a2.charCodeAt(0) - 96) * 100,
    hex_r:  a2.charCodeAt(1) - 96,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { territory_name, defender_id } = await req.json() as {
    territory_name: string
    defender_id: string | null
  }
  if (!territory_name) return NextResponse.json({ error: 'territory_name required' }, { status: 400 })

  const service = createServiceClient()

  // Find existing row, or create one for neutral countries not yet in DB
  let { data: territory } = await service
    .from('territories')
    .select('id')
    .eq('name', territory_name)
    .maybeSingle()

  if (!territory) {
    const { data: created, error: insertErr } = await service
      .from('territories')
      .insert({ name: territory_name, owner_id: null, ...hexCoords(territory_name) })
      .select('id')
      .single()
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    territory = created
  }

  const { data: challenge, error } = await service
    .from('challenges')
    .insert({
      territory_id:   territory.id,
      challenger_id:  user.id,
      defender_id:    defender_id ?? user.id,  // self-challenge for neutral (vs Stockfish)
      status:         'active',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ challenge_id: challenge.id })
}
