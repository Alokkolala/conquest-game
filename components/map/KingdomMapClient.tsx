'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import WorldMap from './WorldMap'
import TerritorySheet from './TerritorySheet'
import type { Territory, CountryFeature } from '@/lib/types'

interface Props {
  width?: number
  height?: number
  initialTerritories: Territory[]
  currentUserId?: string
  currentUsername?: string
}

export default function KingdomMapClient({
  width = 390, height = 250,
  initialTerritories,
  currentUserId,
  currentUsername = '',
}: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const supabase = createClient()

  // Build ownerMap from live territories: country name → owner username
  const ownerMap: Record<string, string> = {}
  for (const t of territories) {
    if (t.owner?.username) ownerMap[t.name] = t.owner.username
  }

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

  return (
    <>
      <WorldMap
        width={width}
        height={height}
        ownerMap={ownerMap}
        currentUsername={currentUsername}
        onCountryClick={setSelected}
      />
      {selected && (
        <TerritorySheet
          feature={selected}
          onClose={() => setSelected(null)}
          onClaim={() => setSelected(null)}
          onChallenge={() => setSelected(null)}
          onDefend={() => setSelected(null)}
        />
      )}
    </>
  )
}
