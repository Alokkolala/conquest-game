'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  minScale?: number
  maxScale?: number
}

export default function MapPanZoom({ children, minScale = 1, maxScale = 5 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const transformRef = useRef(transform)
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null)
  const touchRef = useRef<{ dist: number; tx: number; ty: number; scale: number } | null>(null)

  // Keep transformRef in sync so imperative handlers can read current transform
  useEffect(() => { transformRef.current = transform }, [transform])

  function clamp(x: number, y: number, scale: number): { x: number; y: number } {
    const container = containerRef.current
    if (!container) return { x, y }
    const W = container.clientWidth
    const H = container.clientHeight
    return {
      x: Math.min(0, Math.max(W * (1 - scale), x)),
      y: Math.min(0, Math.max(H * (1 - scale), y)),
    }
  }

  // Pointer drag handlers (React synthetic — no preventDefault needed)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary) return
    const { x, y } = transformRef.current
    dragRef.current = { startX: e.clientX, startY: e.clientY, tx: x, ty: y }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !e.isPrimary) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const rawX = dragRef.current.tx + dx
    const rawY = dragRef.current.ty + dy
    setTransform(prev => {
      const { x, y } = clamp(rawX, rawY, prev.scale)
      return { ...prev, x, y }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  // Wheel and touch: attach imperatively with { passive: false } so preventDefault works
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = container!.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setTransform(prev => {
        const factor = e.deltaY > 0 ? 0.85 : 1.18
        const newScale = Math.min(maxScale, Math.max(minScale, prev.scale * factor))
        const newX = px - (px - prev.x) * (newScale / prev.scale)
        const newY = py - (py - prev.y) * (newScale / prev.scale)
        const { x, y } = clamp(newX, newY, newScale)
        return { x, y, scale: newScale }
      })
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t0 = e.touches[0], t1 = e.touches[1]
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const { x, y, scale } = transformRef.current
        touchRef.current = { dist, tx: x, ty: y, scale }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && touchRef.current) {
        e.preventDefault()
        const t0 = e.touches[0], t1 = e.touches[1]
        const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const rect = container!.getBoundingClientRect()
        const px = (t0.clientX + t1.clientX) / 2 - rect.left
        const py = (t0.clientY + t1.clientY) / 2 - rect.top
        const scaleFactor = newDist / touchRef.current.dist
        const newScale = Math.min(maxScale, Math.max(minScale, touchRef.current.scale * scaleFactor))
        const newX = px - (px - touchRef.current.tx) * (newScale / touchRef.current.scale)
        const newY = py - (py - touchRef.current.ty) * (newScale / touchRef.current.scale)
        const { x, y } = clamp(newX, newY, newScale)
        setTransform({ x, y, scale: newScale })
      }
    }

    function onTouchEnd() { touchRef.current = null }

    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)

    return () => {
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScale, maxScale])

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: '100%', height: '100%',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        transformOrigin: '0 0',
        width: '100%', height: '100%',
        willChange: 'transform',
      }}>
        {children}
      </div>
    </div>
  )
}
