import { NextResponse } from "next/server"
import { z } from "zod"
import { getActiveAdmin } from "@/lib/admin/auth"
import { generateTemporaryPassword } from "@/lib/admin/password"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  // Explicit confirmation to turn an existing Discord account into an admin.
  promote: z.boolean().optional(),
})

const NO_STORE = { "Cache-Control": "no-store" }

// Creates an admin account, or promotes an existing Discord account whose email matches.
// Server-side only: the service role key never leaves this route. The generated password is
// returned once, in this response, and stored nowhere (Supabase keeps only its hash).
// Delivery to the new admin is manual by design: nothing is emailed.
export async function POST(request: Request) {
  const admin = await getActiveAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 })
  }

  const service = getServiceRoleSupabase()
  if (!service) return NextResponse.json({ error: "Server is not configured for admin accounts." }, { status: 503 })

  const { email, promote } = parsed.data

  const { data: found } = await service.rpc("admin_lookup_user", { lookup_email: email })
  const existing = (found as { id: string; role: string | null; has_discord: boolean }[] | null)?.[0]

  if (existing) {
    if (existing.role === "admin") {
      return NextResponse.json({ error: "This account is already an admin." }, { status: 409 })
    }
    // Only Discord accounts can be promoted; anything else with this email is a conflict.
    if (!existing.has_discord) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
    }
    if (!promote) {
      return NextResponse.json(
        { code: "discord_account_exists", error: "A Discord account already uses this email." },
        { status: 409 },
      )
    }
    return promoteDiscordAccount(service, existing.id, email)
  }

  const password = generateTemporaryPassword()

  // email_confirm: no verification email is needed (there is no transactional email here).
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) {
    if (error?.code === "email_exists") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
    }
    console.error("createUser failed:", error?.message)
    return NextResponse.json({ error: "Couldn't create the account." }, { status: 500 })
  }

  // The Discord trigger skips email accounts, so the admin profile is written here.
  const { error: profileError } = await service
    .from("profiles")
    .insert({ id: data.user.id, role: "admin", must_change_password: true })
  if (profileError) {
    console.error("Admin profile insert failed:", profileError.message)
    // Don't leave a login without a profile behind.
    await service.auth.admin.deleteUser(data.user.id)
    return NextResponse.json({ error: "Couldn't create the account." }, { status: 500 })
  }

  return NextResponse.json({ email, password, promoted: false }, { headers: NO_STORE })
}

// A Discord account has no password, and the dashboard signs in with email + password. So
// promoting sets a temporary one and flags the profile, which sends the person through the
// same first-login password change as a freshly created admin. Their Discord sign-in keeps working.
async function promoteDiscordAccount(
  service: NonNullable<ReturnType<typeof getServiceRoleSupabase>>,
  userId: string,
  email: string,
) {
  const password = generateTemporaryPassword()

  const { error: passwordError } = await service.auth.admin.updateUserById(userId, { password })
  if (passwordError) {
    console.error("Promotion: setting the temporary password failed:", passwordError.message)
    return NextResponse.json({ error: "Couldn't promote the account." }, { status: 500 })
  }

  // upsert covers a Discord account whose profile row is missing; Discord fields are left alone.
  const { error: profileError } = await service
    .from("profiles")
    .upsert({ id: userId, role: "admin", must_change_password: true }, { onConflict: "id" })
  if (profileError) {
    // The temporary password was never shown to anyone and the role is unchanged, so there is nothing to undo.
    console.error("Promotion: updating the profile failed:", profileError.message)
    return NextResponse.json({ error: "Couldn't promote the account." }, { status: 500 })
  }

  return NextResponse.json({ email, password, promoted: true }, { headers: NO_STORE })
}
