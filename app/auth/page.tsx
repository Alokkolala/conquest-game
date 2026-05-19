'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm space-y-8 p-8 border border-neutral-800 rounded-lg">
        <div className="text-center">
          <h1 className="font-cinzel text-3xl font-bold text-[#c8a96e] tracking-widest">
            CONQUEST
          </h1>
          <p className="mt-2 text-sm text-neutral-500">Territory Chess</p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-neutral-300">
            Check your email for the sign-in link.
          </p>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleGoogle}
              className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-sm font-medium transition-colors"
            >
              Continue with Google
            </button>

            <div className="relative flex items-center">
              <div className="flex-1 border-t border-neutral-800" />
              <span className="px-3 text-xs text-neutral-600">or</span>
              <div className="flex-1 border-t border-neutral-800" />
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded text-sm focus:outline-none focus:border-[#c8a96e] placeholder-neutral-600"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#c8a96e] hover:bg-[#b8995e] text-black font-semibold rounded text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
