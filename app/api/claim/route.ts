import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { NAME_TO_ALPHA2 } from '@/lib/country-codes'

// Derive unique hex coords from a country's alpha-2 code.
// Formula keeps values in [100–2600] × [1–26], never colliding with
// the legacy bot seed which uses (0, 0) with ON CONFLICT DO NOTHING.
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

  const { territory_name } = await req.json() as { territory_name: string }
  if (!territory_name) return NextResponse.json({ error: 'territory_name required' }, { status: 400 })

  const service = createServiceClient()

  // Check whether a row already exists for this territory
  const { data: existing } = await service
    .from('territories')
    .select('id, owner_id')
    .eq('name', territory_name)
    .maybeSingle()

  if (!existing) {
    // Neutral country — no row yet. Create one and assign immediately.
    const { error } = await service
      .from('territories')
      .insert({ name: territory_name, owner_id: user.id, ...hexCoords(territory_name) })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (existing.owner_id === null) {
    // Row exists but unclaimed — update
    const { error } = await service
      .from('territories')
      .update({ owner_id: user.id })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Already owned (bot or other player)
    return NextResponse.json({ error: 'Territory already owned' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
