import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { challenge_id, winner } = await req.json() as {
    challenge_id: string
    winner: 'challenger' | 'defender'
  }

  const service = createServiceClient()

  const { data: challenge } = await service
    .from('challenges')
    .select('*, territory:territories(name, owner_id)')
    .eq('id', challenge_id)
    .single()
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

  const winnerId = winner === 'challenger' ? challenge.challenger_id : challenge.defender_id

  await service
    .from('challenges')
    .update({ status: 'completed', winner_id: winnerId })
    .eq('id', challenge_id)

  if (winner === 'challenger') {
    await service
      .from('territories')
      .update({ owner_id: challenge.challenger_id })
      .eq('id', challenge.territory_id)
  }

  return NextResponse.json({ ok: true, winner_id: winnerId })
}
