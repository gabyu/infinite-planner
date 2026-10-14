import "server-only"
import { cache } from "react"
import { unstable_cache } from "next/cache"
import { getServerSupabase } from "@/lib/supabase/server"
import { fetchLibraryLaunched } from "@/lib/library-state"

// Who may see the library. While it isn't launched only admins do; once it is, everyone.
// isLibraryOpenFor() is the single place that decides: every library route, nav item and
// control goes through it.

export interface Viewer {
  userId: string | null
  isAdmin: boolean
}

// The signed-in user, verified with the Auth server, and whether they are an active admin.
// Reads the session cookie, so a page that calls it is rendered per request: the cached library
// pages never do (their gate is the launch flag alone, and admins are routed to the live
// /preview variant by the middleware).
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = getServerSupabase()
  if (!supabase) return { userId: null, isAdmin: false }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { userId: null, isAdmin: false }
  const { data } = await supabase.rpc("is_admin")
  return { userId: user.id, isAdmin: data === true }
})

export async function isLibraryOpenFor(viewer: Viewer): Promise<boolean> {
  return (await fetchLibraryLaunched()) || viewer.isAdmin
}

// The launch flag as a cached page input: tagged `library`, so flipping the switch (which revalidates
// that tag) refreshes every cached library page at once. Pages use this one; the middleware
// reads the flag directly.
export const getLibraryLaunched = unstable_cache(() => fetchLibraryLaunched(true), ["library-launched"], {
  tags: ["library"],
  revalidate: 300,
})
