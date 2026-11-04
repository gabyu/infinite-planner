import { getActiveAdmin } from "@/lib/admin/auth"
import { isSameOrigin, json } from "@/lib/flight-plan-server"
import { ingestKml, MAX_FILE_BYTES } from "@/lib/procedure-ingest"
import { allowAction } from "@/lib/rate-limit"

// Adds flight files to the airport procedures database. One multipart form, field "file", a few files per request: a
// request is limited to about 4.5 MB on Vercel, so the page sends the files in batches. Each file is analysed in memory
// and dropped; only the light rows reach the database, through a function that checks is_admin() itself.
export const dynamic = "force-dynamic"

const MAX_FILES = 8
const MAX_REQUEST_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden." }, 403)
  const admin = await getActiveAdmin()
  if (!admin) return json({ error: "Forbidden." }, 403)
  if (!allowAction(admin.user.id, 120)) return json({ error: "Too many requests. Wait a minute." }, 429)

  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_REQUEST_BYTES) return json({ error: "This batch is too large." }, 413)
  const form = await request.formData().catch(() => null)
  const files = (form?.getAll("file") ?? []).filter((f): f is File => typeof f !== "string")
  if (files.length === 0 || files.length > MAX_FILES) return json({ error: "Send between 1 and 8 files." }, 400)

  const results = []
  for (const file of files) {
    const original = file.name.slice(0, 200)
    if (file.size > MAX_FILE_BYTES) {
      results.push({ ok: false, original, error: "The file is too large (limit 8 MB)." })
      continue
    }
    const ingested = ingestKml(await file.text(), original)
    if (!ingested.ok) {
      results.push({ ok: false, original, error: ingested.error })
      continue
    }
    const { data, error } = await admin.supabase.rpc("admin_add_procedure_flights", { p_rows: ingested.rows })
    if (error) {
      results.push({ ok: false, original, error: error.message.includes("too_many_rows") ? "The database is full." : "Could not be saved." })
      continue
    }
    const added = (data as { added?: number } | null)?.added ?? 0
    if (added === 0) {
      results.push({ ok: false, original, error: "Already in the database." })
      continue
    }
    results.push({ ok: true, original, name: ingested.route, placed: ingested.placed, checks: ingested.checks })
  }
  return json({ results })
}
