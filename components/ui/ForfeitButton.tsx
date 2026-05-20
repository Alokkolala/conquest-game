'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ForfeitButton({ challengeId }: { challengeId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleForfeit() {
    setLoading(true)
    await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, winner: 'challenger' }),
    })
    router.refresh()
  }

  return (
    <button onClick={handleForfeit} disabled={loading} style={{
      flex: 1, height: 44, borderRadius: 12,
      background: 'transparent', border: '0.5px solid var(--line)',
      fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--muted)',
      letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
      opacity: loading ? 0.5 : 1,
    }}>
      {loading ? '…' : 'Forfeit'}
    </button>
  )
}
