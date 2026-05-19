'use client'

import { useMemo } from 'react'
import { buildCountryFeatures, VB_W, VB_H } from '@/lib/world-territories'
import type { CountryFeature, TerritoryStatus } from '@/lib/types'

function fillFor(status: TerritoryStatus) {
  if (status === 'owned')     return 'var(--ink)'
  if (status === 'enemy')     return 'var(--soft)'
  if (status === 'contested') return 'var(--red)'
  return 'var(--warm)'
}
function strokeFor(status: TerritoryStatus) {
  if (status === 'owned')     return 'var(--ink)'
  if (status === 'enemy')     return 'var(--soft)'
  if (status === 'contested') return 'var(--red)'
  return 'var(--line)'
}
function strokeWidthFor(status: TerritoryStatus, isHL: boolean) {
  if (isHL) return 2.5
  if (status === 'neutral') return 0.8
  return 1.4
}
function labelColorFor(status: TerritoryStatus) {
  if (status === 'owned')     return '#ffffff'
  if (status === 'enemy')     return '#e6e1d3'
  if (status === 'contested') return '#ffffff'
  return 'var(--muted)'
}

interface Props {
  width?: number
  height?: number
  ownerMap?: Record<string, string>
  currentUsername?: string
  highlightId?: string | null
  flipState?: 'win' | 'lose' | null
  showLabels?: boolean
  pulseContested?: boolean
  onCountryClick?: (feature: CountryFeature) => void
}

export default function WorldMap({
  width = 390,
  height = 250,
  ownerMap = {},
  currentUsername = '',
  highlightId = null,
  flipState = null,
  showLabels = true,
  pulseContested = true,
  onCountryClick,
}: Props) {
  const features = useMemo(
    () => buildCountryFeatures(ownerMap, currentUsername),
    [ownerMap, currentUsername]
  )

  const labelFeatures = showLabels
    ? features.filter(f => f.status !== 'neutral')
    : []

  return (
    <svg
      role="img"
      aria-label="World territory map"
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', background: 'var(--bg)' }}
    >
      <title>World territory map</title>
      {/* Latitude / longitude hairlines */}
      <g stroke="var(--line)" strokeWidth="0.4" opacity="0.5">
        {[-60, -30, 0, 30, 60].map(lat => {
          const y = (90 - lat) / 180 * VB_H
          return <line key={'lat' + lat} x1="0" x2={VB_W} y1={y} y2={y} />
        })}
        {[-150, -100, -50, 0, 50, 100, 150].map(lng => {
          const x = (lng + 180) / 360 * VB_W
          return <line key={'lng' + lng} x1={x} x2={x} y1="0" y2={VB_H} />
        })}
      </g>

      {/* Equator label */}
      <text
        x={VB_W - 4} y={(90 / 180) * VB_H - 3}
        textAnchor="end"
        fontFamily="var(--mono)" fontSize="8"
        fill="var(--muted)" opacity="0.7"
      >00°</text>

      {/* Drop shadow for active territories */}
      <g opacity="0.06">
        {features
          .filter(f => f.status !== 'neutral')
          .map(f => (
            <path key={'sh' + f.id} d={f.path} fill="#111" transform="translate(1.5,2)" />
          ))}
      </g>

      {/* Country paths */}
      <g strokeLinejoin="round" strokeLinecap="round">
        {features.map(f => {
          const isHL = f.id === highlightId
          const flipCls = isHL && flipState ? `cq-flipping-${flipState}` : ''
          return (
            <g
              key={f.id}
              className={flipCls}
              onClick={() => onCountryClick?.(f)}
              style={{ cursor: onCountryClick ? 'pointer' : 'default' }}
            >
              <path
                d={f.path}
                fill={fillFor(f.status)}
                stroke={strokeFor(f.status)}
                strokeWidth={strokeWidthFor(f.status, isHL)}
              />
              {isHL && (
                <path
                  d={f.path}
                  fill="none"
                  stroke="var(--red)"
                  strokeWidth="3"
                  strokeOpacity="0.55"
                />
              )}
            </g>
          )
        })}
      </g>

      {/* Contested pulse rings */}
      {pulseContested &&
        features
          .filter(f => f.status === 'contested')
          .map(f => {
            const [cx, cy] = f.center
            return (
              <g key={'p' + f.id} transform={`translate(${cx} ${cy})`}>
                <circle r="5" fill="var(--red)" opacity="0.55" className="cq-pulse-dot" />
                <circle
                  r="5" fill="var(--red)" opacity="0.4" className="cq-pulse-dot"
                  style={{ animationDelay: '0.8s' }}
                />
              </g>
            )
          })}

      {/* Labels — only owned/enemy/contested */}
      {labelFeatures.map(f => {
        const [cx, cy] = f.center
        if (cx < 0 || cx > VB_W || cy < 0 || cy > VB_H) return null
        return (
          <text
            key={'l' + f.id}
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--mono)"
            fontSize="9"
            fontWeight="700"
            fill={labelColorFor(f.status)}
            letterSpacing="0.08em"
            style={{ textTransform: 'uppercase', pointerEvents: 'none' }}
          >
            {f.name.length > 12 ? f.name.slice(0, 11) + '…' : f.name}
          </text>
        )
      })}
    </svg>
  )
}
