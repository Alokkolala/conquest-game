'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import ConquestMap from './ConquestMap'
import TerritorySheet from './TerritorySheet'
import MapPanZoom from './MapPanZoom'
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
  currentUserId: _currentUserId,
  currentUsername = '',
  isNewUser = false,
}: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
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

  // Player's country codes (alpha-2)
  const playerCodes = useMemo(() => {
    return territories
      .filter(t => t.owner?.username === currentUsername)
      .map(t => NAME_TO_ALPHA2[t.name] ?? '')
      .filter(Boolean)
  }, [territories, currentUsername])

  // Bot owner map from live territories: alpha-2 → bot username
  const liveBotOwnerMap = useMemo(() => {
    const staticBotMap = buildBotOwnerMap()
    const liveMap: Record<string, string> = { ...staticBotMap }
    for (const t of territories) {
      const code = NAME_TO_ALPHA2[t.name]
      if (code && t.owner?.username && t.owner.username !== currentUsername) {
        liveMap[code] = t.owner.username
      }
    }
    return liveMap
  }, [territories, currentUsername])

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
          onClaim={() => setSelected(null)}
          onChallenge={() => setSelected(null)}
          onDefend={() => setSelected(null)}
        />
      )}
    </>
  )
}
