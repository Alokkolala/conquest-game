# Full Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every mocked surface to a real Supabase backend, add email/password auth with a working guard, make the map pan/zoomable with bounds, and build the missing challenge and game pages.

**Architecture:** Auth flows through Supabase `signInWithPassword` / `signUp` — onboarding collects credentials then creates the profile in one shot. Pan/zoom wraps `ConquestMap` with a CSS-transform div (pointer + wheel events). The game page renders `react-chessboard` + `chess.js` driven by a Stockfish Web Worker for bot matches and Supabase Realtime for human vs human. Territory claim and challenge actions go through thin API routes that use the service-role client to bypass RLS.

**Tech Stack:** Next.js 14 App Router, Supabase (auth + realtime + RLS), react-chessboard, chess.js, stockfish.js Web Worker, TypeScript

**Pre-requisite (one-time, done in Supabase Dashboard):**
- Authentication → Email → disable "Confirm email" (so sign-up is instant for the hackathon)

---

## File Map

| Action | File | Role |
|--------|------|------|
| Modify | `middleware.ts` | Re-enable auth guard redirect |
| Modify | `app/auth/page.tsx` | Email + password sign-in wired to Supabase |
| Modify | `app/onboarding/page.tsx` | Collect credentials in step 1, call `signUp` + profile insert on final step |
| Create | `components/map/MapPanZoom.tsx` | CSS-transform pan/zoom wrapper with boundary clamping |
| Modify | `components/map/KingdomMapClient.tsx` | Wrap ConquestMap in MapPanZoom; pass `onClaim`/`onChallenge` through to trigger real actions |
| Create | `app/challenge/page.tsx` | Server component listing pending/active challenges with Accept/Forfeit |
| Create | `app/game/[id]/page.tsx` | Server component loading challenge row |
| Create | `components/chess/ChessGame.tsx` | Client component: react-chessboard + chess.js + Stockfish Worker (bot) or Realtime (human) |
| Create | `public/stockfish-worker.js` | Stockfish Web Worker wrapper (postMessage bridge) |
| Create | `app/api/claim/route.ts` | POST: mark territory as owned by current user (after Stockfish win) |
| Create | `app/api/challenge/route.ts` | POST: create challenge row; return id |
| Create | `app/api/resolve/route.ts` | POST: complete challenge, transfer territory if challenger won |
| Modify | `app/dynasty/page.tsx` | Replace mocked RECENT_CAMPAIGNS + stats with live DB queries |
| Modify | `app/page.tsx` | Replace guest-fallback DEFAULT_COUNTRY_STATUS with real user data only |

---

## Task 1: Enable auth guard + email/password sign-in

**Files:**
- Modify: `middleware.ts`
- Modify: `app/auth/page.tsx`

- [ ] **Step 1: Re-enable middleware auth guard**

In `middleware.ts`, uncomment the redirect block and also redirect `/onboarding` for non-logged-in users (onboarding creates the account, so it should be accessible without auth):

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublic = path.startsWith('/auth') || path.startsWith('/onboarding') || path.startsWith('/api') || path.startsWith('/_next')

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Replace SignInView in app/auth/page.tsx with real email+password auth**

Replace the `SignInView` function (lines 98–194) with this:

```tsx
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
    router.refresh()
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
```

- [ ] **Step 3: Start dev server and verify redirect works**

```bash
cd C:/projects/conquest && npm run dev
```

Open http://localhost:3000 — should redirect to /auth.
Open http://localhost:3000/auth — should show the landing page without redirect.

- [ ] **Step 4: Commit**

```bash
cd C:/projects/conquest
git add middleware.ts app/auth/page.tsx
git commit -m "feat: enable auth guard + real email/password sign-in"
```

---

## Task 2: Real sign-up in onboarding (create Supabase user + profile)

**Files:**
- Modify: `app/onboarding/page.tsx`

The onboarding adds a new step 1 to collect email + password. The final step calls `supabase.auth.signUp` then inserts the profile row.

- [ ] **Step 1: Replace app/onboarding/page.tsx entirely**

```tsx
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
      // Profile may already exist (duplicate username) — try suffixed
      const fallback = `${username}_${Math.floor(Math.random() * 9000 + 1000)}`
      await supabase.from('profiles').insert({ id: data.user.id, username: fallback, display_color: color })
    }

    router.push('/')
    router.refresh()
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
        <StepDots total={5} current={0} dark />
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
      <StepDots total={5} current={1} />
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
      <StepDots total={5} current={2} />
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
      <StepDots total={5} current={3} />
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
      <StepDots total={5} current={4} />
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/projects/conquest && npx tsc --noEmit 2>&1 | grep -i "onboarding\|auth" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/projects/conquest
git add app/onboarding/page.tsx
git commit -m "feat: real sign-up in onboarding — Supabase signUp + profile insert"
```

---

## Task 3: Map pan/zoom with boundary limits

**Files:**
- Create: `components/map/MapPanZoom.tsx`
- Modify: `components/map/KingdomMapClient.tsx` — wrap ConquestMap in MapPanZoom

- [ ] **Step 1: Create components/map/MapPanZoom.tsx**

```tsx
'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  minScale?: number
  maxScale?: number
}

export default function MapPanZoom({ children, minScale = 1, maxScale = 5 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null)
  const didDragRef = useRef(false)

  // Clamp translate so the content (scaled) never shows outside the container
  function clamp(x: number, y: number, scale: number): { x: number; y: number } {
    const container = containerRef.current
    if (!container) return { x, y }
    const W = container.clientWidth
    const H = container.clientHeight
    // At this scale, content is W*scale × H*scale starting from (x, y)
    // Ensure: x <= 0, x >= W*(1-scale), y <= 0, y >= H*(1-scale)
    const clampedX = Math.min(0, Math.max(W * (1 - scale), x))
    const clampedY = Math.min(0, Math.max(H * (1 - scale), y))
    return { x: clampedX, y: clampedY }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary) return
    didDragRef.current = false
    dragRef.current = { startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }, [transform.x, transform.y])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !e.isPrimary) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) + Math.abs(dy) > 4) didDragRef.current = true
    const rawX = dragRef.current.tx + dx
    const rawY = dragRef.current.ty + dy
    setTransform(prev => {
      const { x, y } = clamp(rawX, rawY, prev.scale)
      return { ...prev, x, y }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    // Pointer position relative to container
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    setTransform(prev => {
      const factor = e.deltaY > 0 ? 0.85 : 1.18
      const newScale = Math.min(maxScale, Math.max(minScale, prev.scale * factor))
      // Keep the point under cursor fixed
      const newX = px - (px - prev.x) * (newScale / prev.scale)
      const newY = py - (py - prev.y) * (newScale / prev.scale)
      const { x, y } = clamp(newX, newY, newScale)
      return { x, y, scale: newScale }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScale, maxScale])

  // Touch pinch-zoom
  const touchRef = useRef<{ id0: number; id1: number; dist: number; cx: number; cy: number; tx: number; ty: number; scale: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const cx = (t0.clientX + t1.clientX) / 2
      const cy = (t0.clientY + t1.clientY) / 2
      touchRef.current = { id0: t0.identifier, id1: t1.identifier, dist, cx, cy, tx: transform.x, ty: transform.y, scale: transform.scale }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault()
      const t0 = e.touches[0], t1 = e.touches[1]
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const px = (t0.clientX + t1.clientX) / 2 - rect.left
      const py = (t0.clientY + t1.clientY) / 2 - rect.top
      const scaleFactor = newDist / touchRef.current.dist
      const newScale = Math.min(maxScale, Math.max(minScale, touchRef.current.scale * scaleFactor))
      const newX = px - (px - touchRef.current.tx) * (newScale / touchRef.current.scale)
      const newY = py - (py - touchRef.current.ty) * (newScale / touchRef.current.scale)
      const { x, y } = clamp(newX, newY, newScale)
      setTransform({ x, y, scale: newScale })
    }
  }

  function handleTouchEnd() {
    if (!touchRef.current) return
    touchRef.current = null
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden',
        cursor: dragRef.current ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        transformOrigin: '0 0',
        width: '100%', height: '100%',
        willChange: 'transform',
      }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wrap ConquestMap in MapPanZoom in KingdomMapClient.tsx**

In `components/map/KingdomMapClient.tsx`, add the import and wrap the `ConquestMap`:

```tsx
import MapPanZoom from './MapPanZoom'
```

Change the return statement from:
```tsx
return (
  <>
    <ConquestMap ... />
    {selected && <TerritorySheet ... />}
  </>
)
```

To:
```tsx
return (
  <>
    <MapPanZoom minScale={1} maxScale={5}>
      <ConquestMap
        playerCodes={playerCodes}
        botOwnerMap={liveBotOwnerMap}
        currentUsername={currentUsername}
        isNewUser={isNewUser}
        size="xxl"
        onCountryClick={setSelected}
      />
    </MapPanZoom>
    {selected && (
      <TerritorySheet
        feature={selected}
        isNewUser={isNewUser}
        onClose={() => setSelected(null)}
        onClaim={() => setSelected(null)}
        onChallenge={() => setSelected(null)}
        onDefend={() => setSelected(null)}
      />
    )}
  </>
)
```

- [ ] **Step 3: TypeScript check**

```bash
cd C:/projects/conquest && npx tsc --noEmit 2>&1 | grep "MapPanZoom\|KingdomMapClient" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:/projects/conquest
git add components/map/MapPanZoom.tsx components/map/KingdomMapClient.tsx
git commit -m "feat: map pan/zoom with boundary limits (pointer + wheel + pinch)"
```

---

## Task 4: API routes — claim, challenge, resolve

**Files:**
- Create: `app/api/claim/route.ts`
- Create: `app/api/challenge/route.ts`
- Create: `app/api/resolve/route.ts`

- [ ] **Step 1: Create app/api/claim/route.ts**

Called after the player beats Stockfish on a neutral territory.

```typescript
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
```

- [ ] **Step 2: Create app/api/challenge/route.ts**

Called when user initiates a challenge (attack bot or human territory).

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient_ } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { territory_name, defender_id } = await req.json() as {
    territory_name: string
    defender_id: string | null   // null = neutral (vs Stockfish)
  }
  if (!territory_name) return NextResponse.json({ error: 'territory_name required' }, { status: 400 })

  const service = createServiceClient()

  // Find territory id
  const { data: territory } = await service
    .from('territories')
    .select('id')
    .eq('name', territory_name)
    .single()
  if (!territory) return NextResponse.json({ error: 'Territory not found' }, { status: 404 })

  const { data: challenge, error } = await service
    .from('challenges')
    .insert({
      territory_id:   territory.id,
      challenger_id:  user.id,
      defender_id:    defender_id ?? user.id,  // self-challenge for neutral (vs bot)
      status:         'active',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ challenge_id: challenge.id })
}
```

- [ ] **Step 3: Create app/api/resolve/route.ts**

Called when the chess game ends.

```typescript
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

  // Fetch challenge
  const { data: challenge } = await service
    .from('challenges')
    .select('*, territory:territories(name, owner_id)')
    .eq('id', challenge_id)
    .single()
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

  const winnerId = winner === 'challenger' ? challenge.challenger_id : challenge.defender_id

  // Update challenge status
  await service
    .from('challenges')
    .update({ status: 'completed', winner_id: winnerId })
    .eq('id', challenge_id)

  // Transfer territory if challenger won
  if (winner === 'challenger') {
    await service
      .from('territories')
      .update({ owner_id: challenge.challenger_id })
      .eq('id', challenge.territory_id)
  }

  return NextResponse.json({ ok: true, winner_id: winnerId })
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd C:/projects/conquest && npx tsc --noEmit 2>&1 | grep "api/" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd C:/projects/conquest
git add app/api/claim/route.ts app/api/challenge/route.ts app/api/resolve/route.ts
git commit -m "feat: add claim/challenge/resolve API routes"
```

---

## Task 5: Stockfish Web Worker + Game page

**Files:**
- Create: `public/stockfish-worker.js`
- Create: `components/chess/ChessGame.tsx`
- Create: `app/game/[id]/page.tsx`

- [ ] **Step 1: Create public/stockfish-worker.js**

```javascript
// public/stockfish-worker.js
// Loads stockfish.js and bridges postMessage
importScripts('/stockfish/stockfish.js')

let stockfish

async function init() {
  // stockfish.js exposes Stockfish() factory
  stockfish = await Stockfish()
  stockfish.addMessageListener(line => {
    self.postMessage(line)
  })
  stockfish.postMessage('uci')
  stockfish.postMessage('isready')
}

self.onmessage = (e) => {
  if (!stockfish) return
  stockfish.postMessage(e.data)
}

init()
```

- [ ] **Step 2: Copy stockfish wasm to public**

```bash
cd C:/projects/conquest
# Copy stockfish files from node_modules to public so the worker can importScripts
mkdir -p public/stockfish
cp node_modules/stockfish/src/stockfish.js public/stockfish/ 2>/dev/null || \
  cp node_modules/stockfish/stockfish.js public/stockfish/ 2>/dev/null || \
  echo "Check node_modules/stockfish/ for the .js file"
ls public/stockfish/
```

If the copy fails, check: `ls node_modules/stockfish/` and copy the correct file.

- [ ] **Step 3: Create components/chess/ChessGame.tsx**

```tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useRouter } from 'next/navigation'

interface Props {
  challengeId: string
  territoryName: string
  mode: 'vs-bot' | 'vs-human'
  playerColor: 'w' | 'b'      // which color the user plays
  initialFen?: string
  onGameEnd?: (winner: 'challenger' | 'defender') => void
}

export default function ChessGame({ challengeId, territoryName, mode, playerColor, initialFen, onGameEnd }: Props) {
  const router = useRouter()
  const [game, setGame] = useState(() => {
    const g = new Chess()
    if (initialFen) g.load(initialFen)
    return g
  })
  const [fen, setFen] = useState(game.fen())
  const [status, setStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [resolving, setResolving] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const gameRef = useRef(game)
  gameRef.current = game

  // Init Stockfish worker (bot mode only)
  useEffect(() => {
    if (mode !== 'vs-bot') return
    const w = new Worker('/stockfish-worker.js')
    workerRef.current = w
    w.onmessage = (e: MessageEvent<string>) => {
      const line: string = e.data
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ')
        const move = parts[1]
        if (!move || move === '(none)') return
        const from = move.slice(0, 2)
        const to   = move.slice(2, 4)
        const promo = move.slice(4) || undefined
        makeMove({ from, to, promotion: promo as 'q' | undefined }, false)
      }
    }
    return () => w.terminate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function sendToStockfish(fen: string) {
    const w = workerRef.current
    if (!w) return
    w.postMessage('position fen ' + fen)
    w.postMessage('go depth 10')
  }

  function makeMove(move: { from: string; to: string; promotion?: 'q' }, isByPlayer: boolean) {
    const g = new Chess(gameRef.current.fen())
    try {
      g.move(move)
    } catch {
      return false
    }
    setGame(g)
    setFen(g.fen())
    setLastMove({ from: move.from, to: move.to })

    if (g.isGameOver()) {
      handleGameOver(g, isByPlayer)
      return true
    }

    // If it's now the bot's turn, ask Stockfish
    if (mode === 'vs-bot' && g.turn() !== playerColor) {
      sendToStockfish(g.fen())
    }

    return true
  }

  function handleGameOver(g: Chess, playerMadeLastMove: boolean) {
    let result: 'won' | 'lost' | 'draw' = 'draw'
    if (g.isCheckmate()) {
      // The player who just moved won — if playerMadeLastMove, player won
      result = playerMadeLastMove ? 'won' : 'lost'
    } else {
      result = 'draw' // stalemate / insufficient material / etc.
    }
    setStatus(result)
  }

  async function resolveChallenge(result: 'won' | 'lost' | 'draw') {
    setResolving(true)
    const winner = result === 'won' ? 'challenger' : 'defender'
    await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, winner }),
    })
    setResolving(false)
    onGameEnd?.(winner)
  }

  function onDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
    if (status !== 'playing') return false
    if (gameRef.current.turn() !== playerColor) return false
    const promo = piece[1]?.toLowerCase() === 'p' &&
      (targetSquare[1] === '8' || targetSquare[1] === '1') ? 'q' : undefined
    return makeMove({ from: sourceSquare, to: targetSquare, promotion: promo as 'q' | undefined }, true)
  }

  const customSquareStyles: Record<string, React.CSSProperties> = {}
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(184,151,88,0.35)' }
    customSquareStyles[lastMove.to]   = { background: 'rgba(184,151,88,0.55)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', gap: 16 }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {mode === 'vs-bot' ? 'vs Stockfish' : 'vs Challenger'}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {territoryName}
        </div>
      </div>

      {/* Board */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'w' ? 'white' : 'black'}
          customSquareStyles={customSquareStyles}
          customDarkSquareStyle={{ backgroundColor: '#b5a07a' }}
          customLightSquareStyle={{ backgroundColor: '#f4f1ea' }}
          arePiecesDraggable={status === 'playing' && game.turn() === playerColor}
        />
      </div>

      {/* Status */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        {status === 'playing' && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {game.turn() === playerColor ? 'Your move' : 'Opponent thinking…'}
          </div>
        )}

        {status !== 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              padding: '16px', borderRadius: 14,
              background: status === 'won' ? 'var(--ink)' : status === 'lost' ? '#fff0ee' : 'var(--bg-warm)',
              border: status === 'lost' ? '0.5px solid var(--red)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'italic', color: status === 'won' ? '#f4f1ea' : status === 'lost' ? 'var(--red)' : 'var(--ink)' }}>
                {status === 'won' ? '⚔ Victory' : status === 'lost' ? 'Defeat' : 'Draw'}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: status === 'won' ? 'rgba(244,241,234,0.7)' : 'var(--muted)', marginTop: 4 }}>
                {status === 'won' ? `${territoryName} is now yours.` : status === 'lost' ? 'The territory holds.' : 'No territory changes.'}
              </div>
            </div>
            <button onClick={() => resolveChallenge(status)} disabled={resolving} style={{
              width: '100%', height: 52, borderRadius: 14,
              background: 'var(--ink)', color: '#f4f1ea', border: 'none',
              fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14,
              letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              opacity: resolving ? 0.6 : 1,
            }}>
              {resolving ? 'Saving…' : 'Return to Map'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create app/game/[id]/page.tsx**

```tsx
import { createServerClient_ } from '@/lib/supabase-server'
import ChessGame from '@/components/chess/ChessGame'
import { redirect } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GamePage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: challenge } = await supabase
    .from('challenges')
    .select('*, territory:territories(name), challenger:profiles!challenger_id(id, username), defender:profiles!defender_id(id, username)')
    .eq('id', id)
    .single()

  if (!challenge) redirect('/')

  // Determine player color: challenger = white, defender = black
  const playerColor = challenge.challenger_id === user.id ? 'w' : 'b'
  const isVsBot = challenge.challenger_id === challenge.defender_id  // self-challenge = vs Stockfish
  const mode = isVsBot ? 'vs-bot' : 'vs-human'
  const territoryName = (challenge.territory as { name: string } | null)?.name ?? 'Unknown'

  return (
    <main style={{
      width: '100%', maxWidth: 390, margin: '0 auto',
      minHeight: '100dvh', background: 'var(--bg)',
      paddingBottom: 100, overflowY: 'auto',
    }} className="cq-scroll">
      {/* Back button */}
      <div style={{ padding: '52px 16px 0' }}>
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'var(--muted)', textDecoration: 'none',
        }}>
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <path d="M11 6H3M3 6L7 2M3 6L7 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Map
        </a>
      </div>

      <ChessGame
        challengeId={id}
        territoryName={territoryName}
        mode={mode}
        playerColor={playerColor}
        initialFen={challenge.current_fen ?? undefined}
      />

      <TabBar active="challenge" />
    </main>
  )
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd C:/projects/conquest && npx tsc --noEmit 2>&1 | grep -E "ChessGame|game\[id\]|stockfish" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd C:/projects/conquest
git add public/stockfish-worker.js public/stockfish/ components/chess/ChessGame.tsx app/game/[id]/page.tsx
git commit -m "feat: chess game page with Stockfish worker + react-chessboard"
```

---

## Task 6: Challenge page + wire TerritorySheet CTAs

**Files:**
- Create: `app/challenge/page.tsx`
- Modify: `components/map/KingdomMapClient.tsx` — wire onClaim/onChallenge/onDefend

- [ ] **Step 1: Create app/challenge/page.tsx**

```tsx
import { createServerClient_ } from '@/lib/supabase-server'
import TabBar from '@/components/ui/TabBar'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ChallengePage() {
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Challenges where user is involved
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

function ForfeitButton({ challengeId }: { challengeId: string }) {
  return (
    <form action={`/api/resolve`} method="POST" style={{ flex: 1 }}>
      <input type="hidden" name="challenge_id" value={challengeId} />
      <input type="hidden" name="winner" value="challenger" />
      <button type="submit" style={{
        width: '100%', height: 44, borderRadius: 12,
        background: 'transparent', border: '0.5px solid var(--line)',
        fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--muted)',
        letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
      }}>Forfeit</button>
    </form>
  )
}
```

- [ ] **Step 2: Wire TerritorySheet CTAs in KingdomMapClient.tsx**

Replace the full `KingdomMapClient.tsx` with this version that wires the CTAs:

```tsx
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ConquestMap from './ConquestMap'
import MapPanZoom from './MapPanZoom'
import TerritorySheet from './TerritorySheet'
import type { Territory, CountryFeature } from '@/lib/types'
import { NAME_TO_ALPHA2 } from '@/lib/country-codes'
import { buildBotOwnerMap } from '@/lib/game-state'

interface Props {
  initialTerritories: Territory[]
  currentUserId?: string
  currentUsername?: string
  isNewUser?: boolean
}

export default function KingdomMapClient({
  initialTerritories,
  currentUserId,
  currentUsername = '',
  isNewUser = false,
}: Props) {
  const router = useRouter()
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // Realtime: territory ownership changes
  useEffect(() => {
    const channel = supabase
      .channel('world-map')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'territories' }, async (payload) => {
        const { data } = await supabase
          .from('territories')
          .select('*, owner:profiles(*)')
          .eq('id', payload.new.id)
          .single()
        if (data) setTerritories(prev => prev.map(t => t.id === data.id ? data : t))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Player's country codes (alpha-2)
  const playerCodes = useMemo(() =>
    territories
      .filter(t => t.owner?.username === currentUsername)
      .map(t => NAME_TO_ALPHA2[t.name] ?? '')
      .filter(Boolean),
    [territories, currentUsername]
  )

  // Bot owner map from live territories
  const liveBotOwnerMap = useMemo(() => {
    const liveMap: Record<string, string> = { ...buildBotOwnerMap() }
    for (const t of territories) {
      const code = NAME_TO_ALPHA2[t.name]
      if (code && t.owner?.username && t.owner.username !== currentUsername) {
        liveMap[code] = t.owner.username
      }
    }
    return liveMap
  }, [territories, currentUsername])

  // Find territory in DB by country name
  function findTerritory(name: string) {
    return territories.find(t => t.name === name)
  }

  // Claim a neutral territory (vs Stockfish)
  const handleClaim = useCallback(async () => {
    if (!selected || !currentUserId) return
    setActionLoading(true)
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territory_name: selected.name, defender_id: null }),
    })
    const data = await res.json()
    setActionLoading(false)
    setSelected(null)
    if (data.challenge_id) router.push(`/game/${data.challenge_id}`)
  }, [selected, currentUserId, router])

  // Challenge an enemy territory
  const handleChallenge = useCallback(async () => {
    if (!selected || !currentUserId) return
    setActionLoading(true)
    const territory = findTerritory(selected.name)
    const defenderId = territory?.owner_id ?? null
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territory_name: selected.name, defender_id: defenderId }),
    })
    const data = await res.json()
    setActionLoading(false)
    setSelected(null)
    if (data.challenge_id) router.push(`/game/${data.challenge_id}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentUserId, router, territories])

  // Defend: find existing active challenge and go to its game page
  const handleDefend = useCallback(async () => {
    if (!selected || !currentUserId) return
    const territory = findTerritory(selected.name)
    if (!territory) return
    const { data: challenges } = await supabase
      .from('challenges')
      .select('id')
      .eq('territory_id', territory.id)
      .eq('defender_id', currentUserId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
    setSelected(null)
    if (challenges?.[0]) router.push(`/game/${challenges[0].id}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentUserId, router, territories, supabase])

  return (
    <>
      <MapPanZoom minScale={1} maxScale={5}>
        <ConquestMap
          playerCodes={playerCodes}
          botOwnerMap={liveBotOwnerMap}
          currentUsername={currentUsername}
          isNewUser={isNewUser}
          size="xxl"
          onCountryClick={setSelected}
        />
      </MapPanZoom>
      {selected && (
        <TerritorySheet
          feature={selected}
          isNewUser={isNewUser}
          onClose={() => setSelected(null)}
          onClaim={handleClaim}
          onChallenge={handleChallenge}
          onDefend={handleDefend}
        />
      )}
      {actionLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '20px 32px', fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic' }}>
            Preparing battle…
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd C:/projects/conquest && npx tsc --noEmit 2>&1 | grep -E "challenge|KingdomMap|TerritorySheet" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:/projects/conquest
git add app/challenge/page.tsx components/map/KingdomMapClient.tsx
git commit -m "feat: challenge page + wire TerritorySheet CTAs to real game flow"
```

---

## Task 7: Dynasty page + drawer real data

**Files:**
- Modify: `app/dynasty/page.tsx`
- Modify: `app/page.tsx` — remove DEFAULT_COUNTRY_STATUS dependency for logged-in users

- [ ] **Step 1: Replace app/dynasty/page.tsx with live data**

```tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:/projects/conquest && npx tsc --noEmit 2>&1 | grep "dynasty" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/projects/conquest
git add app/dynasty/page.tsx
git commit -m "feat: dynasty page shows real territory + challenge data from DB"
```

---

## Self-Review

### Spec coverage
- ✅ App starts with map → redirects to /auth if not logged in (Task 1, middleware)
- ✅ Email/password sign-in (Task 1, SignInView)
- ✅ Email/password sign-up with real Supabase signUp (Task 2, onboarding)
- ✅ Profile created in DB during onboarding (Task 2)
- ✅ Map draggable (Task 3, MapPanZoom pointer events)
- ✅ Map zoomable (Task 3, wheel + pinch)
- ✅ Map boundary limits — can't pan outside edges (Task 3, clamp function)
- ✅ Challenge page working (Task 6)
- ✅ Game page with chess board (Task 5)
- ✅ Territory claim → game vs Stockfish → transfer (Tasks 4+5+6)
- ✅ Dynasty page real data (Task 7)
- ✅ Drawer stats come from live territories (app/page.tsx already queries live data for logged-in users)

### Type consistency
- `ChessGame` props: `challengeId: string`, `mode: 'vs-bot' | 'vs-human'`, `playerColor: 'w' | 'b'` — consistent with game page usage
- `/api/challenge` body: `{ territory_name, defender_id }` — consistent with `handleClaim` / `handleChallenge`
- `/api/resolve` body: `{ challenge_id, winner: 'challenger' | 'defender' }` — consistent with `ChessGame.resolveChallenge`
- Bot-vs-self detection: `challenger_id === defender_id` (set when defender_id is null → gets set to user.id in API route) — consistent

### Potential issues
- Stockfish worker path: `public/stockfish-worker.js` imports from `/stockfish/stockfish.js`. If `stockfish.js` isn't found in `public/stockfish/`, the worker will silently fail. Verify `ls public/stockfish/` after Task 5 Step 2.
- Supabase email confirmation: **must be disabled** in Dashboard > Authentication > Email for sign-up to work without waiting for email. Add this note prominently for the implementer.
- The `ForfeitButton` in challenge page uses a native form POST to `/api/resolve`. This works for forfeit but the server returns JSON, not a redirect. Consider adding a Server Action or client-side button instead if native form POST causes issues.
