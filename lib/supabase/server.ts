import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseConfig } from "./config"

// Server client for route handlers and server components, acting as the signed-in
// user (anon key + the session cookie), so RLS applies. Never the service role.
export function getServerSupabase() {
  const config = getSupabaseConfig()
  if (!config) return null

  const cookieStore = cookies()
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, which can't write cookies: the
          // middleware already refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}
