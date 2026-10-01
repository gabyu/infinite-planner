import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSupabase } from "@/lib/supabase/server"

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

const INVALID = { error: "Invalid email or password." }

// Email + password login for the admin dashboard (shared by /login and /first-login).
// Signs the user in server-side, then refuses anyone who isn't an admin, with the same
// message as a wrong password so the form can't be used to discover who is an admin.
export async function POST(request: Request) {
  const supabase = getServerSupabase()
  if (!supabase) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(INVALID, { status: 400 })

  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return NextResponse.json(INVALID, { status: 401 })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("role, must_change_password").eq("id", user.id).maybeSingle()
    : { data: null }

  if (profile?.role !== "admin") {
    await supabase.auth.signOut()
    return NextResponse.json(INVALID, { status: 401 })
  }

  return NextResponse.json({ status: profile.must_change_password ? "must_change_password" : "ok" })
}
