import type { Profile } from '@/lib/types'

interface Props {
  currentUser: Profile | null
  leaderboard: Profile[]
}

export default function MapSidebar({ currentUser, leaderboard }: Props) {
  const myRank = leaderboard.findIndex(p => p.id === currentUser?.id) + 1

  return (
    <aside className="w-[280px] border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
      {/* Player card */}
      {currentUser && (
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: currentUser.display_color }}
            />
            <span className="font-cinzel text-sm font-semibold text-[#c8a96e] truncate">
              {currentUser.username}
            </span>
          </div>
          <div className="text-xs text-neutral-400 space-y-0.5 ml-5">
            <div>{currentUser.territory_count} territories</div>
            {myRank > 0 && <div>Rank #{myRank}</div>}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Leaderboard
        </h3>
        <ol className="space-y-1">
          {leaderboard.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded ${
                p.id === currentUser?.id ? 'bg-neutral-800' : ''
              }`}
            >
              <span className="text-neutral-600 w-4 text-right shrink-0">{i + 1}</span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.display_color }}
              />
              <span className="flex-1 text-neutral-300 truncate">{p.username}</span>
              <span className="text-[#c8a96e] font-medium tabular-nums">{p.territory_count}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
