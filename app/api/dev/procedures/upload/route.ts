import { NextResponse } from "next/server"
import { addFlight, MAX_UPLOAD_BYTES, procedureRoot } from "@/lib/procedure-store"

// Local only (404 outside development). One or several KML files in a multipart form, field "file".
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const root = procedureRoot()
  if (!root) return new NextResponse(null, { status: 404 })
  const form = await request.formData().catch(() => null)
  const files = (form?.getAll("file") ?? []).filter((f): f is File => typeof f !== "string").slice(0, 20)
  if (files.length === 0) return NextResponse.json({ error: "No file." }, { status: 400 })
  const results = []
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) results.push({ ok: false, error: "The file is too large (limit 8 MB).", original: file.name })
    else results.push({ ...addFlight(root, await file.text(), file.name), original: file.name })
  }
  return NextResponse.json({ results })
}
