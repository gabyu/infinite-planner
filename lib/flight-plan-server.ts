import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveAirportName } from "@/lib/airports"
import { FLIGHT_PLAN_SOURCES, FLIGHT_PLAN_STATUSES, UUID_PATTERN } from "@/lib/flight-plans"
import { getServerSupabase } from "@/lib/supabase/server"

const NO_STORE = { "Cache-Control": "no-store" }

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

// What the editor sends when it saves a plan. Everything the database has a say in
// (user_id, airport names, share fields, timestamps) is filled in on the server.
const waypointSchema = z.object({
  // Same shape the editor's name field allows; longer than its 12 characters because a
  // text-file import isn't capped. No control characters.
  name: z
    .string()
    .max(32)
    // eslint-disable-next-line no-control-regex
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Invalid waypoint name."),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  altitude: z.number().finite().min(-2000).max(100000).transform(Math.round),
})

export const flightPlanBodySchema = z.object({
  source: z.enum(FLIGHT_PLAN_SOURCES),
  // 'draft' for an autosave, 'exported' when the FPL is downloaded (locks the plan).
  status: z.enum(FLIGHT_PLAN_STATUSES),
  flightNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,12}$/)
    .nullable(),
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{4}$/, "Enter a valid origin ICAO code."),
  destination: z.string().trim().toUpperCase().regex(/^[A-Z]{4}$/, "Enter a valid destination ICAO code."),
  waypoints: z.array(waypointSchema).min(2, "A flight plan needs at least 2 waypoints.").max(1000),
  includesBranding: z.boolean(),
  flightTimeMinutes: z.number().int().min(1).max(5999).nullable(),
})

export type FlightPlanBody = z.infer<typeof flightPlanBodySchema>

// The columns a save writes, with the airport names resolved here (never trusted from
// the browser). Insert adds user_id and source on top; update leaves source alone.
export function flightPlanColumns(body: FlightPlanBody) {
  return {
    status: body.status,
    flight_number: body.flightNumber,
    origin_airport: body.origin,
    destination_airport: body.destination,
    origin_airport_name: resolveAirportName(body.origin),
    destination_airport_name: resolveAirportName(body.destination),
    waypoints: body.waypoints,
    includes_branding: body.includesBranding,
    flight_time_minutes: body.flightTimeMinutes,
  }
}

// Mutating routes authenticate with the session cookie, so refuse requests another
// site's page made on the user's behalf. (The Supabase cookies are SameSite=Lax too.)
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

// The signed-in user (verified with the Auth server, not just the cookie) plus a Supabase
// client acting as them, so every query below runs under RLS. Returns an error response
// instead when the request can't proceed.
export async function requireUser(request: Request) {
  if (!isSameOrigin(request)) return { error: json({ error: "Forbidden." }, 403) }

  const supabase = getServerSupabase()
  if (!supabase) return { error: json({ error: "Accounts are not available right now." }, 503) }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: json({ error: "Sign in to save flight plans." }, 401) }

  return { supabase, user }
}

// The database refuses any change to an exported plan (trigger flight_plans_stamp_save).
export function isLockedError(error: { code?: string; message?: string } | null) {
  return error?.code === "23514" && !!error.message?.includes("flight_plan_locked")
}

export const LOCKED_MESSAGE = "This flight plan was exported and can no longer be changed. Duplicate it to make changes."

export function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}
