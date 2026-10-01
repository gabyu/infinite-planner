import { NextResponse } from "next/server"
import { z } from "zod"
import { getActiveAdmin } from "@/lib/admin/auth"
import { generateTemporaryPassword } from "@/lib/admin/password"
import { getServiceRoleSupabase } from "@/lib/supabase/admin"

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
})

// Creates an admin account. Server-side only: the service role key never leaves this route.
// The generated password is returned once, in this response, and stored nowhere (Supabase
// keeps only its hash). Delivery to the new admin is manual by design: nothing is emailed.
export async function POST(request: Request) {
  const admin = await getActiveAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 })
  }

  const service = getServiceRoleSupabase()
  if (!service) return NextResponse.json({ error: "Server is not configured for admin accounts." }, { status: 503 })

  const { email } = parsed.data
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

  return NextResponse.json({ email, password }, { headers: { "Cache-Control": "no-store" } })
}
