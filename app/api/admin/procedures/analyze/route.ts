import { getActiveAdmin } from "@/lib/admin/auth"
import { isSameOrigin, json } from "@/lib/flight-plan-server"
import { ingestKml, MAX_FILE_BYTES } from "@/lib/procedure-ingest"
import { allowAction } from "@/lib/rate-limit"

// The first half of an import: reads flight files and says what each one would add (the procedures it holds, with their light
// track), WITHOUT saving anything. The page shows them on the map, the admin picks the runway and the direction of each, and the
// second half (/commit) saves them. Same limits as the upload route: a few files per request, analysed in memory and dropped.
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
    results.push({ ok: true, original, route: ingested.route, rows: ingested.rows, checks: ingested.checks })
  }
  return json({ results })
}
