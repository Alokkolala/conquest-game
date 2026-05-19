import { redirect } from 'next/navigation'
import { createServerClient_ } from '@/lib/supabase-server'
import HexMap from '@/components/map/HexMap'
import MapSidebar from '@/components/map/MapSidebar'
import ProModal from '@/components/ui/ProModal'
import type { Profile } from '@/lib/types'

const DISPLAY_COLORS = ['#4a90d9', '#d94a4a', '#4ad94a', '#d9a84a', '#9a4ad9', '#d94a90']

export default async function MapPage() {
  const supabase = await createServerClient_()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Fetch or create profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const username = (user.email ?? '').split('@')[0].replace(/[^a-z0-9_]/gi, '') || `player${user.id.slice(0, 5)}`
    const display_color = DISPLAY_COLORS[Math.floor(Math.random() * DISPLAY_COLORS.length)]
    const { data: created } = await supabase
      .from('profiles')
      .insert({ id: user.id, username, display_color })
      .select('*')
      .single()
    profile = created
  }

  // Fetch all territories with owner profile joined
  const { data: territories } = await supabase
    .from('territories')
    .select('*, owner:profiles(*)')
    .order('id')

  // Leaderboard: top 10 by territory count
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, username, display_color, territory_count, created_at')
    .order('territory_count', { ascending: false })
    .limit(10)

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Nav */}
      <nav className="h-12 flex items-center justify-between px-4 border-b border-neutral-800 shrink-0">
        <h1 className="font-cinzel text-lg font-bold text-[#c8a96e] tracking-widest">
          CONQUEST
        </h1>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-xs text-neutral-400 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: profile.display_color }}
              />
              {profile.username}
            </span>
          )}
          <ProModal />
        </div>
      </nav>

      {/* Body: map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <HexMap
          initialTerritories={territories ?? []}
          currentUser={profile as Profile | null}
        />
        <MapSidebar
          currentUser={profile as Profile | null}
          leaderboard={(leaderboard ?? []) as Profile[]}
        />
      </div>
    </div>
  )
}
