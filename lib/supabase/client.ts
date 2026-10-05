"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseConfig } from "./config"

let browserClient: SupabaseClient | null = null

// Browser client with cookie-based session (shared with the server clients).
// Returns null when Supabase isn't configured so the site still renders.
export function getBrowserSupabase(): SupabaseClient | null {
  if (browserClient) return browserClient
  const config = getSupabaseConfig()
  if (!config) return null
  browserClient = createBrowserClient(config.url, config.anonKey)
  return browserClient
}
