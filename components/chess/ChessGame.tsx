'use client'

import { useEffect, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useRouter } from 'next/navigation'

interface Props {
  challengeId: string
  territoryName: string
  mode: 'vs-bot' | 'vs-human'
  playerColor: 'w' | 'b'
  initialFen?: string
  onGameEnd?: (winner: 'challenger' | 'defender') => void
}

export default function ChessGame({
  challengeId,
  territoryName,
  mode,
  playerColor,
  initialFen,
  onGameEnd,
}: Props) {
  const router = useRouter()
  const [game, setGame] = useState(() => {
    const g = new Chess()
    if (initialFen) g.load(initialFen)
    return g
  })
  const [fen, setFen] = useState(game.fen())
  const [status, setStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [resolving, setResolving] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const gameRef = useRef(game)
  gameRef.current = game
  const statusRef = useRef(status)
  statusRef.current = status

  // Init Stockfish worker (bot mode only)
  useEffect(() => {
    if (mode !== 'vs-bot') return
    const w = new Worker('/stockfish-worker.js')
    workerRef.current = w
    w.onmessage = (e: MessageEvent) => {
      const line = e.data
      if (typeof line !== 'string') return
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ')
        const move = parts[1]
        if (!move || move === '(none)') return
        const from = move.slice(0, 2)
        const to = move.slice(2, 4)
        const promo = move.slice(4) || undefined
        makeMove({ from, to, promotion: promo as 'q' | undefined }, false)
      }
    }
    w.postMessage('uci')
    w.postMessage('isready')
    return () => w.terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function sendToStockfish(currentFen: string) {
    const w = workerRef.current
    if (!w) return
    w.postMessage('position fen ' + currentFen)
    w.postMessage('go depth 10')
  }

  function makeMove(
    move: { from: string; to: string; promotion?: 'q' },
    isByPlayer: boolean
  ): boolean {
    const g = new Chess(gameRef.current.fen())
    try {
      g.move(move)
    } catch {
      return false
    }
    gameRef.current = g
    setGame(g)
    setFen(g.fen())
    setLastMove({ from: move.from, to: move.to })

    if (g.isGameOver()) {
      handleGameOver(g, isByPlayer)
      return true
    }

    if (mode === 'vs-bot' && g.turn() !== playerColor) {
      sendToStockfish(g.fen())
    }

    return true
  }

  function handleGameOver(g: Chess, playerMadeLastMove: boolean) {
    let result: 'won' | 'lost' | 'draw' = 'draw'
    if (g.isCheckmate()) {
      result = playerMadeLastMove ? 'won' : 'lost'
    }
    setStatus(result)
    statusRef.current = result
  }

  async function resolveChallenge(result: 'won' | 'lost' | 'draw') {
    setResolving(true)
    const winner = result === 'won' ? 'challenger' : 'defender'
    try {
      await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, winner }),
      })
    } catch {
      // proceed even if resolve fails
    }
    setResolving(false)
    onGameEnd?.(winner)
    router.push('/')
  }

  function onPieceDrop({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (statusRef.current !== 'playing') return false
    if (gameRef.current.turn() !== playerColor) return false
    if (!targetSquare) return false
    const promo =
      piece.pieceType[1]?.toLowerCase() === 'p' &&
      (targetSquare[1] === '8' || targetSquare[1] === '1')
        ? 'q'
        : undefined
    return makeMove(
      { from: sourceSquare, to: targetSquare, promotion: promo as 'q' | undefined },
      true
    )
  }

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { background: 'rgba(184,151,88,0.35)' }
    squareStyles[lastMove.to] = { background: 'rgba(184,151,88,0.55)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', gap: 16 }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: 4,
        }}>
          {mode === 'vs-bot' ? 'vs Stockfish' : 'vs Challenger'}
        </div>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: 28,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'var(--ink)',
        }}>
          {territoryName}
        </div>
      </div>

      {/* Board */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop,
            boardOrientation: playerColor === 'w' ? 'white' : 'black',
            squareStyles,
            darkSquareStyle: { backgroundColor: '#b5a07a' },
            lightSquareStyle: { backgroundColor: '#f4f1ea' },
            allowDragging: status === 'playing' && game.turn() === playerColor,
          }}
        />
      </div>

      {/* Status */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        {status === 'playing' && (
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}>
            {game.turn() === playerColor ? 'Your move' : 'Opponent thinking\u2026'}
          </div>
        )}

        {status !== 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              padding: '16px',
              borderRadius: 14,
              background: status === 'won' ? 'var(--ink)' : status === 'lost' ? '#fff0ee' : 'var(--bg-warm)',
              border: status === 'lost' ? '0.5px solid var(--red)' : 'none',
            }}>
              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 26,
                fontStyle: 'italic',
                color: status === 'won' ? '#f4f1ea' : status === 'lost' ? 'var(--red)' : 'var(--ink)',
              }}>
                {status === 'won' ? '\u2694 Victory' : status === 'lost' ? 'Defeat' : 'Draw'}
              </div>
              <div style={{
                fontFamily: 'var(--sans)',
                fontSize: 13,
                color: status === 'won' ? 'rgba(244,241,234,0.7)' : 'var(--muted)',
                marginTop: 4,
              }}>
                {status === 'won'
                  ? `${territoryName} is now yours.`
                  : status === 'lost'
                  ? 'The territory holds.'
                  : 'No territory changes.'}
              </div>
            </div>
            <button
              onClick={() => resolveChallenge(status)}
              disabled={resolving}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 14,
                background: 'var(--ink)',
                color: '#f4f1ea',
                border: 'none',
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: resolving ? 'not-allowed' : 'pointer',
                opacity: resolving ? 0.6 : 1,
              }}
            >
              {resolving ? 'Saving\u2026' : 'Return to Map'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
