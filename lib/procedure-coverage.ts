// What an airport still lacks. The grid is: each runway end (08L and 08R are two rows) x arrival or departure x eight directions (where the flight came in from at 40 NM, or where it was heading at
// the top of climb). A cell is covered by one flight or more; a direction nobody flies is marked "not needed" and leaves
// the count. Progress is covered cells over the cells that are needed. Pure functions, no files.
import type { TrimAirport } from "@/lib/ground-trim"
import { runwayEnds } from "@/lib/runway-guide"
import type { FlightAnalysis } from "@/lib/procedure-analysis"
import { isRunwayFlag } from "@/lib/procedure-flags"

export const OCTANTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const
export type Octant = (typeof OCTANTS)[number]
export type CoverageKind = "arrival" | "departure"

export const octantOf = (bearing: number): Octant => OCTANTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]
/** "08L" -> "08". Rows are per runway end now; the family is only read for the "not needed" marks saved when parallel runways were one row. */
export const runwayFamily = (name: string) => name.replace(/[LRC]$/, "")
/** The "done" mark of a kind rides in the same list as the "not needed" cells: "done|arrival". */
export const doneKey = (kind: CoverageKind) => `done|${kind}`
export const cellKey = (kind: CoverageKind, family: string, octant: Octant) => `${kind}|${family}|${octant}`

export interface CoverageCell {
  key: string
  octant: Octant
  /** The files that fill the cell. */
  flights: string[]
  notNeeded: boolean
}

export interface CoverageRow {
  kind: CoverageKind
  family: string
  cells: CoverageCell[]
}

export interface KindProgress {
  needed: number
  covered: number
  percent: number
  /** The person called this kind finished: its empty directions no longer count. */
  done: boolean
}

export interface Coverage {
  rows: CoverageRow[]
  arrival: KindProgress
  departure: KindProgress
  needed: number
  covered: number
  /** Whole percent, 0 when nothing is needed. */
  percent: number
  /** Flights that could not be placed (no runway told, no direction). They count for nothing until fixed. */
  unplaced: string[]
}

export function buildCoverage(airport: TrimAirport, flights: FlightAnalysis[], notNeeded: Set<string>): Coverage {
  // One row per runway end, in runway order (04, 04L, 04R, 22...).
  const families = Array.from(new Set(runwayEnds(airport).map((e) => e.name))).sort()
  const filled = new Map<string, string[]>()
  const unplaced: string[] = []
  for (const f of flights) {
    if ((f.kind !== "arrival" && f.kind !== "departure") || !f.runway || f.bearing === null) {
      const note = f.flags.find((x) => !isRunwayFlag(x))
      unplaced.push(`${f.route ?? f.file.replace(/\.kml$/i, "")}${note ? `: ${note}` : ""}`)
      continue
    }
    const key = cellKey(f.kind, f.runway, octantOf(f.bearing))
    filled.set(key, [...(filled.get(key) ?? []), f.file])
  }
  const rows: CoverageRow[] = []
  const tally = {
    arrival: { needed: 0, covered: 0 },
    departure: { needed: 0, covered: 0 },
  }
  for (const family of families) {
    for (const kind of ["arrival", "departure"] as const) {
      const done = notNeeded.has(doneKey(kind))
      const cells = OCTANTS.map((octant): CoverageCell => {
        const key = cellKey(kind, family, octant)
        const files = filled.get(key) ?? []
        // Marks saved while parallel runways were one row ("arrival|08|N") still apply to each of the two.
        const na = (notNeeded.has(key) || notNeeded.has(cellKey(kind, runwayFamily(family), octant)) || done) && files.length === 0
        if (!na) {
          tally[kind].needed++
          if (files.length > 0) tally[kind].covered++
        }
        return { key, octant, flights: files, notNeeded: na }
      })
      rows.push({ kind, family, cells })
    }
  }
  const progress = (kind: CoverageKind): KindProgress => {
    const { needed, covered } = tally[kind]
    const done = notNeeded.has(doneKey(kind))
    // A kind marked done with nothing in it still reads as finished: the person has said there is nothing more to add.
    return { needed, covered, done, percent: needed === 0 ? (done ? 100 : 0) : Math.round((covered / needed) * 100) }
  }
  const needed = tally.arrival.needed + tally.departure.needed
  const covered = tally.arrival.covered + tally.departure.covered
  const bothDone = notNeeded.has(doneKey("arrival")) && notNeeded.has(doneKey("departure"))
  return {
    rows,
    arrival: progress("arrival"),
    departure: progress("departure"),
    needed,
    covered,
    percent: needed === 0 ? (bothDone ? 100 : 0) : Math.round((covered / needed) * 100),
    unplaced,
  }
}
