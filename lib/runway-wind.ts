// Headwind and crosswind of a wind on a runway, and which runway end the wind favours. Pure functions, no React.
//
// Wind direction and runway heading are both TRUE (METAR wind is degrees true; the runway headings of the airport data are
// true), so they can be compared directly. Gusts are only displayed: the components use the steady wind.

export interface WindInput {
  /** Degrees true the wind blows FROM; null for variable. */
  from: number | null
  speedKt: number
}

export interface Components {
  /** Positive into the wind, negative = tailwind. */
  headwindKt: number
  /** Positive = the wind comes from the right of the runway heading, negative = from the left. */
  crosswindKt: number
}

export interface RunwayEnd {
  name: string
  /** True heading of this end in degrees; null when unknown. */
  headingTrue: number | null
}

export interface RankedEnd extends Components {
  name: string
}

export interface WindAdvice {
  /** Every end with a known heading, best headwind first. Empty when the wind is variable. */
  ranked: RankedEnd[]
  /** The ends within BEST_BAND_KT of the best headwind. Empty in light or variable wind. */
  best: string[]
  /** The one end to pre-select, or null when several are close, parallel runways tie, or the wind is light. */
  pick: string | null
  /** Light or variable wind: any runway works, nothing is marked or chosen. */
  light: boolean
}

// Tunable rules, in one place.
export const LIGHT_WIND_KT = 3 // below this the wind does not decide anything
export const BEST_BAND_KT = 2 // ends this close to the best headwind are "best" too
export const PICK_MARGIN_KT = 3 // the single best end must beat every other heading by this much to be pre-selected
const SAME_HEADING_DEG = 5 // ends with headings this close are parallel (22L, 22R)

const rad = (degrees: number) => (degrees * Math.PI) / 180

export function components(wind: { from: number; speedKt: number }, headingTrue: number): Components {
  const angle = rad(wind.from - headingTrue)
  return { headwindKt: wind.speedKt * Math.cos(angle), crosswindKt: wind.speedKt * Math.sin(angle) }
}

/** The two ends of every runway ["13R", "31L", 128] with a known heading; the second end is the first + 180. */
export function endsOf(names: [string, string, number | null][]): RunwayEnd[] {
  const ends: RunwayEnd[] = []
  for (const [first, second, heading] of names) {
    ends.push({ name: first, headingTrue: heading })
    ends.push({ name: second, headingTrue: heading === null ? null : (heading + 180) % 360 })
  }
  return ends
}

const angleBetween = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

export function adviseRunways(ends: RunwayEnd[], wind: WindInput): WindAdvice {
  if (wind.from === null) return { ranked: [], best: [], pick: null, light: true }
  const from = wind.from
  const headed = ends.filter((end): end is RunwayEnd & { headingTrue: number } => end.headingTrue !== null)
  const ranked = headed
    .map((end) => ({ name: end.name, heading: end.headingTrue, ...components({ from, speedKt: wind.speedKt }, end.headingTrue) }))
    .sort((a, b) => b.headwindKt - a.headwindKt || (a.name < b.name ? -1 : 1))
  const out: RankedEnd[] = ranked.map(({ name, headwindKt, crosswindKt }) => ({ name, headwindKt, crosswindKt }))
  if (wind.speedKt < LIGHT_WIND_KT || ranked.length === 0) return { ranked: out, best: [], pick: null, light: wind.speedKt < LIGHT_WIND_KT }

  const top = ranked[0]
  const best = ranked.filter((end) => end.headwindKt >= top.headwindKt - BEST_BAND_KT)
  // Parallel runways share a heading and tie, so a single "best" end means there is no parallel twin; it must also beat the
  // best end of any other heading by the margin.
  const alone = best.length === 1
  const rival = ranked.find((end) => angleBetween(end.heading, top.heading) > SAME_HEADING_DEG)
  const clear = alone && (!rival || top.headwindKt - rival.headwindKt >= PICK_MARGIN_KT)
  return { ranked: out, best: best.map((end) => end.name), pick: clear ? top.name : null, light: false }
}

// How a runway end looks next to the others, for the colour of its chip: good (green), caution (yellow: not the best
// headwind, or a strong crosswind) or avoid (red: a tailwind). Light or variable wind judges nothing, so no colour.
export type EndTone = "good" | "caution" | "avoid"
export const TAILWIND_AVOID_KT = 2 // a tailwind of this much or more is red
export const CROSSWIND_CAUTION_KT = 15 // this much crosswind is never green

export function endTone(end: { headwindKt: number; crosswindKt: number }, isBest: boolean, light: boolean): EndTone | null {
  if (light) return null
  if (end.headwindKt <= -TAILWIND_AVOID_KT) return "avoid"
  if (Math.abs(end.crosswindKt) >= CROSSWIND_CAUTION_KT) return "caution"
  return isBest ? "good" : "caution"
}
