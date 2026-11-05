import { revalidateTag } from "next/cache"
import { z } from "zod"
import { allowAction } from "@/lib/rate-limit"
import { isUuid, json, RUNWAY_PATTERN, requireUser } from "@/lib/flight-plan-server"

// The details of one of the signed-in user's plans that can still be edited after the export: the flight number, the aircraft
// and the two runways. They live in our system only (the .fpl has none of them), so an exported plan keeps its route and its
// file. The database function checks ownership and is the only way to change the flight number of an exported plan.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // eslint-disable-next-line no-control-regex
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Invalid text.")
const bodySchema = z.object({
  flightNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,12}$/, "Flight numbers use letters and digits, up to 12.").nullable(),
  aircraft: text(60).nullable(),
  departureRunway: z.string().trim().toUpperCase().regex(RUNWAY_PATTERN, "Invalid departure runway.").nullable(),
  arrivalRunway: z.string().trim().toUpperCase().regex(RUNWAY_PATTERN, "Invalid arrival runway.").nullable(),
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (auth.error) return auth.error
  const { supabase, user } = auth
  if (!isUuid(params.id)) return json({ error: "Flight plan not found." }, 404)
  if (!allowAction(user.id, 60)) return json({ error: "Too many changes. Wait a minute." }, 429)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, 400)
  const body = parsed.data

  const { error } = await supabase.rpc("update_flight_plan_details", {
    p_plan_id: params.id,
    p_flight_number: body.flightNumber ?? "",
    p_aircraft: body.aircraft ?? "",
    p_departure_runway: body.departureRunway ?? "",
    p_arrival_runway: body.arrivalRunway ?? "",
  })
  if (error) {
    if (error.message?.includes("plan_not_found")) return json({ error: "Flight plan not found." }, 404)
    console.error("Updating flight plan details failed:", error.message)
    return json({ error: "Couldn't save the details." }, 500)
  }

  // A public plan's page and the library listing show the flight number: drop what was cached.
  const { data } = await supabase.from("flight_plans").select("public_id").eq("id", params.id).maybeSingle()
  if (data?.public_id) revalidateTag(`plan:${data.public_id}`)
  revalidateTag("library-index")

  return json({ ok: true, ...body })
}
