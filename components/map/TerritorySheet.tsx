'use client'

import type { CountryFeature } from '@/lib/types'

interface Props {
  feature: CountryFeature
  isNewUser?: boolean
  onClose: () => void
  onClaim?: () => void
  onChallenge?: () => void
  onDefend?: () => void
}

export default function TerritorySheet({ feature, isNewUser = false, onClose, onClaim, onChallenge, onDefend }: Props) {
  const { name, status, owner, ownerElo, value, held } = feature

  function handleCTA() {
    if (status === 'neutral')        onClaim?.()
    else if (status === 'enemy')     onChallenge?.()
    else if (status === 'contested') onDefend?.()
    onClose()
  }

  const ctaLabel =
    status === 'enemy'     ? 'Challenge for Territory' :
    status === 'contested' ? 'Defend Now'              :
    status === 'owned'     ? 'Garrison · Manage'       :
    isNewUser              ? 'Plant Your Banner'        :
    'Claim Territory'

  const statusLabel =
    status === 'neutral'   ? 'UNCLAIMED'               :
    status === 'enemy'     ? `HELD BY ${owner ?? '—'}` :
    status === 'owned'     ? 'YOURS'                   :
    'UNDER SIEGE'

  const statusColor =
    status === 'contested' ? 'var(--red)' :
    status === 'owned'     ? 'var(--ink)' : 'var(--muted)'

  const bodyText =
    status === 'enemy'     ? `Take ${name} from ${owner} in a single game. Win and the flag flips.` :
    status === 'contested' ? 'Your hold is under siege. Win the next match or the territory falls.' :
    status === 'owned'     ? `This territory pays you ${Math.round(value)} pts daily. Defend on challenge.` :
    isNewUser              ? 'Your first territory. Plant your banner here to begin your conquest.' :
    'Unclaimed. First win plants your banner.'

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 45,
          background: 'rgba(0,0,0,0.12)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 390,
        zIndex: 50,
        background: 'var(--bg)',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: '14px 24px 96px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--line)' }} />
        </div>

        {/* Code + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.14em', color: 'var(--muted)',
          }}>{feature.id}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--muted)', display: 'inline-block' }} />
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', color: statusColor, textTransform: 'uppercase',
          }}>{statusLabel}</span>
        </div>

        {/* Country name */}
        <div style={{
          fontFamily: 'var(--serif)', fontSize: 44, lineHeight: 1,
          letterSpacing: '-0.025em', marginTop: 12,
        }}>{name}</div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          marginTop: 22, paddingTop: 16, paddingBottom: 16,
          borderTop: '0.5px solid var(--line)',
          borderBottom: '0.5px solid var(--line)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Stake</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1, marginTop: 4 }}>
              {Math.round(value * 10) / 10}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 3 }}>pts</span>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Defender</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.1, marginTop: 4, letterSpacing: '-0.01em' }}>
              {status === 'neutral' ? 'Unclaimed' : status === 'owned' ? 'You' : owner ?? '—'}
            </div>
            {ownerElo !== undefined && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em' }}>
                ELO {ownerElo}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Held</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1, marginTop: 4 }}>
              {held ?? 0}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 3 }}>d</span>
            </div>
          </div>
        </div>

        {/* Body copy */}
        <p style={{
          fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.35,
          color: 'var(--ink-soft)', marginTop: 16, fontStyle: 'italic',
        }}>{bodyText}</p>

        {/* CTAs */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {status !== 'owned' && (
            <button onClick={handleCTA} style={{
              width: '100%', height: 56, borderRadius: 14,
              background: 'var(--ink)', color: '#fff', border: 'none',
              fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {ctaLabel}
              <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
                <path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', height: 50, borderRadius: 14,
            background: 'transparent', color: 'var(--ink)',
            border: '1px solid var(--line)',
            fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>Back to Map</button>
        </div>
      </div>
    </>
  )
}
