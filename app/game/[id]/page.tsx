import { createServerClient_ } from '@/lib/supabase-server'
import ChessGame from '@/components/chess/ChessGame'
import { redirect } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'

interface Props {
  params: Promise<{ id: string }>
}

export default async function GamePage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient_()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: challenge } = await supabase
    .from('challenges')
    .select('*, territory:territories(name), challenger:profiles!challenger_id(id, username), defender:profiles!defender_id(id, username)')
    .eq('id', id)
    .single()

  if (!challenge) redirect('/')

  const playerColor: 'w' | 'b' = challenge.challenger_id === user.id ? 'w' : 'b'
  const BOT_NAMES = new Set(['crimsonguard', 'azurecrown', 'verdanthold', 'obsidianpact'])
  const defenderUsername = (challenge.defender as { id: string; username: string } | null)?.username ?? ''
  const isSelfChallenge = challenge.challenger_id === challenge.defender_id
  const defenderIsBot = BOT_NAMES.has(defenderUsername.toLowerCase())
  const isVsBot = isSelfChallenge || defenderIsBot
  const mode: 'vs-bot' | 'vs-human' = isVsBot ? 'vs-bot' : 'vs-human'
  // Neutral claim = easy (depth 5), bot attack = harder (depth 12)
  const stockfishDepth = isSelfChallenge ? 5 : defenderIsBot ? 12 : undefined
  const territoryName = (challenge.territory as { name: string } | null)?.name ?? 'Unknown'

  return (
    <main
      style={{
        width: '100%',
        maxWidth: 390,
        margin: '0 auto',
        minHeight: '100dvh',
        background: 'var(--bg)',
        paddingBottom: 100,
        overflowY: 'auto',
      }}
      className="cq-scroll"
    >
      {/* Back button */}
      <div style={{ padding: '52px 16px 0' }}>
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            textDecoration: 'none',
          }}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <path
              d="M11 6H3M3 6L7 2M3 6L7 10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Map
        </a>
      </div>

      <ChessGame
        challengeId={id}
        territoryName={territoryName}
        mode={mode}
        playerColor={playerColor}
        stockfishDepth={stockfishDepth}
        scenario={isSelfChallenge ? 'claim' : defenderIsBot ? 'attack' : undefined}
        initialFen={challenge.current_fen ?? undefined}
      />

      <TabBar active="challenge" />
    </main>
  )
}
