import { createServerClient_ } from '@/lib/supabase-server'
import KingdomMapClient from '@/components/map/KingdomMapClient'
import TabBar from '@/components/ui/TabBar'
import ProfileChip from '@/components/ui/ProfileChip'
import BottomDrawer, { SheetHandle } from '@/components/ui/BottomDrawer'
import { DEFAULT_COUNTRY_STATUS } from '@/lib/world-territories'
import type { Profile } from '@/lib/types'

export default async function MapPage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()

  // Auto-create profile on first login
  let profile: Profile | null = null
  if (user) {
    let { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (!existing) {
      const username = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '') || `player${user.id.slice(0, 5)}`
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, username, display_color: (['#c8311c','#1a6b3a','#1c4a8a','#7a3cbf','#b89758','#2a7a6a'] as const)[Math.floor(Math.random() * 6)] })
        .select('*')
        .single()
      existing = created
    }
    profile = existing
  }

  // Fetch all territories with owner profile joined
  const { data: territories } = await supabase
    .from('territories')
    .select('*, owner:profiles(*)')
    .order('id')

  // Fetch active challenges against the user's territories
  const { data: activeChallenges } = user
    ? await supabase
        .from('challenges')
        .select('territory_id')
        .eq('defender_id', user.id)
        .in('status', ['pending', 'active'])
    : { data: [] }

  const contestedTerritoryIds = new Set((activeChallenges ?? []).map(c => c.territory_id))

  // Derive stats from live territories (fall back to DEFAULT_COUNTRY_STATUS if no user)
  const myTerritories = (territories ?? []).filter(t => user && t.owner_id === user.id)
  const myContested = myTerritories.filter(t => contestedTerritoryIds.has(t.id))

  const kingdomValue = myTerritories.reduce((s, t) => {
    const def = DEFAULT_COUNTRY_STATUS[t.name]
    return s + (def?.value ?? 5)
  }, 0)
  const contestedCount = myContested.length

  // For display list: user's territories
  const holdingsList = myTerritories.map(t => ({
    name: t.name,
    status: contestedTerritoryIds.has(t.id) ? 'contested' as const : 'owned' as const,
    held: DEFAULT_COUNTRY_STATUS[t.name]?.held ?? 0,
    value: DEFAULT_COUNTRY_STATUS[t.name]?.value ?? 5,
  }))

  // Guest fallback: use DEFAULT_COUNTRY_STATUS static data
  const displayOwned    = user ? myTerritories.length : Object.values(DEFAULT_COUNTRY_STATUS).filter(t => t.status === 'owned').length
  const displayValue    = user ? Math.round(kingdomValue) : Math.round(Object.values(DEFAULT_COUNTRY_STATUS).filter(t => t.status === 'owned').reduce((s, t) => s + t.value, 0))
  const displayHoldings = user ? holdingsList : Object.entries(DEFAULT_COUNTRY_STATUS)
    .filter(([, v]) => v.status === 'owned' || v.status === 'contested')
    .map(([name, v]) => ({ name, ...v }))

  // Contested alert: show when the user has contested territories (or static demo if guest)
  const alertCount = user ? contestedCount : Object.values(DEFAULT_COUNTRY_STATUS).filter(t => t.status === 'contested').length

  const houseName    = profile ? `House of ${profile.username}` : 'House of Conqueror'
  const houseInitial = profile ? (profile.username[0] ?? 'C').toUpperCase() : 'C'

  return (
    <main style={{
      width: '100%', maxWidth: 390, margin: '0 auto',
      minHeight: '100dvh', background: 'var(--bg)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Map — fills upper portion */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 340, background: 'var(--bg)' }}>
        <KingdomMapClient
          width={390}
          height={340}
          initialTerritories={territories ?? []}
          currentUserId={user?.id}
          currentUsername={profile?.username ?? ''}
        />
      </div>

      {/* Floating top bar */}
      <div style={{
        position: 'absolute', top: 52, left: 0, right: 0, zIndex: 30,
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <ProfileChip name={profile?.username ?? 'Guest'} initial={houseInitial} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--serif)', fontSize: 20, fontStyle: 'italic',
            letterSpacing: '-0.01em', lineHeight: 1,
          }}>Conquest</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--muted)',
          }}>WORLD ATLAS · LIVE</span>
        </div>
      </div>

      {/* Contested alert pill */}
      {alertCount > 0 && (
        <div style={{
          position: 'absolute', top: 108, left: '50%', transform: 'translateX(-50%)',
          zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid var(--red)', borderRadius: 999,
          padding: '7px 14px 7px 10px',
          boxShadow: '0 8px 24px rgba(200,49,28,0.18)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 999, background: 'var(--red)',
            boxShadow: '0 0 0 4px rgba(200,49,28,0.18)', display: 'inline-block',
          }} />
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
            color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {alertCount} territor{alertCount === 1 ? 'y' : 'ies'} under siege
          </span>
        </div>
      )}

      {/* Bottom drawer */}
      <div style={{ position: 'absolute', bottom: 76, left: 0, right: 0, zIndex: 35 }}>
        <BottomDrawer>
          <SheetHandle />

          {/* Kingdom header */}
          <div style={{ padding: '6px 22px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your Kingdom</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{
                fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1,
                letterSpacing: '-0.02em', fontStyle: 'italic',
              }}>{houseName}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>#412 · WORLD</span>
            </div>
          </div>

          {/* Three stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '14px 22px 16px',
            borderTop: '0.5px solid var(--line-soft)',
            borderBottom: '0.5px solid var(--line-soft)',
          }}>
            {[
              { label: 'Holdings',    value: String(displayOwned), suffix: `/ ${Object.keys(DEFAULT_COUNTRY_STATUS).length}` },
              { label: 'Crown Value', value: String(displayValue), suffix: 'pts' },
              { label: 'Streak',      value: '—', suffix: '', color: 'var(--muted)' }, // TODO: compute from challenges
            ].map((s, i) => (
              <div key={s.label} style={{
                borderRight: i < 2 ? '0.5px solid var(--line-soft)' : 'none',
                paddingLeft: i > 0 ? 14 : 0,
                paddingRight: i < 2 ? 12 : 0,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1, marginTop: 4, color: s.color ?? 'var(--ink)' }}>
                  {s.value}
                  {s.suffix && <span style={{ fontFamily: 'var(--mono)', fontSize: s.suffix.length > 3 ? 10 : 13, color: 'var(--muted)', marginLeft: 4 }}>{s.suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Territory list */}
          <div style={{ padding: '14px 22px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Holdings · Today</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em' }}>SEE ALL</span>
            </div>
            {displayHoldings.slice(0, 4).map((t, i) => (
              <div key={t.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--line-soft)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                  background: t.status === 'contested' ? 'var(--red)' : 'var(--ink)',
                  boxShadow: t.status === 'contested' ? '0 0 0 3px rgba(200,49,28,0.15)' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.1,
                    letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginTop: 3 }}>
                    {t.status === 'contested' ? 'UNDER SIEGE' : `HELD ${t.held ?? 0}D`}
                  </div>
                </div>
                {t.status === 'contested' ? (
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.12em', color: 'var(--red)',
                    padding: '4px 10px', border: '1px solid var(--red)', borderRadius: 999,
                  }}>DEFEND</span>
                ) : (
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>
                    +{Math.round(t.value * 10) / 10}
                  </span>
                )}
              </div>
            ))}
          </div>
        </BottomDrawer>
      </div>

      <TabBar active="map" />
    </main>
  )
}
