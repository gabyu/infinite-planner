import "server-only"
// The local folder of flight files behind the procedures preview: reading it, adding to it, and the "not needed" marks.
// Everything here is development only: procedureRoot() is null on a production build and whenever PROCEDURES_DIR is not
// set, and every caller answers 404 then. Nothing is sent anywhere.
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { airportFor, analyzeFlight, flightEnds, parseFlightName, suggestName, readPoints, type FlightAnalysis } from "@/lib/procedure-analysis"

export function procedureRoot(): string | null {
  return process.env.NODE_ENV === "development" && process.env.PROCEDURES_DIR ? process.env.PROCEDURES_DIR : null
}

function kmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n.startsWith(".")) return []
    const full = join(dir, n)
    return statSync(full).isDirectory() ? kmlFiles(full) : /\.kml$/i.test(n) ? [full] : []
  })
}

/** Every flight in the folder, filed under both of its airports (a departure where it left, an arrival where it landed). */
export function loadFlights(root: string): { byAirport: Map<string, FlightAnalysis[]>; unplaced: string[] } {
  const byAirport = new Map<string, FlightAnalysis[]>()
  const unplaced: string[] = []
  for (const file of kmlFiles(root)) {
    const name = file.split("/").pop()!
    const kml = readFileSync(file, "utf8")
    const named = parseFlightName(name)
    const found = flightEnds(kml)
    // The name wins where it says something (the pilot knows the route and the runways); the track fills the rest.
    const origin = named?.origin ?? found.origin
    const destination = named?.destination ?? found.destination
    if (!origin && !destination) unplaced.push(name)
    for (const code of new Set([origin, destination])) {
      const airport = code ? airportFor(code) : null
      if (!code || !airport) continue
      const flight = analyzeFlight(name, kml, airport, code === origin ? named?.originRunway : named?.destinationRunway)
      flight.route = `${origin ?? "?"}-${destination ?? "?"}`
      byAirport.set(code, [...(byAirport.get(code) ?? []), flight])
    }
  }
  return { byAirport, unplaced }
}

// ---- "not needed" marks: _coverage.json, { "LSGG": ["arrival|04|N", ...] } ------------------------------------------
const marksPath = (root: string) => join(root, "_coverage.json")
export function loadNotNeeded(root: string, icao: string): Set<string> {
  try {
    const all = JSON.parse(readFileSync(marksPath(root), "utf8")) as Record<string, string[]>
    return new Set(all[icao] ?? [])
  } catch {
    return new Set()
  }
}
export function setNotNeeded(root: string, icao: string, key: string, notNeeded: boolean) {
  let all: Record<string, string[]> = {}
  try {
    all = JSON.parse(readFileSync(marksPath(root), "utf8"))
  } catch {}
  const set = new Set(all[icao] ?? [])
  if (notNeeded) set.add(key)
  else set.delete(key)
  all[icao] = Array.from(set).sort()
  writeFileSync(marksPath(root), JSON.stringify(all, null, 2))
}

// ---- adding a file ---------------------------------------------------------------------------------------------------
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export type AddResult =
  | { ok: true; name: string; route: string; placed: { airport: string; kind: string; runway: string | null; bearing: number | null }[]; checks: string[] }
  | { ok: false; error: string }

/** Validates a flight file, names it "ORIGIN (RWY) - DEST (RWY).kml", writes it to the folder and records it in _ingested.json. */
export function addFlight(root: string, kml: string, originalName = ""): AddResult {
  if (Buffer.byteLength(kml) > MAX_UPLOAD_BYTES) return { ok: false, error: "The file is too large (limit 8 MB)." }
  if (!/<kml[\s>]/i.test(kml)) return { ok: false, error: "This is not a KML file." }
  if (readPoints(kml).length < 10) return { ok: false, error: "Fewer than 10 track points: not a tracked flight." }
  // The file name's airport codes win ("DAAG-LSGG.kml"): a tracker's track can begin in the air, nowhere near its airport.
  const suggestion = suggestName(kml, parseFlightName(originalName))
  if (!suggestion) return { ok: false, error: "No airport: neither the file name nor the ends of the track point to one. Name it like DAAG-LSGG.kml." }

  const sha256 = createHash("sha256").update(kml).digest("hex")
  const manifestPath = join(root, "_ingested.json")
  let manifest: { note?: string; files: Record<string, unknown>[] } = { files: [] }
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  } catch {}
  const twin = manifest.files.find((f) => f.sha256 === sha256)
  if (twin) return { ok: false, error: `Already in the folder as "${String(twin.path)}".` }

  let name = `${suggestion.base}.kml`
  for (let n = 2; existsSync(join(root, name)); n++) name = `${suggestion.base}_${n}.kml`
  writeFileSync(join(root, name), kml)
  manifest.files.push({
    path: name,
    sha256,
    ingested: new Date().toISOString().slice(0, 10),
    original_name: originalName || undefined,
    source: "uploaded; origin unknown, treated as third-party tracker data",
    trackerDerived: true,
    stored: false,
  })
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  const placed: { airport: string; kind: string; runway: string | null; bearing: number | null }[] = []
  const checks: string[] = []
  for (const code of new Set([suggestion.origin, suggestion.destination])) {
    const airport = code ? airportFor(code) : null
    if (!code || !airport) continue
    const r = analyzeFlight(name, kml, airport)
    r.flags.filter((x) => /already airborne|starts|ends/.test(x)).forEach((x) => checks.push(`${code}: ${x}`))
    placed.push({ airport: code, kind: r.kind, runway: r.runway, bearing: r.bearing })
    if (!r.runway && !checks.some((c) => c.startsWith(`${code}:`))) checks.push(`${code}: runway not told, marked XX in the name`)
  }
  return { ok: true, name, route: suggestion.base, placed, checks }
}
