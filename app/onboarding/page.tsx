'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BANNER_COLORS = [
  { value: '#c8311c', label: 'Crimson'  },
  { value: '#1a6b3a', label: 'Verdant'  },
  { value: '#1c4a8a', label: 'Azure'    },
  { value: '#7a3cbf', label: 'Violet'   },
  { value: '#b89758', label: 'Gold'     },
  { value: '#2a7a6a', label: 'Jade'     },
]

const STARTING_REGIONS = [
  { name: 'Western Europe', countries: ['France', 'Germany', 'United Kingdom'], desc: 'Wealthy and contested — high risk, high reward' },
  { name: 'Eastern Europe', countries: ['Poland', 'Ukraine', 'Romania'], desc: 'Vast plains and ancient kingdoms to claim' },
  { name: 'Central Asia',   countries: ['Kazakhstan', 'Uzbekistan'], desc: 'Ancient trade routes under open skies' },
  { name: 'East Asia',      countries: ['Japan', 'South Korea'], desc: 'Island fortresses and precision warfare' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]               = useState(0)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [houseName, setHouseName]     = useState('')
  const [color, setColor]             = useState(BANNER_COLORS[0].value)
  const [region, setRegion]           = useState<number | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const displayName = houseName.trim() || 'Your House'

  async function handleCreate() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    // 1. Sign up the user
    const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr || !data.user) {
      setError(signUpErr?.message ?? 'Sign-up failed')
      setLoading(false)
      return
    }

    // 2. Insert profile (username = cleaned houseName, display_color)
    const username = houseName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || `player_${data.user.id.slice(0, 5)}`
    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, username, display_color: color })

    if (profileErr) {
      const fallback = `${username}_${Math.floor(Math.random() * 9000 + 1000)}`
      const { error: fallbackErr } = await supabase.from('profiles').insert({ id: data.user.id, username: fallback, display_color: color })
      if (fallbackErr) {
        setError('Could not create your profile. Please try again.')
        setLoading(false)
        return
      }
    }

    router.push('/')
  }

  const steps = [
    <StepWelcome key={0} onNext={() => setStep(1)} />,
    <StepCredentials key={1} email={email} password={password}
      onEmail={setEmail} onPassword={setPassword}
      onNext={() => setStep(2)} />,
    <StepHouseName key={2} name={houseName} onChange={setHouseName} displayName={displayName} onNext={() => setStep(3)} />,
    <StepBannerColor key={3} color={color} onChange={setColor} displayName={displayName} onNext={() => setStep(4)} />,
    <StepStartingRegion key={4} selected={region} onSelect={setRegion} onNext={() => setStep(5)} />,
    <StepReady key={5} displayName={displayName} color={color}
      loading={loading} error={error}
      onEnter={handleCreate} />,
  ]

  return <>{steps[step]}</>
}

/* ─── Step 0: Welcome ─────────────────────────────── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto',
      background: 'var(--ink)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px env(safe-area-inset-bottom, 40px)',
      position: 'relative', overflow: 'hidden',
    }}>
      <svg viewBox="0 0 390 340" width="390" height="340" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.05, pointerEvents: 'none' }}>
        {[60, 120, 180, 240, 300].map(x => <line key={x} x1={x} x2={x} y1={0} y2={340} stroke="#fff" strokeWidth="0.5"/>)}
        {[68, 136, 204, 272].map(y => <line key={y} x1={0} x2={390} y1={y} y2={y} stroke="#fff" strokeWidth="0.5"/>)}
        <circle cx={195} cy={170} r={120} stroke="#fff" strokeWidth="0.5" fill="none"/>
        <circle cx={195} cy={170} r={80} stroke="#fff" strokeWidth="0.3" fill="none"/>
      </svg>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(244,241,234,0.07)', border: '0.5px solid rgba(244,241,234,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <svg width="36" height="32" viewBox="0 0 36 32" fill="none">
            <path d="M5 12L10 21L18 7L26 21L31 12L29 28H7L5 12Z" stroke="#b89758" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 56, fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 0.9, color: '#f4f1ea', marginBottom: 20 }}>Conquest</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.3)' }}>Territory Chess · World Atlas</div>
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          {[
            { icon: '⚔', text: 'Claim territory by beating Stockfish' },
            { icon: '🏰', text: 'Defend your lands from challengers' },
            { icon: '👑', text: 'The greatest empire wins' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'rgba(244,241,234,0.55)', letterSpacing: '-0.01em' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', zIndex: 1 }}>
        <StepDots total={6} current={0} dark />
        <button onClick={onNext} style={{
          width: '100%', height: 58, borderRadius: 16, marginTop: 16,
          background: '#f4f1ea', color: 'var(--ink)', border: 'none',
          fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
          letterSpacing: '0.05em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          Forge Your Empire
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
            <path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ─── Step 1: Credentials ─────────────────────────── */
function StepCredentials({ email, password, onEmail, onPassword, onNext }: {
  email: string; password: string;
  onEmail: (v: string) => void; onPassword: (v: string) => void;
  onNext: () => void
}) {
  const canProceed = email.includes('@') && password.length >= 6
  return (
    <div style={{ minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '60px 24px env(safe-area-inset-bottom, 40px)' }}>
      <StepDots total={6} current={1} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Step 1 of 5</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>Secure Your Realm</div>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 32 }}>
          Your email and password grant access to your kingdom.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="email" placeholder="your@email.com" value={email} onChange={e => onEmail(e.target.value)}
            style={{ width: '100%', height: 52, borderRadius: 14, background: 'var(--bg-warm)', border: '0.5px solid var(--line)', padding: '0 18px', boxSizing: 'border-box', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', outline: 'none' }} />
          <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => onPassword(e.target.value)}
            style={{ width: '100%', height: 52, borderRadius: 14, background: 'var(--bg-warm)', border: '0.5px solid var(--line)', padding: '0 18px', boxSizing: 'border-box', fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', outline: 'none' }} />
        </div>
      </div>
      <button onClick={onNext} disabled={!canProceed} style={{
        width: '100%', height: 56, borderRadius: 16,
        background: canProceed ? 'var(--ink)' : 'var(--line)',
        color: canProceed ? '#f4f1ea' : 'var(--muted)', border: 'none',
        fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
        letterSpacing: '0.06em', cursor: canProceed ? 'pointer' : 'not-allowed',
        transition: 'background 0.2s, color 0.2s',
      }}>Continue</button>
    </div>
  )
}

/* ─── Step 2: House Name ──────────────────────────── */
function StepHouseName({ name, onChange, displayName, onNext }: { name: string; onChange: (v: string) => void; displayName: string; onNext: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '60px 24px env(safe-area-inset-bottom, 40px)' }}>
      <StepDots total={6} current={2} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Step 2 of 5</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>Name Your House</div>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 36 }}>Your house name is your identity on the map.</p>
        <div style={{ padding: '20px', background: '#fff', border: '0.5px solid var(--line)', borderRadius: 18, marginBottom: 24, minHeight: 88, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Your Kingdom</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, color: name.trim() ? 'var(--ink)' : 'var(--muted)' }}>House of {displayName}</div>
        </div>
        <input placeholder="Enter your name or title" value={name} onChange={e => onChange(e.target.value)} maxLength={24}
          style={{ width: '100%', height: 54, borderRadius: 14, background: 'var(--bg-warm)', border: '0.5px solid var(--line)', padding: '0 18px', boxSizing: 'border-box', fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--ink)', outline: 'none' }} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', marginTop: 8, textAlign: 'right', letterSpacing: '0.1em' }}>{name.length}/24</div>
      </div>
      <button onClick={onNext} disabled={!name.trim()} style={{
        width: '100%', height: 56, borderRadius: 16,
        background: name.trim() ? 'var(--ink)' : 'var(--line)',
        color: name.trim() ? '#f4f1ea' : 'var(--muted)', border: 'none',
        fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
        letterSpacing: '0.06em', cursor: name.trim() ? 'pointer' : 'not-allowed',
        transition: 'background 0.2s, color 0.2s',
      }}>Continue</button>
    </div>
  )
}

/* ─── Step 3: Banner Color ────────────────────────── */
function StepBannerColor({ color, onChange, displayName, onNext }: { color: string; onChange: (v: string) => void; displayName: string; onNext: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '60px 24px env(safe-area-inset-bottom, 40px)' }}>
      <StepDots total={6} current={3} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, alignSelf: 'flex-start' }}>Step 3 of 5</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8, alignSelf: 'flex-start' }}>Choose Your Standard</div>
        <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 36, alignSelf: 'flex-start' }}>This color marks every territory you control.</p>
        <div style={{ width: 96, height: 96, borderRadius: 999, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 42, fontStyle: 'italic', marginBottom: 10, boxShadow: `0 12px 40px ${color}44`, transition: 'background 0.3s, box-shadow 0.3s' }}>
          {displayName[0]?.toUpperCase() ?? 'H'}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic', color: 'var(--muted)', marginBottom: 36 }}>House of {displayName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%' }}>
          {BANNER_COLORS.map(c => (
            <button key={c.value} onClick={() => onChange(c.value)} style={{
              height: 56, borderRadius: 14, border: 'none', background: c.value, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              outline: color === c.value ? '3px solid var(--ink)' : '3px solid transparent',
              outlineOffset: 2, transition: 'outline 0.15s', position: 'relative',
            }}>
              {color === c.value && <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M1 6L6 11L15 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', marginTop: 14 }}>{BANNER_COLORS.find(c => c.value === color)?.label ?? ''}</div>
      </div>
      <button onClick={onNext} style={{ width: '100%', height: 56, borderRadius: 16, background: 'var(--ink)', color: '#f4f1ea', border: 'none', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', cursor: 'pointer' }}>This Is My Standard</button>
    </div>
  )
}

/* ─── Step 4: Starting Region ─────────────────────── */
function StepStartingRegion({ selected, onSelect, onNext }: { selected: number | null; onSelect: (i: number) => void; onNext: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: '60px 24px env(safe-area-inset-bottom, 40px)' }}>
      <StepDots total={6} current={4} />
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Step 4 of 5</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 38, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>Where Will You Rise?</div>
      <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 24 }}>Choose your starting region.</p>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STARTING_REGIONS.map((r, i) => {
          const isSelected = selected === i
          return (
            <button key={i} onClick={() => onSelect(i)} style={{
              width: '100%', padding: '16px 18px', borderRadius: 16,
              background: isSelected ? 'var(--ink)' : '#fff',
              border: isSelected ? '0.5px solid var(--ink)' : '0.5px solid var(--line)',
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'background 0.2s, border 0.2s',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: `2px solid ${isSelected ? '#f4f1ea' : 'var(--line)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && <div style={{ width: 8, height: 8, borderRadius: 999, background: '#f4f1ea' }} />}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, letterSpacing: '-0.01em', color: isSelected ? '#f4f1ea' : 'var(--ink)', lineHeight: 1.2 }}>{r.name}</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: isSelected ? 'rgba(244,241,234,0.55)' : 'var(--muted)', marginTop: 3 }}>{r.desc}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: isSelected ? 'rgba(244,241,234,0.4)' : 'var(--muted)', marginTop: 5, letterSpacing: '0.1em' }}>{r.countries.join(' · ')}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        <button onClick={onNext} disabled={selected === null} style={{
          width: '100%', height: 56, borderRadius: 16,
          background: selected !== null ? 'var(--ink)' : 'var(--line)',
          color: selected !== null ? '#f4f1ea' : 'var(--muted)', border: 'none',
          fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
          letterSpacing: '0.06em', cursor: selected !== null ? 'pointer' : 'not-allowed',
        }}>Plant My Banner Here</button>
        <button onClick={onNext} style={{ width: '100%', height: 44, borderRadius: 16, background: 'transparent', color: 'var(--muted)', border: 'none', fontFamily: 'var(--sans)', fontSize: 13, cursor: 'pointer' }}>
          I&apos;ll choose on the map
        </button>
      </div>
    </div>
  )
}

/* ─── Step 5: Ready + Create Account ─────────────── */
function StepReady({ displayName, color, loading, error, onEnter }: {
  displayName: string; color: string;
  loading: boolean; error: string;
  onEnter: () => void
}) {
  return (
    <div style={{
      minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto',
      background: 'var(--ink)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '60px 24px env(safe-area-inset-bottom, 40px)',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 0 }}>
        <div style={{ width: 88, height: 88, borderRadius: 999, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 44, fontStyle: 'italic', color: '#fff', boxShadow: `0 0 0 12px ${color}22, 0 0 0 24px ${color}11`, marginBottom: 28 }}>
          {displayName[0]?.toUpperCase() ?? 'H'}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.35)', marginBottom: 10 }}>Your house is forged</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 42, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, color: '#f4f1ea', marginBottom: 4 }}>House of</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 42, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, color: '#f4f1ea', marginBottom: 32 }}>{displayName}</div>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(200,49,28,0.15)', border: '0.5px solid rgba(200,49,28,0.4)', fontFamily: 'var(--sans)', fontSize: 13, color: '#ff8a7a', marginBottom: 16, width: '100%' }}>{error}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {[{ label: 'Territories', value: '0' }, { label: 'Crown Value', value: '0 pts' }, { label: 'Rank', value: 'Unranked' }].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderRadius: 12, background: 'rgba(244,241,234,0.05)', border: '0.5px solid rgba(244,241,234,0.08)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(244,241,234,0.35)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'rgba(244,241,234,0.7)', fontStyle: 'italic' }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onEnter} disabled={loading} style={{
        width: '100%', height: 60, borderRadius: 18, marginTop: 24,
        background: '#f4f1ea', color: 'var(--ink)', border: 'none',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16,
        letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        opacity: loading ? 0.7 : 1,
        boxShadow: '0 8px 32px rgba(244,241,234,0.1)',
      }}>
        {loading ? 'Creating Your Kingdom…' : 'Enter Conquest'}
        {!loading && (
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">
            <path d="M1 7H15M15 7L9 1M15 7L9 13" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    </div>
  )
}

/* ─── Shared: Step Dots ───────────────────────────── */
function StepDots({ total, current, dark = false }: { total: number; current: number; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 4, borderRadius: 4,
          width: i === current ? 24 : 8,
          background: dark
            ? (i === current ? '#f4f1ea' : 'rgba(244,241,234,0.2)')
            : (i === current ? 'var(--ink)' : 'var(--line)'),
          transition: 'width 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }} />
      ))}
    </div>
  )
}
