export function SheetHandle() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
      <div style={{ width: 36, height: 4, borderRadius: 4, background: 'var(--line)' }} />
    </div>
  )
}

export default function BottomDrawer({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: 'rgba(244,241,234,0.97)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderTop: '0.5px solid var(--line)',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}
