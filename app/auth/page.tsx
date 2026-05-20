'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [view, setView] = useState<'landing' | 'signin'>('landing')
  const router = useRouter()

  if (view === 'landing') return <LandingView onNew={() => router.push('/onboarding')} onReturn={() => setView('signin')} />
  return <SignInView onBack={() => setView('landing')} />
}

function LandingView({ onNew, onReturn }: { onNew: () => void; onReturn: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto',
      background: 'var(--ink)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0 0 env(safe-area-inset-bottom, 24px)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background map texture — faint country grid lines */}
      <svg
        viewBox="410 22 590 255" width="100%" height="55%"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.07, pointerEvents: 'none' }}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Minimal grid lines for texture */}
        {[0, 30, 60].map(lat => { const y = (90 - lat) / 180 * 500; return <line key={lat} x1={410} x2={1000} y1={y} y2={y} stroke="#fff" strokeWidth="0.5"/> })}
        {[0, 30, 60, 90, 120, 150].map(lng => { const x = (lng + 180) / 360 * 1000; return <line key={lng} x1={x} x2={x} y1={22} y2={277} stroke="#fff" strokeWidth="0.5"/> })}
      </svg>

      {/* Top: Logo area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 0', textAlign: 'center', zIndex: 1 }}>
        {/* Crown icon */}
        <svg width="32" height="28" viewBox="0 0 32 28" fill="none" style={{ marginBottom: 20, opacity: 0.6 }}>
          <path d="M4 10L9 18L16 6L23 18L28 10L26 24H6L4 10Z" stroke="#b89758" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>

        <div style={{
          fontFamily: 'var(--serif)', fontSize: 62, fontStyle: 'italic',
          letterSpacing: '-0.025em', lineHeight: 0.9, color: '#f4f1ea',
        }}>Conquest</div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.3em',
          textTransform: 'uppercase', color: 'rgba(244,241,234,0.35)',
          marginTop: 16,
        }}>Territory Chess · World Atlas</div>

        <p style={{
          fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic',
          color: 'rgba(244,241,234,0.55)', marginTop: 32, lineHeight: 1.4,
          maxWidth: 240,
        }}>
          Real war,<br/>played as chess.
        </p>
      </div>

      {/* Bottom: CTAs */}
      <div style={{ width: '100%', padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1 }}>
        {/* Decorative divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(244,241,234,0.12)' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(244,241,234,0.25)', letterSpacing: '0.2em' }}>EST. MMXXIV</span>
          <div style={{ flex: 1, height: '0.5px', background: 'rgba(244,241,234,0.12)' }} />
        </div>

        <button onClick={onNew} style={{
          width: '100%', height: 58, borderRadius: 16,
          background: '#f4f1ea', color: 'var(--ink)', border: 'none',
          fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
          letterSpacing: '0.06em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          Begin Your Conquest
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
            <path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button onClick={onReturn} style={{
          width: '100%', height: 50, borderRadius: 16,
          background: 'transparent', color: 'rgba(244,241,234,0.6)',
          border: '0.5px solid rgba(244,241,234,0.15)',
          fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 14,
          letterSpacing: '0.04em', cursor: 'pointer',
        }}>
          I already have a kingdom
        </button>
      </div>
    </div>
  )
}

function SignInView({ onBack }: { onBack: () => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()

  async function handleSignIn() {
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto',
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '56px 24px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-warm)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <path d="M13 7H3M3 7L8 2M3 7L8 12" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>Welcome back</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Sign in to your kingdom</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fff0ee', border: '0.5px solid var(--red)', fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <input
          type="email" placeholder="your@email.com"
          value={email} onChange={e => setEmail(e.target.value)}
          style={{
            width: '100%', height: 52, borderRadius: 14,
            background: 'var(--bg-warm)', border: '0.5px solid var(--line)',
            padding: '0 18px', boxSizing: 'border-box',
            fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', outline: 'none',
          }}
        />
        <input
          type="password" placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignIn()}
          style={{
            width: '100%', height: 52, borderRadius: 14,
            background: 'var(--bg-warm)', border: '0.5px solid var(--line)',
            padding: '0 18px', boxSizing: 'border-box',
            fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ink)', outline: 'none',
          }}
        />

        <button
          onClick={handleSignIn}
          disabled={!email || !password || loading}
          style={{
            width: '100%', height: 52, borderRadius: 14,
            background: 'var(--ink)', color: '#f4f1ea', border: 'none',
            fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>
          {loading ? 'Signing in…' : 'Enter the Kingdom'}
        </button>

        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--muted)' }}>
            No account?{' '}
          </span>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', fontWeight: 600,
            textDecoration: 'underline',
          }}>
            Begin your conquest
          </button>
        </div>
      </div>
    </div>
  )
}
