import { revalidateTag } from "next/cache"
import {
  flightPlanBodySchema,
  flightPlanColumns,
  isLockedError,
  isMissingExtraColumn,
  isUuid,
  json,
  LOCKED_MESSAGE,
  requireUser,
  withoutExtraNumbers,
} from "@/lib/flight-plan-server"

// A flight plan of the signed-in user, in full (waypoints included): used to reopen a draft in
// Convert/Sketch and to view a plan from the dashboard. RLS only lets the owner see the row, so
// someone else's id looks like a missing one.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const fields =
    "id, status, source, origin_sources, created_at, flight_number, origin_airport, destination_airport, origin_airport_name, destination_airport_name, waypoints, includes_branding, flight_time_minutes, visibility, public_id, is_fork, featured"
  const read = (list: string) => auth.supabase.from("flight_plans").select(list).eq("id", params.id).maybeSingle()
  let { data, error } = await read(`${fields}, extra_flight_numbers`)
  // A database without the extra_flight_numbers column yet: read the plan without it.
  if (isMissingExtraColumn(error)) ({ data, error } = await read(fields))
  if (!data) return json({ error: "Flight plan not found." }, 404)

  return json(data)
}

// Saves the plan again: an autosave of a draft, or the export that locks it. An exported plan
// can't be changed any more (409).
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { supabase } = auth

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const parsed = flightPlanBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid flight plan." }, 400)
  }

  const columns = flightPlanColumns(parsed.data)
  const save = (values: object) =>
    supabase.from("flight_plans").update(values).eq("id", params.id).select("id, status, created_at").maybeSingle()
  let { data, error } = await save(columns)
  // A database without the extra_flight_numbers column yet: save the rest (nothing is lost with one number only).
  if (isMissingExtraColumn(error) && columns.extra_flight_numbers.length === 0) {
    ;({ data, error } = await save(withoutExtraNumbers(columns)))
  }

  if (isLockedError(error)) return json({ error: LOCKED_MESSAGE, code: "locked" }, 409)
  if (error) {
    console.error("Updating a flight plan failed:", error.message)
    return json({ error: "Couldn't save the flight plan." }, 500)
  }
  if (!data) return json({ error: "Flight plan not found." }, 404)

  return json({ id: data.id, status: data.status, createdAt: data.created_at })
}

// Deletes one of the signed-in user's plans. Done here rather than from the browser so the cached
// public page, preview image and listings of a shared plan are dropped at once; its copies
// (forks) stay with their owners.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error

  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)

  const { data, error } = await auth.supabase
    .from("flight_plans")
    .delete()
    .eq("id", params.id)
    .select("public_id")
    .maybeSingle()
  if (error) {
    console.error("Deleting a flight plan failed:", error.message)
    return json({ error: "Couldn't delete the flight plan." }, 500)
  }
  if (!data) return json({ error: "Flight plan not found." }, 404)

  if (data.public_id) revalidateTag(`plan:${data.public_id}`)
  revalidateTag("library-index")
  return json({ ok: true })
}
