import { createServerClient_ } from '@/lib/supabase-server'
import TabBar from '@/components/ui/TabBar'
import ForfeitButton from '@/components/ui/ForfeitButton'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ChallengePage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: challenges } = await supabase
    .from('challenges')
    .select('*, territory:territories(name), challenger:profiles!challenger_id(username), defender:profiles!defender_id(username)')
    .or(`challenger_id.eq.${user.id},defender_id.eq.${user.id}`)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })

  const pending = (challenges ?? []).filter(c => c.status === 'pending' && c.defender_id === user.id)
  const active  = (challenges ?? []).filter(c => c.status === 'active')

  return (
    <main style={{
      width: '100%', maxWidth: 390, margin: '0 auto',
      minHeight: '100dvh', background: 'var(--bg)',
      paddingBottom: 100, overflowY: 'auto',
    }} className="cq-scroll">

      {/* Header */}
      <div style={{ paddingTop: 88, paddingLeft: 22, paddingRight: 22, paddingBottom: 24 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Active</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 44, fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 0.95, marginTop: 4 }}>Campaigns</div>
      </div>

      {/* Incoming challenges (pending) */}
      {pending.length > 0 && (
        <section style={{ padding: '0 16px 24px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 12 }}>
            ⚔ Under Attack · {pending.length}
          </div>
          {pending.map(c => {
            const territory = c.territory as { name: string } | null
            const challenger = c.challenger as { username: string } | null
            return (
              <div key={c.id} style={{ background: '#fff0ee', border: '0.5px solid var(--red)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, letterSpacing: '-0.01em' }}>{territory?.name ?? '—'}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>
                  Challenger: {challenger?.username ?? '—'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Link href={`/game/${c.id}`} style={{
                    flex: 1, height: 44, borderRadius: 12, background: 'var(--red)',
                    color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
                    textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
                  }}>Defend</Link>
                  <ForfeitButton challengeId={c.id} />
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Active games */}
      {active.length > 0 && (
        <section style={{ padding: '0 16px 24px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
            In Progress · {active.length}
          </div>
          {active.map(c => {
            const territory = c.territory as { name: string } | null
            const isChallenger = c.challenger_id === user.id
            const opponent = isChallenger
              ? (c.defender as { username: string } | null)?.username
              : (c.challenger as { username: string } | null)?.username
            return (
              <Link key={c.id} href={`/game/${c.id}`} style={{
                display: 'block', background: '#fff', border: '0.5px solid var(--line)',
                borderRadius: 16, padding: '14px 16px', marginBottom: 10, textDecoration: 'none',
              }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{territory?.name ?? '—'}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>
                  vs {opponent ?? 'Stockfish'} · {isChallenger ? 'You attack' : 'You defend'}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--red)', marginTop: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Continue →</div>
              </Link>
            )
          })}
        </section>
      )}

      {pending.length === 0 && active.length === 0 && (
        <div style={{ padding: '48px 22px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', color: 'var(--muted)' }}>No active campaigns</div>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
            Tap a territory on the map to start a conquest.
          </p>
        </div>
      )}

      <TabBar active="challenge" />
    </main>
  )
}
