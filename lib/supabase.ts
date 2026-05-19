import { createBrowserClient } from '@supabase/ssr'

// ── Browser client (Client Components) ──────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Service role client (privileged writes in API routes) ────
export function createServiceClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// NOTE: createServerClient_ is NOT re-exported here because supabase-server.ts
// imports next/headers, which would bleed into client bundles.
// Tasks 8/9 must import it from '@/lib/supabase-server', not '@/lib/supabase':
//   import { createServerClient_ } from '@/lib/supabase-server'
