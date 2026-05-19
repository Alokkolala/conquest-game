'use client'

import type React from 'react'
import { Hexagon, Text } from 'react-hexgrid'
import type { Territory } from '@/lib/types'

interface Props {
  territory: Territory
  isContested: boolean
  currentUserId: string | null
  onClick: (territory: Territory) => void
}

function hexFill(t: Territory, uid: string | null): string {
  if (!t.owner_id) return '#2a2a2a'
  if (t.owner_id === uid) return '#1a3a1a'
  return t.owner?.display_color ?? '#444444'
}

function hexStroke(t: Territory, isContested: boolean, uid: string | null): string {
  if (isContested) return '#8b2020'
  if (t.owner_id === uid) return '#c8a96e'
  return '#555555'
}

export default function TerritoryHex({ territory, isContested, currentUserId, onClick }: Props) {
  const fill   = hexFill(territory, currentUserId)
  const stroke = hexStroke(territory, isContested, currentUserId)
  const s      = -territory.hex_q - territory.hex_r

  // Trim long names to fit inside hex
  const label = territory.name.replace(/^The /, '').slice(0, 11)

  const handleClick = (_event: React.MouseEvent<SVGGElement>, _h: unknown) => {
    onClick(territory)
  }

  return (
    <Hexagon
      q={territory.hex_q}
      r={territory.hex_r}
      s={s}
      fill={fill}
      onClick={handleClick}
      cellStyle={{
        fill,
        stroke,
        strokeWidth: isContested ? 3 : 1.5,
        cursor: 'pointer',
      }}
      className={isContested ? 'contested' : undefined}
    >
      {/* Territory name */}
      <Text
        style={{
          fontSize: '0.22rem',
          fill: territory.owner_id === currentUserId ? '#c8a96e' : '#cccccc',
          fontFamily: 'Cinzel, serif',
          pointerEvents: 'none',
        }}
      >
        {label}
      </Text>

      {/* Owner username */}
      {territory.owner && (
        <Text
          y={0.42}
          style={{ fontSize: '0.17rem', fill: '#999999', pointerEvents: 'none' }}
        >
          {territory.owner.username.slice(0, 10)}
        </Text>
      )}

      {/* Contested icon */}
      {isContested && (
        <Text
          y={-0.4}
          style={{ fontSize: '0.28rem', pointerEvents: 'none' }}
        >
          ⚔️
        </Text>
      )}
    </Hexagon>
  )
}
