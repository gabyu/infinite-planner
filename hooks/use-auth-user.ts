"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { getBrowserSupabase } from "@/lib/supabase/client"

// The signed-in user (null when signed out, or when accounts aren't configured), plus
// whether the first session check has finished and whether accounts are configured at all. Display/UX only: whatever the user does with
// the answer is enforced again on the server (RLS and the API routes).
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    setAvailable(!!supabase)
    if (!supabase) {
      setReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  return { user, ready, available }
}

// Starts the Discord sign-in and brings the user back to the page they were on.
export async function signInWithDiscord() {
  const supabase = getBrowserSupabase()
  if (!supabase) return
  const next = window.location.pathname + window.location.search
  await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
}
