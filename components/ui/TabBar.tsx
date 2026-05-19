'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = 'map' | 'challenge' | 'dynasty'

const MapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 6L9 4L15 6L21 4L21 18L15 20L9 18L3 20Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M9 4V18M15 6V20" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
)
const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M9 8L16 12L9 16Z" fill="currentColor"/>
  </svg>
)
const CrownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 8L7 14L12 7L17 14L20 8L19 19L5 19Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)

const TABS = [
  { id: 'map'       as Tab, label: 'Kingdom',   Icon: MapIcon,   href: '/'         },
  { id: 'challenge' as Tab, label: 'Challenge',  Icon: PlayIcon,  href: '/challenge'},
  { id: 'dynasty'   as Tab, label: 'Dynasty',    Icon: CrownIcon, href: '/dynasty'  },
]

export default function TabBar({ active }: { active?: Tab }) {
  const pathname = usePathname()
  const current: Tab = active ?? (
    pathname === '/'          ? 'map'       :
    pathname === '/challenge' ? 'challenge' : 'dynasty'
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 390,
      paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      paddingTop: 6,
      borderTop: '0.5px solid var(--line)',
      background: 'rgba(244,241,234,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      zIndex: 40,
    }}>
      {TABS.map(({ id, label, Icon, href }) => {
        const on = current === id
        return (
          <Link key={id} href={href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, flex: 1, paddingTop: 8, paddingBottom: 4,
            color: on ? 'var(--ink)' : 'var(--muted)', textDecoration: 'none',
          }}>
            <div style={{ height: 22, display: 'flex', alignItems: 'center' }}>
              <Icon />
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
            }}>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
