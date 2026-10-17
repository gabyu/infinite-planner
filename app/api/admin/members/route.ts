import { getActiveAdmin } from "@/lib/admin/auth"
import { json } from "@/lib/flight-plan-server"

// Discord members (not contributors, not admins) whose name contains the query: who an admin can raise to contributor.
// The database function checks is_admin() itself.
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const admin = await getActiveAdmin()
  if (!admin) return json({ error: "Forbidden." }, 403)

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? ""
  if (!query) return json({ members: [] })

  const { data, error } = await admin.supabase.rpc("admin_find_members", { p_query: query })
  if (error) {
    console.error("Searching members failed:", error.message)
    return json({ error: "Search failed." }, 500)
  }
  return json({ members: data ?? [] })
}
