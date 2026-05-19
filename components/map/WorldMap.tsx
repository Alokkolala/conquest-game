'use client'

import { useMemo, useState, useRef } from 'react'
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

  // Pan/zoom state
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null)
  const didDragRef = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Convert screen coords to SVG coords
  function toSVG(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const scaleX = (VB_W / view.scale) / rect.width
    const scaleY = (VB_H / view.scale) / rect.height
    return {
      x: view.x + (clientX - rect.left) * scaleX,
      y: view.y + (clientY - rect.top) * scaleY,
    }
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.isPrimary) {
      didDragRef.current = false
      dragRef.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !e.isPrimary) return
    const dx = (e.clientX - dragRef.current.startX) * (VB_W / view.scale) / (svgRef.current?.getBoundingClientRect().width ?? 390)
    const dy = (e.clientY - dragRef.current.startY) * (VB_H / view.scale) / (svgRef.current?.getBoundingClientRect().height ?? 250)
    if (Math.abs(dx) + Math.abs(dy) > 3) didDragRef.current = true
    setView(v => ({
      ...v,
      x: Math.max(0, Math.min(VB_W - VB_W / v.scale, dragRef.current!.viewX - dx)),
      y: Math.max(0, Math.min(VB_H - VB_H / v.scale, dragRef.current!.viewY - dy)),
    }))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.85 : 1.18
    const svgPt = toSVG(e.clientX, e.clientY)
    setView(v => {
      const newScale = Math.max(1, Math.min(8, v.scale * delta))
      const newW = VB_W / newScale
      const newH = VB_H / newScale
      const newX = svgPt.x - (svgPt.x - v.x) * (newW / (VB_W / v.scale))
      const newY = svgPt.y - (svgPt.y - v.y) * (newH / (VB_H / v.scale))
      return {
        scale: newScale,
        x: Math.max(0, Math.min(VB_W - newW, newX)),
        y: Math.max(0, Math.min(VB_H - newH, newY)),
      }
    })
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="World territory map"
      width={width}
      height={height}
      viewBox={`${view.x} ${view.y} ${VB_W / view.scale} ${VB_H / view.scale}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ display: 'block', background: 'var(--bg)', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
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
              onClick={() => { if (!didDragRef.current) onCountryClick?.(f) }}
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
