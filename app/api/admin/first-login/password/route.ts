import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionContext } from "@/lib/admin/auth"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"

const bodySchema = z.object({
  // 72 bytes is bcrypt's limit, the hash Supabase Auth uses.
  password: z.string().min(12, "Use at least 12 characters.").max(72),
})

// Step 2 of the first login: the new admin replaces the temporary password.
// The password change and the flag reset happen together on the server, in this order,
// so must_change_password can never be cleared without the password having changed.
export async function POST(request: Request) {
  const ctx = await getSessionContext()
  if (!ctx || ctx.profile?.role !== "admin") return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  if (!ctx.profile.must_change_password) {
    return NextResponse.json({ error: "No password change is pending for this account." }, { status: 409 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid password." }, { status: 400 })
  }

  const service = getServiceRoleSupabase()
  if (!service) return NextResponse.json({ error: "Server is not configured for admin accounts." }, { status: 503 })

  const { error: updateError } = await ctx.supabase.auth.updateUser({ password: parsed.data.password })
  if (updateError) {
    if (updateError.code === "same_password") {
      return NextResponse.json({ error: "Choose a password different from the temporary one." }, { status: 422 })
    }
    if (updateError.code === "weak_password") {
      return NextResponse.json({ error: "That password is too weak. Try a longer one." }, { status: 422 })
    }
    console.error("First-login password update failed:", updateError.message)
    return NextResponse.json({ error: "Couldn't update the password." }, { status: 500 })
  }

  const { error: flagError } = await service
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", ctx.user.id)
  if (flagError) {
    console.error("Clearing must_change_password failed:", flagError.message)
    return NextResponse.json(
      { error: "Password updated, but the account couldn't be unlocked. Ask for a reset." },
      { status: 500 },
    )
  }

  return NextResponse.json({ status: "ok" })
}
