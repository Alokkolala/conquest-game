'use client'

import { useState, useEffect } from 'react'
import { getGameSettings, patchGameSettings, resetGameSettings, depthLabel } from '@/lib/game-settings'
import type { GameSettings } from '@/lib/game-settings'

export default function AdminPanel() {
  const [open, setOpen]         = useState(false)
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setSettings(getGameSettings())
  }, [])

  function patch(p: Partial<GameSettings>) {
    const next = patchGameSettings(p)
    setSettings(next)
  }

  async function handleResetTerritories() {
    if (!confirm('Release all your territories back to the map? This cannot be undone.')) return
    setResetting(true)
    await fetch('/api/admin/reset-territories', { method: 'POST' })
    setResetting(false)
    setResetDone(true)
    setTimeout(() => setResetDone(false), 3000)
  }

  function handleResetSettings() {
    const defaults = resetGameSettings()
    setSettings(defaults)
  }

  if (!settings) return null  // SSR guard

  return (
    <div style={{ margin: '24px 16px 0' }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderRadius: open ? '18px 18px 0 0' : 18,
          background: 'var(--ink)', color: '#f4f1ea', border: 'none', cursor: 'pointer',
          transition: 'border-radius 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="#f4f1ea" strokeWidth="1.2"/>
            <path d="M7 4v3.5l2 1.5" stroke="#f4f1ea" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Admin Panel
          </span>
        </div>
        <svg
          width="12" height="8" viewBox="0 0 12 8" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M1 1l5 5 5-5" stroke="#f4f1ea" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Panel body */}
      {open && (
        <div style={{
          background: '#fff', border: '0.5px solid var(--line)',
          borderTop: 'none', borderRadius: '0 0 18px 18px',
          padding: '0 0 4px',
          overflow: 'hidden',
        }}>

          {/* ── Section: Stockfish Engine ── */}
          <Section label="Stockfish Engine">
            <SliderRow
              label="Claim Depth"
              hint="Difficulty when claiming a neutral territory"
              value={settings.claimDepth}
              min={1} max={20}
              onChange={v => patch({ claimDepth: v })}
            />
            <SliderRow
              label="Attack Depth"
              hint="Difficulty when attacking a bot's territory"
              value={settings.attackDepth}
              min={1} max={20}
              onChange={v => patch({ attackDepth: v })}
            />
          </Section>

          {/* ── Section: Map ── */}
          <Section label="Map">
            <ToggleRow
              label="Pulse Animations"
              hint="Gold/red pulse on claimable and attackable territories"
              value={settings.mapAnimations}
              onChange={v => patch({ mapAnimations: v })}
            />
          </Section>

          {/* ── Section: Chess ── */}
          <Section label="Chess">
            <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Default Side
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['w', 'b', 'random'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => patch({ playerColor: c })}
                    style={{
                      flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12,
                      letterSpacing: '0.05em',
                      background: settings.playerColor === c ? 'var(--ink)' : 'var(--bg-warm)',
                      color: settings.playerColor === c ? '#f4f1ea' : 'var(--muted)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Side to play as in new chess games.
              </div>
            </div>
          </Section>

          {/* ── Section: Data ── */}
          <Section label="Data">
            <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleResetTerritories}
                disabled={resetting}
                style={{
                  height: 44, borderRadius: 12, border: '1px solid var(--red)',
                  background: 'transparent', color: resetting ? 'var(--muted)' : 'var(--red)',
                  fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
                  letterSpacing: '0.05em', cursor: resetting ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.15s',
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? 'Releasing\u2026' : resetDone ? 'Done \u2014 reload the map' : 'Release All My Territories'}
              </button>
              <button
                onClick={handleResetSettings}
                style={{
                  height: 44, borderRadius: 12, border: '1px solid var(--line)',
                  background: 'transparent', color: 'var(--ink)',
                  fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
                  letterSpacing: '0.05em', cursor: 'pointer',
                }}
              >
                Reset Settings to Default
              </button>
            </div>
          </Section>

        </div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '0.5px solid var(--line-soft)' }}>
      <div style={{
        padding: '12px 18px 4px',
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em',
        textTransform: 'uppercase', color: 'var(--muted)',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function SliderRow({
  label, hint, value, min, max, onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ padding: '10px 18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
            {label}
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
            {hint}
          </span>
        </div>
        <div style={{ flexShrink: 0, marginLeft: 12, textAlign: 'right' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {value}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', marginLeft: 4, letterSpacing: '0.1em' }}>
            {depthLabel(value).toUpperCase()}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--ink)', height: 4, cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--line)', letterSpacing: '0.1em' }}>
          {min} EASIEST
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--line)', letterSpacing: '0.1em' }}>
          HARDEST {max}
        </span>
      </div>
    </div>
  )
}

function ToggleRow({ label, hint, value, onChange }: {
  label: string; hint: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      padding: '12px 18px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {hint}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none',
          background: value ? 'var(--ink)' : 'var(--line)',
          cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s',
        }}
        aria-checked={value}
        role="switch"
      >
        <span style={{
          position: 'absolute', top: 3,
          left: value ? 23 : 3,
          width: 20, height: 20, borderRadius: 999,
          background: '#fff',
          transition: 'left 0.2s',
          display: 'block',
        }} />
      </button>
    </div>
  )
}
