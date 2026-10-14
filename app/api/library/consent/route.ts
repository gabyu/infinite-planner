import { json, requireUser } from "@/lib/flight-plan-server"

// Records that the signed-in user accepted to have their Discord name and avatar shown publicly on the plans
// they publish (asked the first time they choose Public). The timestamp is kept on their profile.
export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { error } = await auth.supabase.rpc("record_library_consent")
  if (error) {
    console.error("Recording the library consent failed:", error.message)
    return json({ error: "Couldn't save your choice. Please try again." }, 500)
  }
  return json({ ok: true })
}
