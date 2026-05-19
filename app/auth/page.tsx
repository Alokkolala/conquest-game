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
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div style={{
      minHeight: '100dvh', width: '100%', maxWidth: 390, margin: '0 auto',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
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
        {sent ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', gap: 12,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
                <path d="M2 4h20v13a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="var(--ink)" strokeWidth="1.5"/>
                <path d="M2 4l10 8 10-8" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'italic' }}>Check your email</div>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
              The sign-in link is on its way to<br/><strong style={{ color: 'var(--ink)' }}>{email}</strong>
            </p>
          </div>
        ) : (
          <>
            {/* Google */}
            <button style={{
              width: '100%', height: 52, borderRadius: 14,
              background: '#fff', border: '0.5px solid var(--line)',
              fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14,
              color: 'var(--ink)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--line)' }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em' }}>OR</span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--line)' }} />
            </div>

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

            <button
              onClick={() => email && setSent(true)}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: 'var(--ink)', color: '#f4f1ea', border: 'none',
                fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
              }}>
              Send Magic Link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
