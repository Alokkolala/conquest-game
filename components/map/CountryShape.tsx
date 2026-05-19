'use client'

import { useState } from 'react'
import type { CountryFeature } from '@/lib/types'

interface Props {
  feature: CountryFeature
  isHighlighted?: boolean
  isDragging: boolean
  onCountryClick?: (feature: CountryFeature) => void
}

function getFill(status: CountryFeature['status'], hovered: boolean) {
  if (status === 'owned')     return hovered ? '#2a2a2a' : 'var(--ink)'
  if (status === 'enemy')     return hovered ? '#4a4038' : '#2a2520'
  if (status === 'contested') return hovered ? '#e04020' : 'var(--red)'
  // neutral
  return hovered ? '#ddd8ce' : 'var(--warm)'
}

function getStroke(status: CountryFeature['status'], hovered: boolean, isHighlighted: boolean) {
  if (isHighlighted) return 'var(--red)'
  if (hovered) return status === 'neutral' ? '#b8b3aa' : 'rgba(255,255,255,0.3)'
  if (status === 'owned')     return '#222'
  if (status === 'enemy')     return '#1a1512'
  if (status === 'contested') return 'var(--red)'
  return 'var(--line)'
}

function getLabelColor(status: CountryFeature['status']) {
  if (status === 'neutral') return 'var(--muted)'
  return '#ffffff'
}

export default function CountryShape({ feature, isHighlighted = false, isDragging, onCountryClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const { name, path, center, status, owner } = feature
  const [cx, cy] = center

  const fill   = getFill(status, hovered)
  const stroke = getStroke(status, hovered, isHighlighted)
  const sw     = isHighlighted ? 2.5 : status === 'neutral' ? 0.7 : 1.2

  return (
    <g
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={() => { if (!isDragging) onCountryClick?.(feature) }}
      style={{ cursor: onCountryClick ? 'pointer' : 'default' }}
    >
      {/* Drop shadow for active territories */}
      {status !== 'neutral' && (
        <path d={path} fill="#111" transform="translate(1.2,1.8)" opacity={0.07} />
      )}

      {/* Main shape */}
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: 'fill 0.15s ease, stroke 0.15s ease' }}
      />

      {/* Highlight ring */}
      {isHighlighted && (
        <path d={path} fill="none" stroke="var(--red)" strokeWidth="3" strokeOpacity="0.55" strokeLinejoin="round" />
      )}

      {/* Contested pulse dots */}
      {status === 'contested' && (
        <>
          <circle cx={cx} cy={cy} r={5} fill="var(--red)" opacity={0.55} className="cq-pulse-dot" />
          <circle cx={cx} cy={cy} r={5} fill="var(--red)" opacity={0.4} className="cq-pulse-dot" style={{ animationDelay: '0.8s' }} />
        </>
      )}

      {/* Label — always show for active, show on hover for neutral */}
      {(status !== 'neutral' || hovered) && (
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="var(--mono)"
          fontSize={hovered && status === 'neutral' ? 10 : 9}
          fontWeight="700"
          fill={getLabelColor(status)}
          letterSpacing="0.07em"
          style={{ textTransform: 'uppercase', pointerEvents: 'none', transition: 'font-size 0.1s' }}
        >
          {name.length > 11 ? name.slice(0, 10) + '\u2026' : name}
        </text>
      )}

      {/* Hover tooltip for neutral claimable */}
      {hovered && status === 'neutral' && (
        <g transform={`translate(${cx},${cy - 18})`} style={{ pointerEvents: 'none' }}>
          <rect x={-28} y={-12} width={56} height={14} rx={4} fill="var(--ink)" opacity={0.85} />
          <text textAnchor="middle" dominantBaseline="middle" y={-5} fontFamily="var(--mono)" fontSize={8} fill="#fff" letterSpacing="0.1em">CLAIM</text>
        </g>
      )}

      {/* Hover tooltip for enemy/contested */}
      {hovered && (status === 'enemy' || status === 'contested') && owner && (
        <g transform={`translate(${cx},${cy - 20})`} style={{ pointerEvents: 'none' }}>
          <rect x={-32} y={-13} width={64} height={15} rx={4} fill="var(--ink)" opacity={0.9} />
          <text textAnchor="middle" dominantBaseline="middle" y={-6} fontFamily="var(--mono)" fontSize={8} fill={status === 'contested' ? '#ff8870' : '#d0c8bc'} letterSpacing="0.08em">
            {owner.length > 9 ? owner.slice(0, 8) + '\u2026' : owner}
          </text>
        </g>
      )}
    </g>
  )
}
