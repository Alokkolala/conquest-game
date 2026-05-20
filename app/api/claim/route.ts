import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { territory_name } = await req.json() as { territory_name: string }
  if (!territory_name) return NextResponse.json({ error: 'territory_name required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service
    .from('territories')
    .update({ owner_id: user.id })
    .eq('name', territory_name)
    .is('owner_id', null)   // only claim truly unclaimed

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
