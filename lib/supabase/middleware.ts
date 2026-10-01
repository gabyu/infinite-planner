import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig } from "./config"

// Refreshes the Supabase session cookie on every matched request and returns the
// verified user (getUser() asks the Auth server; it never trusts the cookie alone).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const config = getSupabaseConfig()
  if (!config) return { response, supabase: null, user: null }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Nothing may run between createServerClient and getUser, or sessions get dropped.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, supabase, user }
}
