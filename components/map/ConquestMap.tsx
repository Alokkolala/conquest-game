'use client'

import { useMemo, useRef, useEffect } from 'react'
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
  player:     '#1a1410',
  bot:        '#3a2a2a',
  claimable:  '#b89758',
  attackable: '#c8311c',
  neutral:    '#d8d3c6',
}

export default function ConquestMap({
  playerCodes,
  botOwnerMap,
  currentUsername,
  isNewUser,
  size = 'responsive' as 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'responsive',
  onCountryClick,
}: Props) {
  const botColorMap = useMemo(() => buildBotColorMap(), [])
  const wrapperRef = useRef<HTMLDivElement>(null)

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

    if (!state) {
      // Unlisted country — neutral ocean-adjacent styling
      return { fill: '#cfc9bc', stroke: '#bfb9ac', strokeWidth: 0.4, cursor: 'default', fillOpacity: 1 }
    }

    switch (state.status) {
      case 'player':
        return {
          fill: '#1a1410',
          stroke: '#444',
          strokeWidth: 1.2,
          cursor: 'pointer',
          fillOpacity: 1,
        }
      case 'bot':
        return {
          fill: botColorMap[code] ?? STATUS_COLORS.bot,
          stroke: '#111',
          strokeWidth: 0.7,
          cursor: 'default',
          fillOpacity: 1,
        }
      case 'claimable':
        return {
          fill: '#f0e8d0',
          stroke: '#b89758',
          strokeWidth: 1.8,
          cursor: 'pointer',
          fillOpacity: 1,
        }
      case 'attackable':
        return {
          fill: '#2e1010',
          stroke: '#c8311c',
          strokeWidth: 1.8,
          cursor: 'pointer',
          fillOpacity: 1,
        }
      case 'neutral':
      default:
        return {
          fill: '#d8d3c6',
          stroke: '#c4bfb2',
          strokeWidth: 0.4,
          cursor: 'default',
          fillOpacity: 1,
        }
    }
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

  // Inject CSS animation onto claimable/attackable SVG paths after each render
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const timer = setTimeout(() => {
      const paths = wrapper.querySelectorAll<SVGPathElement>('svg path')

      let styleTag = document.getElementById('cq-country-anim') as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = 'cq-country-anim'
        document.head.appendChild(styleTag)
      }

      const claimSelectors: string[] = []
      const attackSelectors: string[] = []

      paths.forEach((path, i) => {
        path.classList.remove('cq-claimable-path', 'cq-attackable-path')
        const fill = path.style.fill
        if (fill === '#f0e8d0') {
          path.classList.add(`cq-anim-${i}`)
          claimSelectors.push(`.cq-anim-${i}`)
        } else if (fill === '#2e1010') {
          path.classList.add(`cq-anim-${i}`)
          attackSelectors.push(`.cq-anim-${i}`)
        }
      })

      styleTag.textContent = [
        claimSelectors.length > 0
          ? `${claimSelectors.join(',')} { animation: cq-claimable-pulse 2.4s ease-in-out infinite; }`
          : '',
        attackSelectors.length > 0
          ? `${attackSelectors.join(',')} { animation: cq-attackable-pulse 1.7s ease-in-out infinite; }`
          : '',
      ].filter(Boolean).join('\n')
    }, 120)

    return () => {
      clearTimeout(timer)
      const styleTag = document.getElementById('cq-country-anim')
      if (styleTag) styleTag.textContent = ''
    }
  }, [gameState])

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', background: '#1a2e45', overflow: 'hidden' }}>
      <WorldMap
        color="#b89758"
        backgroundColor="#1a2e45"
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
