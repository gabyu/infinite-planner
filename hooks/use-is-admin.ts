"use client"

import { useEffect, useState } from "react"
import { useAuthUser } from "@/hooks/use-auth-user"
import { getBrowserSupabase } from "@/lib/supabase/client"

// The signed-in user's role as far as the library is concerned. Display only (it decides whether a link is shown; the
// pages behind it check again on the server). Does nothing, and asks nothing, unless `enabled`.
//
// The session comes from useAuthUser, whose onAuthStateChange callback only sets state. That matters: the auth library
// awaits those callbacks while it holds its session lock, so a callback that itself calls Supabase (the profile query
// below) would wait for a lock it is holding, and freeze every other auth call on the page: no avatar in the header,
// no account menu. The query therefore lives in its own effect, run after the callback returned.
function useRoleCheck(enabled: boolean, accepts: (role: string, mustChangePassword: boolean) => boolean) {
  const { user } = useAuthUser()
  const userId = enabled ? user?.id : undefined
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!userId) return setOk(false)
    const supabase = getBrowserSupabase()
    if (!supabase) return
    let cancelled = false
    supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOk(!!data && accepts(data.role, !!data.must_change_password))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

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
