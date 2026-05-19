import { createServerClient_ } from '@/lib/supabase-server'
import TabBar from '@/components/ui/TabBar'
import { DEFAULT_COUNTRY_STATUS } from '@/lib/world-territories'
import type { Profile } from '@/lib/types'

// TODO: Replace with live data — fetch from challenges table filtered by user.id
const RECENT_CAMPAIGNS = [
  { result: 'W' as const, territory: 'France',       vs: 'Korchnoi_IV', delta: '+18', moves: 41 },
  { result: 'W' as const, territory: 'Germany',      vs: 'Anders_1980',  delta: '+11', moves: 64 },
  { result: 'L' as const, territory: 'Italy',        vs: 'AzureCrown',   delta: '−22', moves: 28 },
  { result: 'W' as const, territory: 'South Africa', vs: 'Patricia_K',   delta: '+14', moves: 52 },
]

export default async function DynastyPage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data
  }

  const owned = Object.entries(DEFAULT_COUNTRY_STATUS)
    .filter(([, v]) => v.status === 'owned')
    .map(([name, v]) => ({ name, ...v }))
  const crownValue = owned.reduce((s, t) => s + t.value, 0)
  const username = profile?.username ?? 'Conqueror'
  const houseName    = `House of ${username}`
  const houseInitial = (username[0] ?? 'C').toUpperCase()
  const houseOfIdx   = houseName.lastIndexOf(' of ')
  const houseLineA   = houseOfIdx >= 0 ? houseName.slice(0, houseOfIdx + 4) : houseName
  const houseLineB   = houseOfIdx >= 0 ? houseName.slice(houseOfIdx + 4)    : ''

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
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>House · Founded {profile ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()}</div>
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 44, lineHeight: 0.95,
              letterSpacing: '-0.025em', marginTop: 6, fontStyle: 'italic',
            }}>{houseLineA}<br/>{houseLineB}</div>
          </div>
          <div style={{
            width: 72, height: 72, borderRadius: 999,
            background: 'var(--ink)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', flexShrink: 0,
          }}>{houseInitial}</div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="14" viewBox="0 0 24 20" fill="none">
            <path d="M4 4L7 10L12 3L17 10L20 4L19 17L5 17Z" stroke="var(--red)" strokeWidth="1.6" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            BARONESS · TIER III · #412 · WORLD
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
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--red)', marginTop: 4, letterSpacing: '0.1em' }}>↑ +12 THIS WEEK</div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>ELO</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 36, lineHeight: 1, marginTop: 6 }}>1,842{/* TODO: Replace with profile.elo once column added */}</div>
            {/* TODO: Compute from recent challenges */}
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--red)', marginTop: 4, letterSpacing: '0.1em' }}>↑ +28 (7-DAY)</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            { label: 'Hold',     value: String(owned.length) },
            { label: 'Streak',   value: '7W', color: 'var(--red)' },
            { label: 'Win Rate', value: '64', suffix: '%' },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '14px 16px',
              borderRight: i < 2 ? '0.5px solid var(--line-soft)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 24, marginTop: 4, color: s.color ?? 'var(--ink)' }}>
                {s.value}
                {s.suffix && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>{s.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Holdings horizontal scroll */}
      <div style={{ padding: '24px 22px 8px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Holdings · {owned.length}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 8px' }} className="cq-scroll">
        {owned.map(t => (
          <div key={t.name} style={{
            flexShrink: 0, width: 120, height: 130,
            background: 'var(--ink)', color: '#fff',
            borderRadius: 14, padding: '12px 12px',
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
                {Math.round(t.value * 10) / 10}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginLeft: 3 }}>pts</span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', marginTop: 3 }}>
                {t.held ?? 30}D · HELD
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent campaigns */}
      <div style={{ padding: '20px 22px 8px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Recent Campaigns</div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {RECENT_CAMPAIGNS.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 8px',
            borderBottom: i < RECENT_CAMPAIGNS.length - 1 ? '0.5px solid var(--line-soft)' : 'none',
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
                VS {m.vs} · {m.moves} MOVES
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--serif)', fontSize: 18,
              color: m.result === 'W' ? 'var(--red)' : 'var(--muted)',
            }}>{m.delta}</span>
          </div>
        ))}
      </div>

      <TabBar active="dynasty" />
    </main>
  )
}
