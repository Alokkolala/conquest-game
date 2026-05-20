// components/onboarding/CountryPickerMap.tsx
'use client'

import { useMemo } from 'react'
import WorldMap from 'react-svg-worldmap'
import { buildBotOwnerMap, buildBotColorMap } from '@/lib/game-state'
import { ALPHA2_TO_NAME } from '@/lib/country-codes'

interface Props {
  selectedCode: string | null
  onSelect: (code: string, name: string) => void
}

export default function CountryPickerMap({ selectedCode, onSelect }: Props) {
  const botOwnerMap = useMemo(() => buildBotOwnerMap(), [])
  const botColorMap = useMemo(() => buildBotColorMap(), [])

  // All 144 known countries: bot=2, selected=5, claimable=3
  const mapData = useMemo(() =>
    Object.keys(ALPHA2_TO_NAME).map(code => ({
      country: code,
      value: botOwnerMap[code] ? 2 : code === selectedCode ? 5 : 3,
    })),
    [botOwnerMap, selectedCode]
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function styleFunction(context: any) {
    const code = (context.countryCode ?? '').toLowerCase()
    const value = context.countryValue

    if (value === 5) {
      // Selected territory — bright gold fill
      return { fill: '#c9a84c', stroke: '#7a5c1e', strokeWidth: 2.5, cursor: 'pointer', fillOpacity: 1 }
    }
    if (value === 2) {
      // Bot territory — cluster color, not clickable
      return { fill: botColorMap[code] ?? '#3a2a2a', stroke: '#111', strokeWidth: 0.7, cursor: 'default', fillOpacity: 1 }
    }
    // Claimable (value=3) — gold-tinted cream
    return { fill: '#f0e8d0', stroke: '#b89758', strokeWidth: 1, cursor: 'pointer', fillOpacity: 1 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(context: any) {
    const code = (context.countryCode ?? '').toLowerCase()
    if (!code) return
    if (botOwnerMap[code]) return // enemy territory, ignore click
    const name = ALPHA2_TO_NAME[code]
    if (!name) return
    onSelect(code, name)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tooltipText(context: any) {
    const code = (context.countryCode ?? '').toLowerCase()
    const name = ALPHA2_TO_NAME[code] ?? context.countryName ?? ''
    if (botOwnerMap[code]) return `${name} — Enemy territory`
    return `${name} — Tap to claim`
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <WorldMap
        color="#b89758"
        backgroundColor="#1a2e45"
        size="responsive"
        data={mapData as any}
        styleFunction={styleFunction}
        onClickFunction={handleClick}
        tooltipTextFunction={tooltipText}
      />
    </div>
  )
}
