import { createServerClient_ } from '@/lib/supabase-server'
import TabBar from '@/components/ui/TabBar'
import { redirect } from 'next/navigation'
import type { Profile } from '@/lib/types'
import { DEFAULT_COUNTRY_STATUS } from '@/lib/world-territories'

export default async function DynastyPage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileData as Profile | null

  // Live territories for this user
  const { data: myTerritories } = await supabase
    .from('territories')
    .select('*')
    .eq('owner_id', user.id)

  const owned = myTerritories ?? []
  const crownValue = owned.reduce((s, t) => {
    const def = DEFAULT_COUNTRY_STATUS[t.name]
    return s + (def?.value ?? 5)
  }, 0)

  // Recent completed challenges involving the user
  const { data: recentChallenges } = await supabase
    .from('challenges')
    .select('*, territory:territories(name), challenger:profiles!challenger_id(username), defender:profiles!defender_id(username)')
    .or(`challenger_id.eq.${user.id},defender_id.eq.${user.id}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  const username = profile?.username ?? 'Conqueror'
  const houseName    = `House of ${username}`
  const houseInitial = (username[0] ?? 'C').toUpperCase()
  const houseOfIdx   = houseName.lastIndexOf(' of ')
  const houseLineA   = houseOfIdx >= 0 ? houseName.slice(0, houseOfIdx + 4) : houseName
  const houseLineB   = houseOfIdx >= 0 ? houseName.slice(houseOfIdx + 4)    : ''

  // Compute win/loss/streak from challenges
  const completedGames = (recentChallenges ?? []).filter(c => c.winner_id !== null)
  const wins  = completedGames.filter(c => c.winner_id === user.id).length
  const total = completedGames.length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  // Streak: count consecutive wins from most recent
  let streak = 0
  for (const c of completedGames) {
    if (c.winner_id === user.id) streak++
    else break
  }

  const recentCampaigns = completedGames.slice(0, 5).map(c => {
    const isChallenger = c.challenger_id === user.id
    const won = c.winner_id === user.id
    const territory = (c.territory as { name: string } | null)?.name ?? '—'
    const opponent = isChallenger
      ? (c.defender as { username: string } | null)?.username ?? 'Stockfish'
      : (c.challenger as { username: string } | null)?.username ?? '—'
    return { result: won ? 'W' as const : 'L' as const, territory, vs: opponent, delta: won ? '+pts' : '−pts' }
  })

  return (
    <main style={{
      width: '100%', maxWidth: 390, margin: '0 auto',
      minHeight: '100dvh', background: 'var(--bg)',
      paddingBottom: 100, overflowY: 'auto',
    }} className="cq-scroll">

      {/* Header */}
      <div style={{ position: 'relative', paddingTop: 88, paddingBottom: 24, paddingLeft: 22, paddingRight: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              House · Founded {profile ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 44, lineHeight: 0.95, letterSpacing: '-0.025em', marginTop: 6, fontStyle: 'italic' }}>
              {houseLineA}<br/>{houseLineB}
            </div>
          </div>
          <div style={{
            width: 72, height: 72, borderRadius: 999,
            background: profile?.display_color ?? 'var(--ink)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', flexShrink: 0,
          }}>{houseInitial}</div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="14" viewBox="0 0 24 20" fill="none">
            <path d="M4 4L7 10L12 3L17 10L20 4L19 17L5 17Z" stroke="var(--red)" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            {owned.length} TERRITORIES · {total} GAMES PLAYED
          </span>
        </div>
      </div>

      {/* Stats card */}
      <div style={{ margin: '0 16px', background: '#fff', border: '0.5px solid var(--line)', borderRadius: 22, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '0.5px solid var(--line-soft)' }}>
          <div style={{ padding: '16px 18px', borderRight: '0.5px solid var(--line-soft)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Crown Value</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, lineHeight: 1, marginTop: 6 }}>
              {Math.round(crownValue)}<span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>pts</span>
            </div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Games</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, lineHeight: 1, marginTop: 6 }}>{total}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            { label: 'Territories', value: String(owned.length) },
            { label: 'Streak',      value: streak > 0 ? `${streak}W` : '—', color: streak > 0 ? 'var(--red)' : undefined },
            { label: 'Win Rate',    value: String(winRate), suffix: '%' },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: '14px 16px', borderRight: i < 2 ? '0.5px solid var(--line-soft)' : 'none' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24, marginTop: 4, color: s.color ?? 'var(--ink)' }}>
                {s.value}
                {s.suffix && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>{s.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings */}
      {owned.length > 0 && (
        <>
          <div style={{ padding: '24px 22px 8px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Holdings · {owned.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 8px' }} className="cq-scroll">
            {owned.map(t => {
              const def = DEFAULT_COUNTRY_STATUS[t.name]
              return (
                <div key={t.id} style={{
                  flexShrink: 0, width: 120, height: 130,
                  background: profile?.display_color ?? 'var(--ink)', color: '#fff',
                  borderRadius: 14, padding: '12px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>TERRITORY</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.05, marginTop: 6, letterSpacing: '-0.01em' }}>
                      {t.name.length > 12 ? t.name.slice(0, 11) + '…' : t.name}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1 }}>
                      {Math.round((def?.value ?? 5) * 10) / 10}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginLeft: 3 }}>pts</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Recent campaigns */}
      {recentCampaigns.length > 0 && (
        <>
          <div style={{ padding: '20px 22px 8px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Campaigns</div>
          </div>
          <div style={{ padding: '0 16px' }}>
            {recentCampaigns.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 8px',
                borderBottom: i < recentCampaigns.length - 1 ? '0.5px solid var(--line-soft)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: m.result === 'W' ? 'var(--ink)' : 'var(--line)',
                  color: m.result === 'W' ? '#fff' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic',
                }}>{m.result}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{m.territory}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--muted)', letterSpacing: '0.1em', marginTop: 3 }}>
                    VS {m.vs}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: m.result === 'W' ? 'var(--red)' : 'var(--muted)' }}>{m.delta}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {owned.length === 0 && recentCampaigns.length === 0 && (
        <div style={{ padding: '48px 22px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', color: 'var(--muted)' }}>No territories yet</div>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>Claim your first territory from the map.</p>
        </div>
      )}

      <TabBar active="dynasty" />
    </main>
  )
}
