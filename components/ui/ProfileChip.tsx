export default function ProfileChip({
  name, initial, elo, dark = false,
}: { name: string; initial: string; elo?: number; dark?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: dark ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 999, padding: '5px 12px 5px 5px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      border: `0.5px solid ${dark ? 'rgba(255,255,255,0.1)' : 'var(--line)'}`,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 999, background: 'var(--ink)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic',
      }}>{initial}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em', color: dark ? '#fff' : 'var(--ink)' }}>
          {name}
        </span>
        {elo !== undefined && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: dark ? 'rgba(255,255,255,0.6)' : 'var(--muted)', marginTop: 2,
          }}>ELO {elo}</span>
        )}
      </div>
    </div>
  )
}
