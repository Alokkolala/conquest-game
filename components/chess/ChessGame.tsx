'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from 'react-chessboard'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { useRouter } from 'next/navigation'
import { getGameSettings } from '@/lib/game-settings'

interface Props {
  challengeId: string
  territoryName: string
  mode: 'vs-bot' | 'vs-human'
  playerColor: 'w' | 'b'
  stockfishDepth?: number
  scenario?: 'claim' | 'attack'
  initialFen?: string
  onGameEnd?: (winner: 'challenger' | 'defender') => void
}

// Find the king square for a given color
function findKingSquare(g: Chess, color: 'w' | 'b'): string | null {
  const board = g.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f]
      if (piece?.type === 'k' && piece.color === color) {
        return `${String.fromCharCode(97 + f)}${8 - r}`
      }
    }
  }
  return null
}

export default function ChessGame({
  challengeId,
  territoryName,
  mode,
  playerColor,
  stockfishDepth = 10,
  scenario,
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

  // Interaction state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalSquares, setLegalSquares] = useState<Record<string, React.CSSProperties>>({})

  // Hint state
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null)
  const [requestingHint, setRequestingHint] = useState(false)

  const workerRef     = useRef<Worker | null>(null)  // bot moves
  const hintWorkerRef = useRef<Worker | null>(null)  // hints (lazy-loaded)
  const gameRef  = useRef(game)
  gameRef.current = game
  const statusRef = useRef(status)
  statusRef.current = status

  // Bot Stockfish worker
  useEffect(() => {
    if (mode !== 'vs-bot') return
    const w = new Worker('/stockfish/stockfish-18-lite-single.js')
    workerRef.current = w
    w.onmessage = (e: MessageEvent) => {
      const line = e.data as string
      if (typeof line !== 'string') return
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1]
        if (!move || move === '(none)') return
        makeMove({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: (move.slice(4) || undefined) as 'q' | undefined }, false)
      }
    }
    w.postMessage('uci')
    w.postMessage('isready')
    return () => w.terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Hint worker cleanup on unmount
  useEffect(() => () => { hintWorkerRef.current?.terminate() }, [])

  function sendToStockfish(currentFen: string) {
    const w = workerRef.current
    if (!w) return
    const settings = getGameSettings()
    const depth = scenario === 'claim'  ? settings.claimDepth
                : scenario === 'attack' ? settings.attackDepth
                : stockfishDepth
    w.postMessage('position fen ' + currentFen)
    w.postMessage('go depth ' + depth)
  }

  function computeLegalSquares(square: string): Record<string, React.CSSProperties> {
    const moves = gameRef.current.moves({ square: square as Square, verbose: true })
    const result: Record<string, React.CSSProperties> = {}
    moves.forEach(m => {
      const isCapture = !!gameRef.current.get(m.to as Square)
      result[m.to] = isCapture
        ? { background: 'radial-gradient(circle, transparent 56%, rgba(0,0,0,0.2) 56%)', borderRadius: '50%' }
        : { background: 'radial-gradient(circle, rgba(0,0,0,0.15) 30%, transparent 30%)', borderRadius: '50%' }
    })
    return result
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
    setSelectedSquare(null)
    setLegalSquares({})
    if (isByPlayer) setHint(null)

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
    if (g.isCheckmate()) result = playerMadeLastMove ? 'won' : 'lost'
    setStatus(result)
    statusRef.current = result
  }

  async function resolveChallenge(result: 'won' | 'lost' | 'draw') {
    setResolving(true)
    const winner: 'challenger' | 'defender' =
      result === 'won'
        ? (playerColor === 'w' ? 'challenger' : 'defender')
        : (playerColor === 'w' ? 'defender' : 'challenger')
    try {
      await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, winner }),
      })
    } catch { /* proceed even if resolve fails */ }
    setResolving(false)
    onGameEnd?.(winner)
    router.push('/')
  }

  // Drag start — show legal moves
  function onPieceDrag({ square }: PieceHandlerArgs) {
    if (statusRef.current !== 'playing') return
    if (gameRef.current.turn() !== playerColor) return
    if (!square) return
    setSelectedSquare(square)
    setLegalSquares(computeLegalSquares(square))
  }

  // Click-to-move
  const onSquareClick = useCallback(({ square }: SquareHandlerArgs) => {
    if (statusRef.current !== 'playing') return
    if (gameRef.current.turn() !== playerColor) return

    // If a square is already selected, try to move there
    if (selectedSquare) {
      const moved = makeMove({ from: selectedSquare, to: square, promotion: 'q' }, true)
      if (!moved) {
        // Re-select if it's another own piece
        const piece = gameRef.current.get(square as Square)
        if (piece && piece.color === playerColor) {
          setSelectedSquare(square)
          setLegalSquares(computeLegalSquares(square))
        } else {
          setSelectedSquare(null)
          setLegalSquares({})
        }
      }
      return
    }

    // First click — select own piece
    const piece = gameRef.current.get(square as Square)
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square)
      setLegalSquares(computeLegalSquares(square))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSquare, playerColor])

  function onPieceDrop({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (statusRef.current !== 'playing') return false
    if (gameRef.current.turn() !== playerColor) return false
    if (!targetSquare) { setSelectedSquare(null); setLegalSquares({}); return false }
    const isPromo =
      piece.pieceType[1]?.toLowerCase() === 'p' &&
      (targetSquare[1] === '8' || targetSquare[1] === '1')
    return makeMove({ from: sourceSquare, to: targetSquare, promotion: isPromo ? 'q' : undefined }, true)
  }

  // Hint via lazy-loaded second Stockfish worker
  function requestHint() {
    if (requestingHint) return
    setRequestingHint(true)
    setHint(null)

    let hw = hintWorkerRef.current
    if (!hw) {
      hw = new Worker('/stockfish/stockfish-18-lite-single.js')
      hw.postMessage('uci')
      hw.postMessage('isready')
      hintWorkerRef.current = hw
      hw.onmessage = (e: MessageEvent) => {
        const line = e.data as string
        if (typeof line !== 'string') return
        if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1]
          setRequestingHint(false)
          if (!move || move === '(none)') return
          setHint({ from: move.slice(0, 2), to: move.slice(2, 4) })
        }
      }
    }
    hw.postMessage('position fen ' + gameRef.current.fen())
    hw.postMessage('go depth 12')
  }

  // ── Square styles ────────────────────────────────────
  const squareStyles: Record<string, React.CSSProperties> = {}

  // Last move (gold)
  if (lastMove) {
    squareStyles[lastMove.from] = { background: 'rgba(184,151,88,0.35)' }
    squareStyles[lastMove.to]   = { background: 'rgba(184,151,88,0.55)' }
  }

  // Selected square
  if (selectedSquare) {
    squareStyles[selectedSquare] = { background: 'rgba(184,151,88,0.7)' }
  }

  // Legal move dots (layered over existing styles)
  Object.entries(legalSquares).forEach(([sq, style]) => {
    squareStyles[sq] = { ...squareStyles[sq], ...style }
  })

  // Check — highlight king in red
  if (status === 'playing' && game.isCheck()) {
    const kingSq = findKingSquare(game, game.turn())
    if (kingSq) squareStyles[kingSq] = { background: 'rgba(200,49,28,0.55)', boxShadow: '0 0 0 3px rgba(200,49,28,0.4) inset' }
  }

  // Hint (blue, always on top)
  if (hint) {
    squareStyles[hint.from] = { background: 'rgba(59,130,246,0.35)' }
    squareStyles[hint.to]   = { background: 'rgba(59,130,246,0.65)' }
  }

  const isMyTurn = status === 'playing' && game.turn() === playerColor

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', gap: 14 }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
          {mode === 'vs-bot' ? 'vs Stockfish' : 'vs Challenger'}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)' }}>
          {territoryName}
        </div>
      </div>

      {/* Board */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop,
            onPieceDrag,
            onSquareClick,
            boardOrientation: playerColor === 'w' ? 'white' : 'black',
            squareStyles,
            darkSquareStyle: { backgroundColor: '#b5a07a' },
            lightSquareStyle: { backgroundColor: '#f4f1ea' },
            allowDragging: isMyTurn,
            animationDurationInMs: 160,
          }}
        />
      </div>

      {/* Status + actions */}
      <div style={{ width: '100%', maxWidth: 390 }}>

        {status === 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Turn indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                background: isMyTurn ? 'var(--ink)' : 'var(--line)',
                boxShadow: isMyTurn ? '0 0 0 3px rgba(17,17,17,0.12)' : 'none',
                transition: 'all 0.3s',
              }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isMyTurn ? 'var(--ink)' : 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {isMyTurn
                  ? (game.isCheck() ? '\u26a0 Check \u2014 Your move' : 'Your move')
                  : 'Opponent thinking\u2026'}
              </span>
            </div>

            {/* Hint + Insta-win row (only when it's your turn) */}
            {isMyTurn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                {/* Hint button */}
                <button
                  onClick={hint ? () => setHint(null) : requestHint}
                  disabled={requestingHint}
                  style={{
                    height: 40, paddingLeft: 14, paddingRight: 14,
                    borderRadius: 10, border: hint ? 'none' : '1px solid var(--line)',
                    background: hint ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: hint ? 'rgba(59,130,246,0.9)' : 'var(--muted)',
                    fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
                    cursor: requestingHint ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.2s, color 0.2s',
                    opacity: requestingHint ? 0.6 : 1,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  {requestingHint ? 'Analyzing\u2026' : hint ? 'Clear Hint' : 'Hint'}
                </button>

                <div style={{ flex: 1 }} />

                {/* Instant-win button */}
                <button
                  onClick={() => resolveChallenge('won')}
                  disabled={resolving}
                  title="Instant Win (admin)"
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    border: '1px solid var(--line-soft)',
                    background: 'var(--bg-warm)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                    transition: 'background 0.15s',
                  }}
                >
                  ⚡
                </button>
              </div>
            )}
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
                fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'italic',
                color: status === 'won' ? '#f4f1ea' : status === 'lost' ? 'var(--red)' : 'var(--ink)',
              }}>
                {status === 'won' ? '\u2694 Victory' : status === 'lost' ? 'Defeat' : 'Draw'}
              </div>
              <div style={{
                fontFamily: 'var(--sans)', fontSize: 13,
                color: status === 'won' ? 'rgba(244,241,234,0.7)' : 'var(--muted)', marginTop: 4,
              }}>
                {status === 'won' ? `${territoryName} is now yours.`
                  : status === 'lost' ? 'The territory holds.'
                  : 'No territory changes.'}
              </div>
            </div>
            <button
              onClick={() => resolveChallenge(status)}
              disabled={resolving}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: 'var(--ink)', color: '#f4f1ea', border: 'none',
                fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14,
                letterSpacing: '0.08em', textTransform: 'uppercase',
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
