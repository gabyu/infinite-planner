import { cache } from "react"
import { redirect } from "next/navigation"
import { getServerSupabase } from "@/lib/supabase/server"

export const ADMIN_BASE = "/admin-dashboard"

export interface AdminProfile {
  role: string
  must_change_password: boolean
  timezone: string | null
}

// Resolves the signed-in user and their profile (own row, via RLS).
export const getSessionContext = cache(async function getSessionContext() {
  const supabase = getServerSupabase()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("role, must_change_password, timezone")
    .eq("id", user.id)
    .maybeSingle()

  return { supabase, user, profile: (data as AdminProfile | null) ?? null }
})

// For route handlers: a fully active admin (not pending a password change), or null.
export async function getActiveAdmin() {
  const ctx = await getSessionContext()
  if (!ctx || ctx.profile?.role !== "admin" || ctx.profile.must_change_password) return null
  return { ...ctx, profile: ctx.profile }
}

// For server components: the middleware already redirects, this re-checks on the
// server so a protected page never renders without an active admin.
export async function requireAdmin() {
  const ctx = await getSessionContext()
  if (!ctx || ctx.profile?.role !== "admin") redirect(`${ADMIN_BASE}/login`)
  if (ctx.profile.must_change_password) redirect(`${ADMIN_BASE}/first-login`)
  return { ...ctx, profile: ctx.profile }
}
