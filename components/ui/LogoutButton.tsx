'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        marginTop: 20,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: '0.5px solid var(--line)',
        borderRadius: 10, padding: '9px 16px',
        fontFamily: 'var(--mono)', fontSize: 10,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: loading ? 'var(--muted)' : 'var(--ink-soft)',
        cursor: loading ? 'default' : 'pointer',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3M9 9l3-3-3-3M12 6.5H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
