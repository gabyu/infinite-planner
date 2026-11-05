import "server-only"
// From one flight file to the rows the database keeps. The file is analysed in memory and dropped: what is kept is the
// light track (at most 140 points of [lat, lng, feet] within 60 NM of the airport) and the numbers read from it. No flight
// number, registration, time or photo ever reaches a row. Pure apart from the hash, so it runs on any server.
import { createHash } from "node:crypto"
import { airportFor, analyzeFlight, parseFlightName, readPoints, suggestName, type FlightAnalysis } from "@/lib/procedure-analysis"

export const MAX_FILE_BYTES = 8 * 1024 * 1024

export interface ProcedureRow {
  airport: string
  kind: "arrival" | "departure" | "unknown"
  runway: string | null
  needs_check: boolean
  route: string
  bearing: number | null
  turn_nm: number | null
  established_nm: number | null
  alt_profile: Record<string, number>
  track: [number, number, number][]
  flags: string[]
  content_hash: string
}

export interface Placed {
  airport: string
  kind: string
  runway: string | null
  bearing: number | null
}

export type IngestResult =
  | { ok: true; route: string; rows: ProcedureRow[]; placed: Placed[]; checks: string[] }
  | { ok: false; error: string }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

function toRow(f: FlightAnalysis, airport: string, route: string, hash: string, markedXX: boolean): ProcedureRow | null {
  if (f.track.length < 2) return null
  const altProfile: Record<string, number> = {}
  for (const [nm, ft] of Object.entries(f.altAt)) if (typeof ft === "number") altProfile[nm] = clamp(Math.round(ft), -1000, 60000)
  return {
    airport,
    kind: f.kind,
    runway: f.runway,
    needs_check: markedXX || (f.kind !== "unknown" && !f.runway),
    route,
    bearing: f.bearing === null ? null : clamp(Math.round(f.bearing), 0, 359),
    turn_nm: f.turnNm === null ? null : clamp(Math.round(f.turnNm), 0, 2000),
    established_nm: f.establishedNm === null ? null : clamp(Math.round(f.establishedNm * 10) / 10, 0, 99.9),
    alt_profile: altProfile,
    track: f.track.map(([lat, lng, ft]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, clamp(Math.round(ft), -1000, 60000)]),
    flags: f.flags.slice(0, 10).map((x) => x.slice(0, 120)),
    content_hash: hash,
  }
}

/** `originalName` is the name the file had when it was chosen: its airport codes win ("DAAG-LSGG.kml"), its runways too. */
export function ingestKml(kml: string, originalName: string): IngestResult {
  if (Buffer.byteLength(kml) > MAX_FILE_BYTES) return { ok: false, error: "The file is too large (limit 8 MB)." }
  if (!/<kml[\s>]/i.test(kml)) return { ok: false, error: "This is not a KML file." }
  if (readPoints(kml).length < 10) return { ok: false, error: "Fewer than 10 track points: not a tracked flight." }

  const named = parseFlightName(originalName)
  const suggestion = suggestName(kml, named)
  if (!suggestion) return { ok: false, error: "No airport: neither the file name nor the ends of the track point to one. Name it like DAAG-LSGG.kml." }

  const route = `${suggestion.origin ?? "????"}-${suggestion.destination ?? "????"}`
  const hash = createHash("sha256").update(kml).digest("hex")
  const rows: ProcedureRow[] = []
  const placed: Placed[] = []
  const checks: string[] = []
  for (const code of new Set([suggestion.origin, suggestion.destination])) {
    const airport = code ? airportFor(code) : null
    if (!code || !airport) continue
    const given = code === suggestion.origin ? named?.originRunway : named?.destinationRunway
    const analysis = analyzeFlight(route, kml, airport, given)
    const row = toRow(analysis, code, route, hash, given?.toUpperCase() === "XX")
    if (!row) continue
    rows.push(row)
    placed.push({ airport: code, kind: row.kind, runway: row.runway, bearing: row.bearing })
    const note = analysis.flags.find((x) => !/marked XX/.test(x)) ?? (row.needs_check ? "runway to check" : null)
    if (note && (row.needs_check || row.kind === "unknown")) checks.push(`${code}: ${note}`)
  }
  if (rows.length === 0) return { ok: false, error: "Neither airport of this flight has runway data yet." }
  return { ok: true, route, rows, placed, checks }
}
