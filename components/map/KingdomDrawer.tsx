'use client'

import { useState, useRef } from 'react'
import BottomDrawer, { SheetHandle } from '@/components/ui/BottomDrawer'

interface HoldingItem {
  name: string
  status: 'owned' | 'contested'
  held: number
  value: number
}

interface Props {
  houseName: string
  displayOwned: number
  totalTerritories: number
  displayValue: number
  holdings: HoldingItem[]
}

export default function KingdomDrawer({ houseName, displayOwned, totalTerritories, displayValue, holdings }: Props) {
  const [expanded, setExpanded] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartExpanded = useRef(false)

  function onHandlePointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY
    dragStartExpanded.current = expanded
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (dragStartY.current === null) return
    const dy = e.clientY - dragStartY.current
    if (Math.abs(dy) > 20) {
      setExpanded(dy < 0) // drag up = expand, drag down = collapse
    }
  }

  function onHandlePointerUp() {
    dragStartY.current = null
  }

  // Collapsed: show just header + 3 stats (~190px content)
  // Expanded: show full list (up to ~70vh)
  const drawerMaxH = expanded ? '70vh' : '220px'

  return (
    <div style={{
      position: 'absolute', bottom: 76, left: 0, right: 0, zIndex: 35,
      transition: 'none', // height transition handled on inner content
    }}>
      <BottomDrawer>
        {/* Draggable handle */}
        <div
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onClick={() => setExpanded(e => !e)}
          style={{ cursor: 'ns-resize', userSelect: 'none' }}
        >
          <SheetHandle />
        </div>

        {/* Scrollable content */}
        <div style={{
          maxHeight: drawerMaxH,
          overflowY: expanded ? 'auto' : 'hidden',
          transition: 'max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }} className="cq-scroll">

          {/* Kingdom header */}
          <div style={{ padding: '6px 22px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Your Kingdom</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em', fontStyle: 'italic' }}>{houseName}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>#412 · WORLD</span>
            </div>
          </div>

          {/* Three stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '14px 22px 16px',
            borderTop: '0.5px solid var(--line-soft)',
            borderBottom: '0.5px solid var(--line-soft)',
          }}>
            {[
              { label: 'Holdings',    value: String(displayOwned), suffix: `/ ${totalTerritories}` },
              { label: 'Crown Value', value: String(displayValue), suffix: 'pts' },
              { label: 'Streak',      value: '—', suffix: '', color: 'var(--muted)' },
            ].map((s, i) => (
              <div key={s.label} style={{
                borderRight: i < 2 ? '0.5px solid var(--line-soft)' : 'none',
                paddingLeft: i > 0 ? 14 : 0,
                paddingRight: i < 2 ? 12 : 0,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1, marginTop: 4, color: s.color ?? 'var(--ink)' }}>
                  {s.value}
                  {s.suffix && <span style={{ fontFamily: 'var(--mono)', fontSize: s.suffix.length > 3 ? 10 : 13, color: 'var(--muted)', marginLeft: 4 }}>{s.suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Territory list */}
          <div style={{ padding: '14px 22px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>Holdings · Today</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em' }}>SEE ALL</span>
            </div>
            {holdings.map((t, i) => (
              <div key={t.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--line-soft)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                  background: t.status === 'contested' ? 'var(--red)' : 'var(--ink)',
                  boxShadow: t.status === 'contested' ? '0 0 0 3px rgba(200,49,28,0.15)' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.1, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginTop: 3 }}>
                    {t.status === 'contested' ? 'UNDER SIEGE' : `HELD ${t.held ?? 0}D`}
                  </div>
                </div>
                {t.status === 'contested' ? (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--red)', padding: '4px 10px', border: '1px solid var(--red)', borderRadius: 999 }}>DEFEND</span>
                ) : (
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>+{Math.round(t.value * 10) / 10}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </BottomDrawer>
    </div>
  )
}
