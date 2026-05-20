import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

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

  const { data: territory } = await service
    .from('territories')
    .select('id')
    .eq('name', territory_name)
    .single()
  if (!territory) return NextResponse.json({ error: 'Territory not found' }, { status: 404 })

  const { data: challenge, error } = await service
    .from('challenges')
    .insert({
      territory_id:   territory.id,
      challenger_id:  user.id,
      defender_id:    defender_id ?? user.id,  // self-challenge for neutral (vs bot)
      status:         'active',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ challenge_id: challenge.id })
}
