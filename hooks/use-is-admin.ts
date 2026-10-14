"use client"

import { useEffect, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase/client"

// Whether the signed-in user is an active admin. Display only (it decides whether a link is shown; the
// pages behind it check again on the server). Does nothing, and asks nothing, unless `enabled`.
export function useIsAdmin(enabled = true) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!enabled) return setIsAdmin(false)
    const supabase = getBrowserSupabase()
    if (!supabase) return
    let cancelled = false

    const check = async (userId: string | undefined) => {
      if (!userId) return !cancelled && setIsAdmin(false)
      const { data } = await supabase.from("profiles").select("role, must_change_password").eq("id", userId).maybeSingle()
      if (!cancelled) setIsAdmin(data?.role === "admin" && !data.must_change_password)
    }
    supabase.auth.getSession().then(({ data }) => check(data.session?.user.id))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => check(session?.user.id))
    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [enabled])

  return isAdmin
}
