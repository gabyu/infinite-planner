"use client"

import { useEffect, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase/client"

// The signed-in user's role as far as the library is concerned. Display only (it decides whether a link is shown; the
// pages behind it check again on the server). Does nothing, and asks nothing, unless `enabled`.
function useRoleCheck(enabled: boolean, accepts: (role: string, mustChangePassword: boolean) => boolean) {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!enabled) return setOk(false)
    const supabase = getBrowserSupabase()
    if (!supabase) return
    let cancelled = false

    const check = async (userId: string | undefined) => {
      if (!userId) return !cancelled && setOk(false)
      const { data } = await supabase.from("profiles").select("role, must_change_password").eq("id", userId).maybeSingle()
      if (!cancelled) setOk(!!data && accepts(data.role, !!data.must_change_password))
    }
    supabase.auth.getSession().then(({ data }) => check(data.session?.user.id))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => check(session?.user.id))
    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return ok
}

const isActiveAdmin = (role: string, mustChange: boolean) => role === "admin" && !mustChange

export function useIsAdmin(enabled = true) {
  return useRoleCheck(enabled, isActiveAdmin)
}

// May use the library before its launch: an admin or a contributor.
export function useLibraryPreview(enabled = true) {
  return useRoleCheck(enabled, (role, mustChange) => isActiveAdmin(role, mustChange) || role === "contributor")
}
