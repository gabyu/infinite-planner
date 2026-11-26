// "Export without arrival": which waypoints of the airborne arrival are left out of the downloaded .fpl, so the pilot
// can add the STAR and approach inside Infinite Flight. Pure functions, no React; the plan itself is never changed.
//
// The file keeps the route up to the cut point, then resumes at the first arrival ground waypoint (the destination
// itself when there are none). Ground movements are only ever removed by the editor's own switch (lib/ground-trim.ts).
import { applyBrandingOverlay, type Brandable } from "@/lib/branding"
import { distanceM, planTrim, type TrimAirport } from "@/lib/ground-trim"
import { cruiseLevels, LEVEL_BAND_FT, splitPhases, type PhasePoint } from "@/lib/route-phases"

/** A level stretch this long counts as cruise: shorter ones are level-offs in the descent. */
export const CRUISE_LEVEL_MIN_NM = 40
/** Without usable altitudes, the cut is the last waypoint at least this far from the destination, along the route. */
export const FALLBACK_DISTANCE_NM = 120
/** localStorage key of the toggle. */
export const WITHOUT_ARRIVAL_KEY = "infinite-planner:export-without-arrival"
// A short route cannot hold a 40 NM level: a tenth of it is enough there.
const CRUISE_LEVEL_MIN_SHARE = 0.1
const MIN_USABLE_POINTS = 3
const NM_M = 1852

export interface ArrivalCutOptions {
  /** The first and last waypoint that may be the cut point. */
  min: number
  max: number
  defaultIndex: number
  /** The altitudes could not tell where the descent starts: the default comes from the distance. */
  estimated: boolean
  /** Where the file resumes: the first arrival ground waypoint. */
  resumeAt: number
}

/** Waypoints `after + 1 .. resumeAt - 1` are left out. */
export interface ArrivalCut {
  after: number
  resumeAt: number
}

function distancesAlong(points: PhasePoint[]): number[] {
  const along = points.length > 0 ? [0] : []
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distanceM(points[i - 1], points[i]))
  return along
}

/**
 * The index of the last waypoint of the last cruise level, from the altitudes alone, so step climbs and step downs in
 * cruise don't matter. Null when the altitudes can't tell: too few of them, all about the same, or no descent after.
 */
export function topOfDescent(points: PhasePoint[]): number | null {
  const along = distancesAlong(points)
  // 0 means "no altitude" (a dragged or inserted waypoint).
  const usable = points
    .map((point, index) => ({ altitude: point.altitude, along: along[index], index }))
    .filter((point) => point.altitude > 0)
  if (usable.length < MIN_USABLE_POINTS) return null
  const altitudes = usable.map((point) => point.altitude)
  const top = Math.max(...altitudes)
  if (top - Math.min(...altitudes) < LEVEL_BAND_FT) return null

  const level = cruiseLevels(
    altitudes,
    usable.map((point) => point.along),
    Math.min(CRUISE_LEVEL_MIN_NM * NM_M, along[along.length - 1] * CRUISE_LEVEL_MIN_SHARE),
  )
  let at = level ? level.last : -1
  // No level stretch at all: the last point near the highest altitude.
  if (!level) altitudes.forEach((altitude, i) => altitude >= top - LEVEL_BAND_FT && (at = i))

  const below = usable[at].altitude - LEVEL_BAND_FT
  return usable.slice(at + 1).some((point) => point.altitude < below) ? usable[at].index : null
}

/** Stands in when the destination's runway data is unavailable, as for the ground movements switch. */
export function fallbackAirport(points: PhasePoint[]): TrimAirport {
  const end = points[points.length - 1]
  return { elevationFt: null, lat: end?.lat ?? 0, lng: end?.lng ?? 0, runways: [] }
}

/** The first arrival ground waypoint (the touchdown point), or the destination when there is no ground movement. */
export function arrivalGroundStart(points: PhasePoint[], airport: TrimAirport): number {
  // planTrim lists what comes after the touchdown point.
  const { remove } = planTrim(points, airport, "arrival")
  return remove.length > 0 ? Math.min(...remove) - 1 : points.length - 1
}

/** Where the plan can be cut, and where it is cut by default. Null when there is no arrival to leave out. */
export function arrivalCutOptions(points: PhasePoint[], airport: TrimAirport): ArrivalCutOptions | null {
  if (points.length < 3) return null
  const resumeAt = arrivalGroundStart(points, airport)
  // The departure is always kept.
  const min = Math.max(splitPhases(points).departureEnd, 1)
  const max = resumeAt - 1
  if (max < min) return null

  const top = topOfDescent(points)
  let cut: number
  if (top !== null) {
    cut = top + 1 < resumeAt ? top + 1 : top
  } else {
    const along = distancesAlong(points)
    const total = along[along.length - 1]
    cut = min
    for (let i = min; i < resumeAt; i++) if (total - along[i] >= FALLBACK_DISTANCE_NM * NM_M) cut = i
  }
  return { min, max, defaultIndex: Math.min(Math.max(cut, min), max), estimated: top === null, resumeAt }
}

/** The pilot's own cut point while it is still possible, else the default. */
export function resolveCut(options: ArrivalCutOptions, picked: number | null): { index: number; estimated: boolean } {
  if (picked !== null && picked >= options.min && picked <= options.max) return { index: picked, estimated: false }
  return { index: options.defaultIndex, estimated: options.estimated }
}

/** Splits a plan into what goes in the file and what is left out. A departure cut would fit the same shape. */
export function trimRoute<T extends PhasePoint>(
  points: T[],
  cuts: { arrival?: ArrivalCut },
): { kept: T[]; removed: T[]; distanceToDestinationNm: number } {
  const cut = cuts.arrival
  if (!cut) return { kept: points, removed: [], distanceToDestinationNm: 0 }
  const along = distancesAlong(points)
  return {
    kept: [...points.slice(0, cut.after + 1), ...points.slice(cut.resumeAt)],
    removed: points.slice(cut.after + 1, cut.resumeAt),
    distanceToDestinationNm: (along[along.length - 1] - along[cut.after]) / NM_M,
  }
}

/** The waypoints of the downloaded file. Branding goes on the last four before the destination of what is exported. */
export function buildExportWaypoints<T extends PhasePoint & Brandable>(
  waypoints: T[],
  { includeBranding, arrival }: { includeBranding: boolean; arrival?: ArrivalCut },
): T[] {
  // The overlay first gives every renamed waypoint its own name back, so names never stay where the block moved from.
  return applyBrandingOverlay(trimRoute(waypoints, { arrival }).kept, includeBranding)
}

/** Whether the toggle was left on in this browser. Off when storage is unavailable. */
export function loadWithoutArrival(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(WITHOUT_ARRIVAL_KEY) === "1"
  } catch {
    return false
  }
}
