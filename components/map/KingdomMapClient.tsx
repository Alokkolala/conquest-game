'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import ConquestMap from './ConquestMap'
import MapPanZoom from './MapPanZoom'
import TerritorySheet from './TerritorySheet'
import type { Territory, CountryFeature } from '@/lib/types'
import { NAME_TO_ALPHA2 } from '@/lib/country-codes'
import { buildBotOwnerMap } from '@/lib/game-state'

interface Props {
  initialTerritories: Territory[]
  currentUserId?: string
  currentUsername?: string
  isNewUser?: boolean
}

export default function KingdomMapClient({
  initialTerritories,
  currentUserId,
  currentUsername = '',
  isNewUser = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [welcomeBanner, setWelcomeBanner] = useState(
    searchParams.get('firstVisit') === '1'
  )
  const supabase = useMemo(() => createClient(), [])

  // Realtime: territory ownership changes
  useEffect(() => {
    const channel = supabase
      .channel('world-map')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'territories' }, async (payload) => {
        const { data } = await supabase
          .from('territories')
          .select('*, owner:profiles(*)')
          .eq('id', payload.new.id)
          .single()
        if (data) setTerritories(prev => prev.map(t => t.id === data.id ? data : t))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // Auto-dismiss first-visit welcome banner
  useEffect(() => {
    if (!welcomeBanner) return
    const t = setTimeout(() => setWelcomeBanner(false), 4000)
    return () => clearTimeout(t)
  }, [welcomeBanner])

  const firstTerritoryName = useMemo(() => {
    const t = territories.find(t => t.owner?.username === currentUsername)
    return t?.name ?? null
  }, [territories, currentUsername])

  // Player's country codes (alpha-2)
  const playerCodes = useMemo(() =>
    territories
      .filter(t => t.owner?.username === currentUsername)
      .map(t => NAME_TO_ALPHA2[t.name] ?? '')
      .filter(Boolean),
    [territories, currentUsername]
  )

  // Bot owner map from live territories
  const liveBotOwnerMap = useMemo(() => {
    const liveMap: Record<string, string> = { ...buildBotOwnerMap() }
    for (const t of territories) {
      const code = NAME_TO_ALPHA2[t.name]
      if (code && t.owner?.username && t.owner.username !== currentUsername) {
        liveMap[code] = t.owner.username
      }
    }
    return liveMap
  }, [territories, currentUsername])

  // Find territory in DB by country name
  function findTerritory(name: string) {
    return territories.find(t => t.name === name)
  }

  // Claim a neutral territory (vs Stockfish)
  const handleClaim = useCallback(async () => {
    if (!selected || !currentUserId) return
    setActionLoading(true)
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territory_name: selected.name, defender_id: null }),
    })
    const data = await res.json()
    setActionLoading(false)
    setSelected(null)
    if (data.challenge_id) router.push(`/game/${data.challenge_id}`)
  }, [selected, currentUserId, router])

  // Challenge an enemy territory
  const handleChallenge = useCallback(async () => {
    if (!selected || !currentUserId) return
    setActionLoading(true)
    const territory = findTerritory(selected.name)
    const defenderId = territory?.owner_id ?? null
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ territory_name: selected.name, defender_id: defenderId }),
    })
    const data = await res.json()
    setActionLoading(false)
    setSelected(null)
    if (data.challenge_id) router.push(`/game/${data.challenge_id}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentUserId, router, territories])

  // Defend: find existing active challenge and go to its game page
  const handleDefend = useCallback(async () => {
    if (!selected || !currentUserId) return
    const territory = findTerritory(selected.name)
    if (!territory) return
    setActionLoading(true)
    const { data: challenges } = await supabase
      .from('challenges')
      .select('id')
      .eq('territory_id', territory.id)
      .eq('defender_id', currentUserId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
    setActionLoading(false)
    setSelected(null)
    if (challenges?.[0]) router.push(`/game/${challenges[0].id}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, currentUserId, router, territories, supabase])

  return (
    <>
      <MapPanZoom minScale={1} maxScale={5}>
        <ConquestMap
          playerCodes={playerCodes}
          botOwnerMap={liveBotOwnerMap}
          currentUsername={currentUsername}
          isNewUser={isNewUser}
          size="xxl"
          onCountryClick={setSelected}
        />
      </MapPanZoom>
      {selected && (
        <TerritorySheet
          feature={selected}
          isNewUser={isNewUser}
          onClose={() => setSelected(null)}
          onClaim={handleClaim}
          onChallenge={handleChallenge}
          onDefend={handleDefend}
        />
      )}
      {actionLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: '20px 32px', fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic' }}>
            Preparing battle…
          </div>
        </div>
      )}
      {welcomeBanner && firstTerritoryName && (
        <div
          onClick={() => setWelcomeBanner(false)}
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'var(--ink)',
            color: '#f4f1ea',
            borderRadius: 14,
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            animation: 'cq-banner-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 2 }}>
            Banner planted
          </span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', letterSpacing: '-0.01em' }}>
            {firstTerritoryName}
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'rgba(244,241,234,0.45)', marginTop: 2 }}>
            Tap gold territories to expand your empire
          </span>
        </div>
      )}
    </>
  )
}
