import "server-only"
import { createClient } from "@supabase/supabase-js"

// Service-role client: bypasses RLS. Server only (the "server-only" import makes the
// build fail if a client component ever pulls this in), and only used by the admin API
// routes for the things a signed-in user must never do themselves: creating an admin
// account and clearing must_change_password.
// SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so it never reaches the browser.
export function getServiceRoleSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next.js caches fetch() results by default, even for POSTs made from a GET route. Nothing
    // this client does may ever be served from that cache: a revoked share link has to stop
    // working at once, and every shared download has to be counted.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  })
}
