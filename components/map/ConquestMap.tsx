'use client'

import { useMemo } from 'react'
import WorldMap from 'react-svg-worldmap'
import { buildGameState, buildMapData, buildBotColorMap } from '@/lib/game-state'
import { ALPHA2_TO_NAME } from '@/lib/country-codes'
import type { CountryFeature } from '@/lib/types'

interface Props {
  playerCodes: string[]
  botOwnerMap: Record<string, string>
  currentUsername: string
  isNewUser: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'responsive'
  onCountryClick?: (feature: CountryFeature) => void
}

const STATUS_COLORS = {
  player:     '#111111',
  bot:        '#3a2a2a',
  claimable:  '#b89758',
  attackable: '#8b2020',
  neutral:    '#ece8df',
}

export default function ConquestMap({
  playerCodes,
  botOwnerMap,
  currentUsername,
  isNewUser,
  size = 'xxl',
  onCountryClick,
}: Props) {
  const botColorMap = useMemo(() => buildBotColorMap(), [])

  const gameState = useMemo(
    () => buildGameState(playerCodes, botOwnerMap, isNewUser),
    [playerCodes, botOwnerMap, isNewUser]
  )

  const stateByCode = useMemo(() => {
    const map: Record<string, typeof gameState[number]> = {}
    for (const s of gameState) map[s.code] = s
    return map
  }, [gameState])

  const mapData = useMemo(() => buildMapData(gameState), [gameState])

  function styleFunction(context: {
    countryCode: string
    countryValue?: number
    minValue: number
    maxValue: number
    color: string
  }) {
    const code = context.countryCode.toLowerCase()
    const state = stateByCode[code]

    let fill = STATUS_COLORS.neutral
    let stroke = '#d0c8bc'
    let strokeWidth = 0.5
    let cursor = 'default'

    if (state) {
      switch (state.status) {
        case 'player':
          fill = STATUS_COLORS.player
          stroke = '#333'
          strokeWidth = 1
          break
        case 'bot':
          fill = botColorMap[code] ?? STATUS_COLORS.bot
          stroke = '#222'
          strokeWidth = 0.8
          break
        case 'claimable':
          fill = '#f4f0e6'
          stroke = STATUS_COLORS.claimable
          strokeWidth = 1.5
          cursor = 'pointer'
          break
        case 'attackable':
          fill = '#3a1a1a'
          stroke = STATUS_COLORS.attackable
          strokeWidth = 1.5
          cursor = 'pointer'
          break
        case 'neutral':
        default:
          fill = STATUS_COLORS.neutral
          stroke = '#d0c8bc'
          strokeWidth = 0.5
      }
    }

    return { fill, stroke, strokeWidth, cursor, fillOpacity: 1 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(context: any) {
    if (!onCountryClick) return
    const code = context.countryCode?.toLowerCase()
    if (!code) return
    const state = stateByCode[code]
    if (!state || (state.status !== 'claimable' && state.status !== 'attackable' && state.status !== 'player')) {
      return
    }
    const feature: CountryFeature = {
      id: code,
      name: ALPHA2_TO_NAME[code] ?? context.countryName ?? code,
      path: '' as string,
      center: [0, 0],
      status: state.status === 'player' ? 'owned'
            : state.status === 'attackable' ? 'enemy'
            : 'neutral',
      owner: state.ownerUsername,
      value: 1,
    }
    onCountryClick(feature)
  }

  return (
    <div style={{ width: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <WorldMap
        color="#b89758"
        backgroundColor="var(--bg)"
        size={size}
        data={mapData as any}
        styleFunction={styleFunction}
        onClickFunction={handleClick}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tooltipTextFunction={(context: any) => {
          const code = context.countryCode?.toLowerCase()
          if (!code) return context.countryName ?? ''
          const state = stateByCode[code]
          if (!state) return context.countryName ?? ''
          const statusLabel: Record<string, string> = {
            player: 'Yours',
            bot: `${state.ownerUsername ?? 'Enemy'} territory`,
            claimable: 'Click to claim',
            attackable: `Attack ${state.ownerUsername ?? 'enemy'}`,
            neutral: context.countryName ?? '',
          }
          return `${ALPHA2_TO_NAME[code] ?? context.countryName} — ${statusLabel[state.status]}`
        }}
      />
    </div>
  )
}
