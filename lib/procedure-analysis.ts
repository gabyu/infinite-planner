// Reads a tracked flight (KML) and says what it did at one airport: which runway, from which direction it came in or left,
// and how the descent or climb looked. Pure functions, no file access: the script and the dev page read the files.
// Nothing here is stored or shared; a flight is analysed and dropped.
import type { RunwayRow, TrimAirport, TrimPoint } from "@/lib/ground-trim"
import { distanceM, planTrim } from "@/lib/ground-trim"
import { splitPhases } from "@/lib/route-phases"
import { angleBetween, bearingDeg, compassPoint, extractDeparture, findRunwayEnd, runwayEnds, toRunwayFrame, type RunwayEnd } from "@/lib/runway-guide"
import runwaysJson from "@/lib/data/runways.json"

const NM = 1852
const FRAME_RADIUS_NM = 40
const TRACK_RADIUS_NM = 60
const TRACK_MAX_POINTS = 140

const data = runwaysJson as unknown as Record<string, [number | null, number, number, RunwayRow[], unknown[]]>
export function airportFor(icao: string): TrimAirport | null {
  const row = data[icao]
  return row ? { elevationFt: row[0], lat: row[1], lng: row[2], runways: row[3] } : null
}

/** Two tracker layouts: one Placemark per point (altitude in the description, feet), or one gx:Track (metres). */
export function readPoints(kml: string): TrimPoint[] {
  const out: TrimPoint[] = []
  for (const m of kml.matchAll(/<gx:coord>\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/g)) {
    out.push({ lng: Number(m[1]), lat: Number(m[2]), altitude: Math.round(Number(m[3]) * 3.28084) })
  }
  if (out.length > 0) return out
  for (const block of kml.split("<Placemark>").slice(1)) {
    const c = /<Point>[\s\S]*?<coordinates>\s*([-\d.]+),([-\d.]+)/.exec(block)
    if (!c) continue
    const alt = /Altitude:<\/b><\/span>\s*<span>\s*(-?[\d,]+)\s*ft/.exec(block)
    out.push({ lng: Number(c[1]), lat: Number(c[2]), altitude: alt ? Number(alt[1].replace(/,/g, "")) : 0 })
  }
  return out
}

const CODES = Object.keys(data)
const NEAR_M = 6000

/** The nearest airport with runway data within 6 km of a point, or null. */
export function airportNear(point: { lat: number; lng: number }): string | null {
  let best: string | null = null
  let bestM = NEAR_M
  for (const code of CODES) {
    const row = data[code]
    const m = distanceM(point, { lat: row[1], lng: row[2] })
    if (m < bestM) {
      best = code
      bestM = m
    }
  }
  return best
}

/** Where a flight started and ended (ICAO codes, null when no known airport is within 6 km). */
export function flightEnds(kml: string): { origin: string | null; destination: string | null } {
  const points = readPoints(kml)
  if (points.length < 2) return { origin: null, destination: null }
  return { origin: airportNear(points[0]), destination: airportNear(points[points.length - 1]) }
}

/**
 * "LFPG (08L) - LSGG (04).kml": the pilot's own record of the runways, used as given instead of guessed from the track.
 * "(XX)" means the pilot has not checked that runway yet: it is detected from the track and flagged. Without the parentheses ("LFPG-LSGG_2.kml") the airports are still read, the runways are detected. A repeat suffix
 * ("_2") is ignored.
 */
export function parseFlightName(file: string): { origin: string; originRunway: string | null; destination: string; destinationRunway: string | null } | null {
  const m = /^([A-Z]{4})\s*(?:\(\s*(\d{2}[LRC]?|XX)\s*\))?\s*-\s*([A-Z]{4})\s*(?:\(\s*(\d{2}[LRC]?|XX)\s*\))?/i.exec(file.replace(/\.kml$/i, ""))
  if (!m) return null
  return { origin: m[1].toUpperCase(), originRunway: m[2]?.toUpperCase() ?? null, destination: m[3].toUpperCase(), destinationRunway: m[4]?.toUpperCase() ?? null }
}

export type FlightKind = "arrival" | "departure" | "unknown"

export interface FlightAnalysis {
  file: string
  kind: FlightKind
  runway: string | null
  /** Arrival: bearing from the runway to where the flight crossed 40 NM. Departure: bearing to the top of climb. */
  bearing: number | null
  /** Top of descent (arrival) or top of climb (departure), NM from the runway. */
  turnNm: number | null
  /** Arrival only: altitude in feet at 30, 20, 15, 10 and 5 NM. */
  altAt: Record<number, number | null>
  /** Arrival only: distance from which the flight stays on the extended centreline. */
  establishedNm: number | null
  flags: string[]
  /** "LFPG-LSGG": set by the caller, so a flight listed under one airport still says where its other end is. */
  route?: string
  /** The part within 60 NM of the airport, thinned: [lat, lng, feet]. */
  track: [number, number, number][]
}

function thin(points: TrimPoint[], airport: TrimAirport): [number, number, number][] {
  const near = points.filter((p) => distanceM(airport, p) / NM <= TRACK_RADIUS_NM)
  const step = Math.max(1, Math.ceil(near.length / TRACK_MAX_POINTS))
  return near.filter((_, i) => i % step === 0 || i === near.length - 1).map((p) => [p.lat, p.lng, p.altitude])
}

const altitudeAt = (framed: { nm: number; alt: number }[], nm: number): number | null => {
  const hit = framed.find((p) => p.nm <= nm)
  return hit ? Math.round(hit.alt / 100) * 100 : null
}

/** `assignedRunway` is the runway the pilot named for this airport ("08L"): used as given, and a disagreeing track is flagged. */
export function analyzeFlight(file: string, kml: string, airport: TrimAirport, assignedRunway?: string | null): FlightAnalysis {
  const points = readPoints(kml)
  const flags: string[] = []
  if (assignedRunway?.toUpperCase() === "XX") {
    flags.push("runway marked XX: check it")
    assignedRunway = null
  }
  const result: FlightAnalysis = { file, kind: "unknown", runway: null, bearing: null, turnNm: null, altAt: {}, establishedNm: null, flags, track: [] }
  if (points.length < 10) {
    flags.push("too few points")
    return result
  }
  result.track = thin(points, airport)

  // A flight that starts at this airport is a departure, whatever folder it sits in.
  if (distanceM(points[0], airport) < 5 * NM && distanceM(points[points.length - 1], airport) > 20 * NM) {
    result.kind = "departure"
    const dep = extractDeparture(points, airport, splitPhases(points), assignedRunway ?? undefined)
    if (dep && assignedRunway) {
      const detected = extractDeparture(points, airport, splitPhases(points))
      if (detected?.runwayEnd && detected.runwayEnd !== assignedRunway) flags.push(`named ${assignedRunway}, the track says ${detected.runwayEnd}`)
    }
    if (!dep) {
      flags.push("too short to analyse")
      return result
    }
    result.runway = dep.runwayEnd
    result.bearing = dep.tocBearing
    result.turnNm = dep.tocDistanceNm
    flags.push(...dep.reasons)
    return result
  }

  // A track can begin in the air (a tracker only picks the flight up after take-off) or end before landing.
  const startNm = distanceM(points[0], airport) / NM
  const endNm = distanceM(points[points.length - 1], airport) / NM
  if (startNm >= 5 && endNm >= 5) {
    flags.push(`the track starts ${Math.round(startNm)} NM away, already airborne: no departure to read here`)
    return result
  }

  const trim = planTrim(points, airport, "arrival")
  if (trim.approximate) flags.push("runway not matched by the ground trim")
  const air = points.slice(0, points.length - trim.remove.length)

  const last = air[air.length - 1]
  const track = bearingDeg(air[Math.max(0, air.length - 6)], last)
  let end: RunwayEnd | null = null
  let off = 999
  for (const candidate of runwayEnds(airport)) {
    const a = angleBetween(candidate.headingTrue, track)
    if (a < off && distanceM(candidate, last) < 4000) {
      off = a
      end = candidate
    }
  }
  if (assignedRunway) {
    const named = findRunwayEnd(airport, assignedRunway)
    if (!named) flags.push(`${assignedRunway} is not a runway of this airport`)
    else {
      if (end && off <= 25 && end.name !== named.name) flags.push(`named ${assignedRunway}, the track says ${end.name}`)
      end = named
    }
  }
  if (!end || (!assignedRunway && off > 25)) {
    flags.push("landing runway not told")
    return result
  }
  result.kind = "arrival"
  result.runway = end.name

  result.turnNm = Math.round(distanceM(end, air[splitPhases(air).arrivalStart]) / NM)
  const inside = air.filter((p) => distanceM(end!, p) / NM <= FRAME_RADIUS_NM)
  if (inside.length === 0) {
    flags.push("never within 40 NM of the runway")
    return result
  }
  result.bearing = Math.round(bearingDeg(end, inside[0]))
  const framed = inside.map((p) => ({ nm: distanceM(end!, p) / NM, alt: p.altitude, across: toRunwayFrame({ ...p }, end!).across }))
  for (const nm of [30, 20, 15, 10, 5]) result.altAt[nm] = altitudeAt(framed, nm)
  let established: number | null = null
  for (let i = framed.length - 1; i >= 0; i--) {
    if (Math.abs(framed[i].across) > 0.3 * NM) break
    established = framed[i].nm
  }
  result.establishedNm = established === null ? null : Math.round(established * 10) / 10
  if (established !== null && established < 4) flags.push("short final (under 4 NM)")
  if (result.turnNm > 200) flags.push("top of descent very far (step descents?)")
  return result
}

// ---- grouping ---------------------------------------------------------------------------------------------------------
export interface FlightGroup {
  id: string
  kind: "arrival" | "departure"
  /** Circular mean of the members' bearings, whole degrees. */
  bearing: number
  label: string
  members: string[]
}

/** Groups by real bearing: sorted around the circle, a gap wider than `gapDeg` starts a new group. No fixed compass sectors. */
export function groupFlights(flights: FlightAnalysis[], kind: "arrival" | "departure", gapDeg = 25): FlightGroup[] {
  const items = flights.filter((f) => f.kind === kind && f.bearing !== null).sort((a, b) => a.bearing! - b.bearing!)
  if (items.length === 0) return []
  // Start after the widest gap so a group straddling north is not cut in two.
  let start = 0
  let widest = -1
  items.forEach((f, i) => {
    const prev = items[(i + items.length - 1) % items.length]
    const gap = (f.bearing! - prev.bearing! + 360) % 360 || (items.length === 1 ? 360 : 0)
    if (gap > widest) {
      widest = gap
      start = i
    }
  })
  const ordered = [...items.slice(start), ...items.slice(0, start)]
  const clusters: FlightAnalysis[][] = []
  ordered.forEach((f, i) => {
    if (i > 0 && angleBetween(f.bearing!, ordered[i - 1].bearing!) <= gapDeg) clusters[clusters.length - 1].push(f)
    else clusters.push([f])
  })
  return clusters.map((members, index) => {
    const x = members.reduce((s, f) => s + Math.cos((f.bearing! * Math.PI) / 180), 0)
    const y = members.reduce((s, f) => s + Math.sin((f.bearing! * Math.PI) / 180), 0)
    const mean = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
    return { id: `${kind[0]}${index + 1}`, kind, bearing: mean, label: compassPoint(mean), members: members.map((f) => f.file) }
  })
}

/**
 * The name a flight file should have: "LFPG (08L) - LSGG (04)". A runway the track could not tell becomes "XX", so the
 * person knows to check it. Null when neither end is a known airport.
 */
export function suggestName(
  kml: string,
  named?: ReturnType<typeof parseFlightName>,
): { base: string; origin: string | null; destination: string | null } | null {
  const found = flightEnds(kml)
  const origin = named?.origin ?? found.origin
  const destination = named?.destination ?? found.destination
  if (!origin && !destination) return null
  const runway = (code: string | null, given: string | null | undefined) => {
    if (given && given !== "XX") return given
    const airport = code ? airportFor(code) : null
    if (!airport) return "XX"
    const r = analyzeFlight("", kml, airport)
    return r.runway && r.flags.every((x) => !/runway|line-up/.test(x)) ? r.runway : "XX"
  }
  return {
    base: `${origin ?? "????"} (${runway(origin, named?.originRunway)}) - ${destination ?? "????"} (${runway(destination, named?.destinationRunway)})`,
    origin,
    destination,
  }
}
