// Reads of the airport procedures database, for the admin page. Every call goes through an admin_* function that checks
// is_admin() itself, with the signed-in admin's own client (never the service role).
import type { SupabaseClient } from "@supabase/supabase-js"
import { airportFor, groupFlights, type FlightAnalysis } from "@/lib/procedure-analysis"
import { buildCoverage } from "@/lib/procedure-coverage"

interface OverviewRow {
  airport: string
  kind: "arrival" | "departure" | "unknown"
  runway: string | null
  bearing: number | null
  route: string
}

interface FlightRow extends OverviewRow {
  id: string
  needs_check: boolean
  turn_nm: number | null
  established_nm: number | string | null
  alt_profile: Record<string, number> | null
  track: [number, number, number][]
  flags: string[] | null
}

export interface AirportSummary {
  code: string
  flights: number
  arrivalPercent: number
  departurePercent: number
  percent: number
}

const shell = (row: OverviewRow, index: number): FlightAnalysis => ({
  file: String(index),
  kind: row.kind,
  runway: row.runway,
  bearing: row.bearing,
  turnNm: null,
  altAt: {},
  establishedNm: null,
  flags: [],
  route: row.route,
  track: [],
})

/** Every airport that has flights, with its progress, from the light overview (no tracks). */
export async function loadSummaries(supabase: SupabaseClient): Promise<AirportSummary[]> {
  const [overview, marks] = await Promise.all([supabase.rpc("admin_procedure_overview"), supabase.rpc("admin_list_procedure_marks", { p_airport: null })])
  const rows = (overview.data ?? []) as OverviewRow[]
  const markRows = (marks.data ?? []) as { airport: string; key: string }[]
  const byAirport = new Map<string, OverviewRow[]>()
  for (const row of rows) byAirport.set(row.airport, [...(byAirport.get(row.airport) ?? []), row])

  const out: AirportSummary[] = []
  for (const [code, list] of byAirport) {
    const airport = airportFor(code)
    const notNeeded = new Set(markRows.filter((m) => m.airport === code).map((m) => m.key))
    const coverage = airport ? buildCoverage(airport, list.map(shell), notNeeded) : null
    out.push({
      code,
      flights: list.length,
      arrivalPercent: coverage?.arrival.percent ?? 0,
      departurePercent: coverage?.departure.percent ?? 0,
      percent: coverage?.percent ?? 0,
    })
  }
  return out.sort((a, b) => b.flights - a.flights || a.code.localeCompare(b.code))
}

/** The whole rows of one airport, in the shape the analysis and coverage code use (file = the row's id). */
export async function loadAirport(supabase: SupabaseClient, icao: string) {
  const [flights, marks] = await Promise.all([
    supabase.rpc("admin_list_procedure_flights", { p_airport: icao }),
    supabase.rpc("admin_list_procedure_marks", { p_airport: icao }),
  ])
  const analyses: FlightAnalysis[] = ((flights.data ?? []) as FlightRow[]).map((row) => ({
    file: row.id,
    kind: row.kind,
    runway: row.runway,
    bearing: row.bearing,
    turnNm: row.turn_nm,
    altAt: Object.fromEntries(Object.entries(row.alt_profile ?? {}).map(([nm, ft]) => [Number(nm), ft])),
    establishedNm: row.established_nm === null ? null : Number(row.established_nm),
    flags: [...(row.flags ?? []), ...(row.needs_check && !(row.flags ?? []).some((f) => /XX/.test(f)) ? ["runway to check"] : [])],
    route: row.route,
    track: row.track,
  }))
  return {
    flights: analyses,
    notNeeded: new Set(((marks.data ?? []) as { key: string }[]).map((m) => m.key)),
    arrivalGroups: groupFlights(analyses, "arrival"),
    departureGroups: groupFlights(analyses, "departure"),
  }
}

export async function loadSyncState(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("admin_procedure_sync_state")
  const row = ((data ?? []) as { copy_allowed: boolean; last_synced_at: string | null; flights_count: number | null }[])[0]
  return { copyAllowed: row?.copy_allowed === true, lastSyncedAt: row?.last_synced_at ?? null, flightsCount: row?.flights_count ?? null }
}
