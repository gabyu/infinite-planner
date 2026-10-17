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
  // A Discord account an admin raised to publish during the soft launch. No admin space, but the library is open to it
  // before the launch.
  isContributor: boolean
  // May use the library before its launch: an admin or a contributor.
  canPreview: boolean
}

const ANONYMOUS: Viewer = { userId: null, isAdmin: false, isContributor: false, canPreview: false }

// The signed-in user, verified with the Auth server, and their role (admin / contributor / member).
// Reads the session cookie, so a page that calls it is rendered per request: the cached library
// pages never do (their gate is the launch flag alone, and admins are routed to the live
// /preview variant by the middleware).
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = getServerSupabase()
  if (!supabase) return ANONYMOUS
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return ANONYMOUS
  const { data } = await supabase.rpc("viewer_role")
  const isAdmin = data === "admin"
  const isContributor = data === "contributor"
  return { userId: user.id, isAdmin, isContributor, canPreview: isAdmin || isContributor }
})

export async function isLibraryOpenFor(viewer: Viewer): Promise<boolean> {
  return (await fetchLibraryLaunched()) || viewer.canPreview
}

// The launch flag as a cached page input: tagged `library`, so flipping the switch (which revalidates
// that tag) refreshes every cached library page at once. Pages use this one; the middleware
// reads the flag directly.
export const getLibraryLaunched = unstable_cache(() => fetchLibraryLaunched(true), ["library-launched"], {
  tags: ["library"],
  revalidate: 300,
})
