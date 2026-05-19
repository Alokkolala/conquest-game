'use client'

import { useState, useEffect } from 'react'
import { HexGrid, Layout } from 'react-hexgrid'
import { createClient } from '@/lib/supabase'
import type { Territory, Profile } from '@/lib/types'
import TerritoryHex from './TerritoryHex'

interface Props {
  initialTerritories: Territory[]
  currentUser: Profile | null
}

export default function HexMap({ initialTerritories, currentUser }: Props) {
  const [territories, setTerritories] = useState<Territory[]>(initialTerritories)
  const [contestedIds, setContestedIds] = useState<Set<number>>(new Set())
  const supabase = createClient()

  // ── Realtime: territory ownership changes ──────────────────
  useEffect(() => {
    const channel = supabase
      .channel('hex-map')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'territories' },
        async (payload) => {
          const { data } = await supabase
            .from('territories')
            .select('*, owner:profiles(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setTerritories(prev => prev.map(t => t.id === data.id ? data : t))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenges' },
        async () => {
          const { data } = await supabase
            .from('challenges')
            .select('territory_id')
            .in('status', ['pending', 'active'])
          if (data) setContestedIds(new Set(data.map(c => c.territory_id)))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // ── Initial contested set ──────────────────────────────────
  useEffect(() => {
    supabase
      .from('challenges')
      .select('territory_id')
      .in('status', ['pending', 'active'])
      .then(({ data }) => {
        if (data) setContestedIds(new Set(data.map(c => c.territory_id)))
      })
  }, [supabase])

  // Placeholder click handler — Plans 02 & 03 wire this up
  function handleHexClick(territory: Territory) {
    if (!currentUser) return
    console.log('Clicked:', territory.name, '| owner:', territory.owner?.username ?? 'unclaimed')
  }

  return (
    <div className="flex-1 flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <style>{`
        @keyframes pulse-border {
          0%, 100% { stroke-opacity: 1; }
          50%       { stroke-opacity: 0.3; }
        }
        .contested polygon { animation: pulse-border 1.5s ease-in-out infinite; }
      `}</style>

      <HexGrid width={720} height={640} viewBox="-50 -45 100 90">
        <Layout
          size={{ x: 8, y: 8 }}
          flat={false}
          spacing={1.08}
          origin={{ x: 0, y: 0 }}
        >
          {territories.map(t => (
            <TerritoryHex
              key={t.id}
              territory={t}
              isContested={contestedIds.has(t.id)}
              currentUserId={currentUser?.id ?? null}
              onClick={handleHexClick}
            />
          ))}
        </Layout>
      </HexGrid>
    </div>
  )
}
