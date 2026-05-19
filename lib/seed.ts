import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOTS = [
  {
    username: 'CrimsonGuard',
    display_color: '#8b2020',
    email: 'bot1@conquest.local',
    hexes: [[1, 0], [2, -1], [1, 1]] as [number, number][],   // Ironhold, Stonegate, Driftmark
  },
  {
    username: 'AzureCrown',
    display_color: '#1a4a8b',
    email: 'bot2@conquest.local',
    hexes: [[-1, 1], [-2, 1], [-2, 2]] as [number, number][], // Ashridge, Rust Hills, Copperfield
  },
  {
    username: 'VerdantHold',
    display_color: '#1a6b2a',
    email: 'bot3@conquest.local',
    hexes: [[-1, 0], [-2, 0], [-1, -1]] as [number, number][],// Mistveil, Pale Marsh, Windfell
  },
  {
    username: 'ObsidianPact',
    display_color: '#6b1a8b',
    email: 'bot4@conquest.local',
    hexes: [[0, -1], [0, -2], [1, -2]] as [number, number][], // Greyspire, Amber Vale, Iron Pass
  },
]

async function seed() {
  console.log('Seeding bot profiles and territories...\n')

  for (const bot of BOTS) {
    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: bot.email,
      password: 'conquest-bot-2026',
      email_confirm: true,
    })
    if (authErr) {
      console.error(`  ✗ Auth error for ${bot.username}: ${authErr.message}`)
      continue
    }
    const userId = authData.user.id

    // Upsert profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId,
      username: bot.username,
      display_color: bot.display_color,
    })
    if (profileErr) {
      console.error(`  ✗ Profile error for ${bot.username}: ${profileErr.message}`)
      continue
    }

    // Assign territories
    for (const [q, r] of bot.hexes) {
      const { error } = await supabase
        .from('territories')
        .update({ owner_id: userId })
        .eq('hex_q', q)
        .eq('hex_r', r)
      if (error) console.error(`  ✗ Territory (${q},${r}): ${error.message}`)
    }

    console.log(`  ✓ ${bot.username} — owns ${bot.hexes.length} territories`)
  }

  console.log('\nSeed complete.')
}

seed().catch(console.error)
