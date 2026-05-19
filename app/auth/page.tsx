'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    setLoading(false)
    if (!error) setSent(true)
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 52, fontStyle: 'italic',
          letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)',
        }}>Conquest</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.24em',
          textTransform: 'uppercase', color: 'var(--muted)', marginTop: 8,
        }}>Territory Chess · World Atlas</div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 342,
        background: '#fff', border: '0.5px solid var(--line)',
        borderRadius: 22, padding: '28px 24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.01em', fontStyle: 'italic' }}>Check your email</div>
            <p style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
              The sign-in link is on its way.
            </p>
          </div>
        ) : (
          <>
            <button onClick={handleGoogle} style={{
              width: '100%', height: 50, borderRadius: 12,
              background: 'var(--bg)', border: '0.5px solid var(--line)',
              fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14,
              color: 'var(--ink)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--line)' }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em' }}>OR</span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--line)' }} />
            </div>

            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required
                style={{
                  width: '100%', height: 50, borderRadius: 12,
                  background: 'var(--bg)', border: '0.5px solid var(--line)',
                  padding: '0 16px', boxSizing: 'border-box',
                  fontFamily: 'var(--sans)', fontSize: 14,
                  color: 'var(--ink)', outline: 'none',
                }}
              />
              <button type="submit" disabled={loading} style={{
                width: '100%', height: 50, borderRadius: 12,
                background: 'var(--ink)', color: '#fff', border: 'none',
                fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </form>
          </>
        )}
      </div>

      <p style={{
        fontFamily: 'var(--serif)', fontSize: 15, fontStyle: 'italic',
        color: 'var(--muted)', marginTop: 36, textAlign: 'center', maxWidth: 280, lineHeight: 1.4,
      }}>Real war, played as chess.</p>
    </div>
  )
}
