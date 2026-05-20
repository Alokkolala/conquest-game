'use client'

import { useMemo, useState, useRef } from 'react'
import CountryShape from './CountryShape'
import { buildCountryFeatures, VB_W, VB_H } from '@/lib/world-territories'
import type { CountryFeature } from '@/lib/types'

// Eurasia SVG bounds (equirectangular 1000×500)
const EUR_X = 410   // longitude -30°
const EUR_Y = 22    // latitude  80°N
const EUR_W = 590   // span to 180°E
const EUR_H = 255   // down to -10°S

interface Props {
  width?: number
  height?: number
  ownerMap?: Record<string, string>
  currentUsername?: string
  highlightId?: string | null
  flipState?: 'win' | 'lose' | null
  onCountryClick?: (feature: CountryFeature) => void
}

export default function EurasiaMap({
  width = 390,
  height = 340,
  ownerMap = {},
  currentUsername = '',
  highlightId = null,
  flipState = null,
  onCountryClick,
}: Props) {
  // Build feature list
  const features = useMemo(
    () => buildCountryFeatures(ownerMap, currentUsername),
    [ownerMap, currentUsername]
  )

  // Filter to Eurasia by centroid position
  const eurasiaFeatures = useMemo(() =>
    features.filter(f => {
      const [cx, cy] = f.center ?? [0, 0]
      return cx >= 380 && cx <= 1010 && cy >= 15 && cy <= 290
    }),
    [features]
  )

  // Pan/zoom — initial view shows Eurasia
  const [view, setView] = useState({ x: EUR_X, y: EUR_Y, w: EUR_W, h: EUR_H })
  const dragRef    = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  const didDragRef = useRef(false)
  const svgRef     = useRef<SVGSVGElement>(null)

  function svgPoint(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: view.x + (clientX - rect.left)  / rect.width  * view.w,
      y: view.y + (clientY - rect.top)   / rect.height * view.h,
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!e.isPrimary) return
    didDragRef.current = false
    dragRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
    ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !e.isPrimary) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = (e.clientX - dragRef.current.sx) / rect.width  * view.w
    const dy = (e.clientY - dragRef.current.sy) / rect.height * view.h
    if (Math.abs(dx) + Math.abs(dy) > 2) didDragRef.current = true
    setView(v => ({
      ...v,
      x: Math.max(0, Math.min(VB_W - v.w, dragRef.current!.vx - dx)),
      y: Math.max(0, Math.min(VB_H - v.h, dragRef.current!.vy - dy)),
    }))
  }

  function onPointerUp() { dragRef.current = null }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.15 : 0.87
    const pivot  = svgPoint(e.clientX, e.clientY)
    setView(v => {
      const newW = Math.max(100, Math.min(VB_W, v.w * factor))
      const newH = Math.max(50,  Math.min(VB_H, v.h * factor))
      const ratio = newW / v.w
      return {
        w: newW, h: newH,
        x: Math.max(0, Math.min(VB_W - newW, pivot.x - (pivot.x - v.x) * ratio)),
        y: Math.max(0, Math.min(VB_H - newH, pivot.y - (pivot.y - v.y) * ratio)),
      }
    })
  }

  // Suppress unused variable warning — flipState reserved for future flip animations
  void flipState

  const viewBox = `${view.x} ${view.y} ${view.w} ${view.h}`

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Eurasia territory map"
      width={width}
      height={height}
      viewBox={viewBox}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{
        display: 'block',
        background: 'var(--bg)',
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <title>Eurasia territory map</title>

      {/* Grid lines — only in Eurasian view range */}
      <g stroke="var(--line)" strokeWidth="0.3" opacity="0.4">
        {[0, 30, 60].map(lat => {
          const y = (90 - lat) / 180 * VB_H
          return <line key={lat} x1={EUR_X} x2={VB_W} y1={y} y2={y} />
        })}
        {[0, 30, 60, 90, 120, 150, 180].map(lng => {
          const x = (lng + 180) / 360 * VB_W
          return <line key={lng} x1={x} x2={x} y1={EUR_Y} y2={EUR_Y + EUR_H} />
        })}
      </g>

      {/* Ocean labels */}
      <text x={430} y={200} fontFamily="var(--mono)" fontSize="14" fill="var(--line)" opacity="0.5" fontStyle="italic" letterSpacing="0.2em">
        INDIAN OCEAN
      </text>
      <text x={910} y={85} fontFamily="var(--mono)" fontSize="11" fill="var(--line)" opacity="0.4" fontStyle="italic" letterSpacing="0.15em">
        PACIFIC
      </text>

      {/* Render each Eurasian country as its own React component */}
      {eurasiaFeatures.map(f => (
        <CountryShape
          key={f.id}
          feature={f}
          isHighlighted={f.id === highlightId}
          isDragging={didDragRef.current}
          onCountryClick={onCountryClick}
        />
      ))}
    </svg>
  )
}
