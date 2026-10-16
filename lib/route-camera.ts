// The camera behind the featured stage of Explore: a flight drawn on a canvas in three shots that loop.
//   1. Departure: close on the first waypoints (the turns and the climb) while the line is drawn.
//   2. Cruise: pulled back to see the whole flight.
//   3. Arrival: close on the last waypoints (the descent and the final).
// Pure geometry and drawing, no React. The page still ships a static drawing of the whole route in its HTML (what search
// engines, no-JS visitors and the hover state show); this only adds motion on top.
import { isLand } from "@/lib/land"
import { unwrapLongitudes } from "@/lib/route-render"

export interface FlightPoint {
  lat: number
  lng: number
  altitude?: number
}

interface World {
  x: number
  y: number
}

export interface Camera {
  cx: number
  cy: number
  // Pixels per world unit (a world unit is a degree of latitude).
  scale: number
}

export interface Flight {
  world: World[]
  // Cumulative length along the route, in world units.
  cum: number[]
  total: number
  headLen: number
  tailStartLen: number
  // Arc length of the route point nearest to the middle of the overview: where the camera joins the line when it
  // starts following it (the overview's centre is usually beside the route, which arcs).
  overFocusLen: number
  hasZoom: boolean
  // Altitude of each point (feet), and whether the plan has any: without it the line is a single colour.
  alts: number[]
  hasAltitude: boolean
  cams: { over: Camera; dep: Camera; arr: Camera }
  width: number
  height: number
  k: number
}

// The timeline, in seconds.
export const LOOP_SECONDS = 12
// The zoom out of the departure starts before its pan has finished, and the aircraft never stops: its speed is
// continuous from one shot to the next (see `drawn` below).
const T = { depEnd: 3.6, outStart: 3.0, depToOverEnd: 5.0, overEnd: 8.0, overToArrEnd: 9.4, arrEnd: 11.4, fadeStart: 11.5 }
// A flight with nothing to zoom on is simply drawn once, in the overview.
const PLAIN = { drawEnd: 6.5, fadeStart: 8.6 }
export const PLAIN_LOOP_SECONDS = 9

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function nearest(points: World[], x: number, y: number): number {
  let best = 0
  let bestDistance = Infinity
  points.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}

function fit(points: World[], width: number, height: number, pad: number, minSpan: number): Camera {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, minSpan)
  const spanY = Math.max(maxY - minY, minSpan)
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    scale: Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY),
  }
}

export function prepareFlight(
  points: FlightPoint[],
  headN: number,
  tailN: number,
  width: number,
  height: number,
): Flight | null {
  if (points.length < 2 || width < 10 || height < 10) return null
  const route = unwrapLongitudes(points)
  const lats = route.map((p) => p.lat)
  const k = Math.max(0.05, Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180))
  const world = route.map((p) => ({ x: p.lng * k, y: -p.lat }))

  const cum = [0]
  for (let i = 1; i < world.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(world[i].x - world[i - 1].x, world[i].y - world[i - 1].y))
  }
  const total = cum[cum.length - 1] || 1

  const over = fit(world, width, height, Math.min(width, height) * 0.1, 6 * k)
  const head = world.slice(0, Math.max(headN, 2))
  const tail = world.slice(world.length - Math.max(tailN, 2))
  const dep = fit(head, width, height, Math.min(width, height) * 0.16, 1.4)
  const arr = fit(tail, width, height, Math.min(width, height) * 0.16, 1.4)

  // Zooming only makes sense if the close shots really are closer than the overview.
  const hasZoom = headN > 0 && tailN > 0 && dep.scale > over.scale * 1.8 && arr.scale > over.scale * 1.8
  return {
    world,
    cum,
    total,
    headLen: cum[Math.max(headN, 2) - 1] ?? 0,
    tailStartLen: cum[world.length - Math.max(tailN, 2)] ?? total,
    overFocusLen: cum[nearest(world, over.cx, over.cy)] ?? 0,
    hasZoom,
    alts: points.map((p) => p.altitude ?? 0),
    hasAltitude: points.some((p) => (p.altitude ?? 0) > 0),
    cams: { over, dep, arr },
    width,
    height,
    k,
  }
}

// The point of the route at an arc length (and its altitude).
export function pointAt(flight: Flight, until: number): { x: number; y: number; alt: number } {
  const { world, cum, alts } = flight
  for (let i = 1; i < world.length; i++) {
    if (cum[i] >= until) {
      const span = cum[i] - cum[i - 1] || 1
      const f = clamp01((until - cum[i - 1]) / span)
      return {
        x: lerp(world[i - 1].x, world[i].x, f),
        y: lerp(world[i - 1].y, world[i].y, f),
        alt: lerp(alts[i - 1], alts[i], f),
      }
    }
  }
  const end = world[world.length - 1]
  return { x: end.x, y: end.y, alt: alts[alts.length - 1] }
}

// A cubic curve between two times with the speed fixed at both ends.
function hermite(t: number, t0: number, t1: number, p0: number, p1: number, m0: number, m1: number): number {
  const dt = t1 - t0
  const u = clamp01((t - t0) / dt)
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * dt * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * dt * m1
}

function mixCamera(a: Camera, b: Camera, t: number): Camera {
  // Zoom is interpolated in log space, so it feels even; the centre follows the same curve.
  return { cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), scale: Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), t)) }
}

export interface Frame {
  cam: Camera
  // Arc length of the route drawn so far.
  drawn: number
  // Whole picture's opacity (the loop fades out and in).
  alpha: number
  shot: "departure" | "cruise" | "arrival"
  // The airport pills: shown while the flight plays, not on the still overview (hover).
  labels: boolean
}

// The state of the picture at time t (seconds into the loop).
export function frameAt(flight: Flight, time: number): Frame {
  const { cams, total, headLen, tailStartLen, world } = flight
  const t = ((time % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS

  if (!flight.hasZoom) {
    const u = (time % PLAIN_LOOP_SECONDS + PLAIN_LOOP_SECONDS) % PLAIN_LOOP_SECONDS
    return {
      cam: cams.over,
      drawn: total * easeInOutSine(clamp01(u / PLAIN.drawEnd)),
      alpha: u < 0.35 ? u / 0.35 : u > PLAIN.fadeStart ? clamp01(1 - (u - PLAIN.fadeStart) / (PLAIN_LOOP_SECONDS - PLAIN.fadeStart)) : 1,
      shot: "cruise",
      labels: true,
    }
  }

  // Where the line has got to. One curve per stretch (the departure, the cruise, the arrival), each starting at the
  // speed the previous one ended at, so the aircraft takes off from rest, never pauses between two shots, and
  // slows down only on the final.
  const midLen = tailStartLen - headLen
  const tailLen = total - tailStartLen
  // (a speed over three times a stretch's average would make it overshoot)
  const midAverage = midLen / (T.overToArrEnd - T.depEnd)
  // The takeoff ends at a good fraction of the cruise's pace, so when the camera pulls back the aircraft is visibly
  // flying on, not creeping.
  const headAverage = headLen / T.depEnd
  const vHead = Math.min(2.8 * headAverage, Math.max(1.5 * headAverage, 0.5 * midAverage))
  const vTail = (1.5 * tailLen) / (T.arrEnd - T.overToArrEnd)
  let drawn: number
  if (t < T.depEnd) drawn = hermite(t, 0, T.depEnd, 0, headLen, 0, vHead)
  else if (t < T.overToArrEnd) {
    drawn = hermite(t, T.depEnd, T.overToArrEnd, headLen, tailStartLen, Math.min(vHead, 3 * midAverage), Math.min(vTail, 3 * midAverage))
  } else if (t < T.arrEnd) drawn = hermite(t, T.overToArrEnd, T.arrEnd, tailStartLen, total, Math.min(vTail, 3 * midAverage), 0)
  else drawn = total

  // Where the camera is.
  const first = world[0]
  const last = world[world.length - 1]
  let cam: Camera
  let shot: Frame["shot"]
  // Close on the departure: starts centred on the airport and drifts after the aircraft.
  const depCam = (at: number): Camera => {
    const drift = easeInOutSine(clamp01(at / T.depEnd))
    return { cx: lerp(first.x, cams.dep.cx, drift), cy: lerp(first.y, cams.dep.cy, drift), scale: cams.dep.scale }
  }
  if (t < T.outStart) {
    cam = depCam(t)
    shot = "departure"
  } else if (t < T.depToOverEnd) {
    // Out to the whole flight while the aircraft keeps flying: the zoom out begins before the departure's pan is over, and
    // the camera stays on the aircraft while it pulls back, only settling on the overview's centre at the very end
    // (that centre is usually beside the route, which arcs, so crossing straight to it would show empty ground).
    const u = clamp01((t - T.outStart) / (T.depToOverEnd - T.outStart))
    const tip = pointAt(flight, drawn)
    const from = depCam(t)
    const follow = 1 - Math.pow(1 - u, 3)
    const settle = u * u * u
    cam = {
      cx: lerp(lerp(from.cx, tip.x, follow), cams.over.cx, settle),
      cy: lerp(lerp(from.cy, tip.y, follow), cams.over.cy, settle),
      scale: Math.exp(lerp(Math.log(cams.dep.scale), Math.log(cams.over.scale), easeInOutCubic(u))),
    }
    shot = "cruise"
  } else if (t < T.overEnd) {
    cam = cams.over
    shot = "cruise"
  } else if (t < T.overToArrEnd) {
    // Down to the arrival by following the flight plan: the camera glides after the aircraft along the line while it
    // zooms in, instead of cutting straight across to the airport.
    const u = easeInOutCubic((t - T.overEnd) / (T.overToArrEnd - T.overEnd))
    // The camera's centre first joins the line (quickly, while the picture is still wide, so it hardly shows), then
    // slides along it to the aircraft: it never looks at ground beside the route.
    const along = pointAt(flight, lerp(flight.overFocusLen, drawn, u))
    const join = 1 - Math.pow(1 - u, 3)
    cam = {
      cx: lerp(cams.over.cx, along.x, join),
      cy: lerp(cams.over.cy, along.y, join),
      scale: Math.exp(lerp(Math.log(cams.over.scale), Math.log(cams.arr.scale), u)),
    }
    shot = "arrival"
  } else {
    // Close on the arrival: the camera keeps following the aircraft and leans further towards the airport as it
    // gets there, so the end of the line is centred when it lands.
    const e = easeInOutSine(clamp01((t - T.overToArrEnd) / (T.arrEnd - T.overToArrEnd)))
    const tip = pointAt(flight, drawn)
    cam = { cx: lerp(tip.x, last.x, 0.8 * e), cy: lerp(tip.y, last.y, 0.8 * e), scale: cams.arr.scale }
    shot = "arrival"
  }

  let alpha = 1
  if (t < 0.35) alpha = t / 0.35
  else if (t > T.fadeStart) alpha = clamp01(1 - (t - T.fadeStart) / (LOOP_SECONDS - T.fadeStart))
  return { cam, drawn, alpha, shot, labels: true }
}

// The whole flight, fully drawn, in the overview: what hovering shows, and what reduced motion gets.
export function overviewFrame(flight: Flight): Frame {
  return { cam: flight.cams.over, drawn: flight.total, alpha: 1, shot: "cruise", labels: false }
}

export interface Palette {
  ink: string
  // The altitude ramp of the homepage globe, low to high (cyan, blue, violet, magenta).
  ramp: string[]
  background: string
  // The airport pills, like the homepage's: a soft background, a hairline border.
  labelBg: string
  labelBorder: string
}

const RAMP_TOP_FT = 40000

function channels(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

// The ramp colour for an altitude: four evenly spaced stops from 0 to 40,000 ft, as on the globe.
export function rampColor(ramp: string[], feet: number): string {
  const t = clamp01(feet / RAMP_TOP_FT) * (ramp.length - 1)
  const i = Math.min(Math.floor(t), ramp.length - 2)
  const mix = t - i
  const a = channels(ramp[i])
  const b = channels(ramp[i + 1])
  return `rgb(${[0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * mix)).join(",")})`
}

const SPACINGS = [0.25, 0.5, 1, 2, 4] // degrees, finest first

// Draws one frame. Everything is computed from the world each time (the land lattice is anchored to the world, so it
// slides with the camera instead of shimmering).
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  flight: Flight,
  frame: Frame,
  palette: Palette,
  labels: { origin: string; destination: string },
  dpr: number,
) {
  const { width: w, height: h, world, cum, k } = flight
  const { cam } = frame
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.globalAlpha = frame.alpha
  const sx = (x: number) => (x - cam.cx) * cam.scale + w / 2
  const sy = (y: number) => (y - cam.cy) * cam.scale + h / 2

  // --- Ground: the land as dots while the picture is wide, a faint lattice once it is close (the land data
  // is half-degree cells, too coarse to look right up close).
  const overScale = flight.cams.over.scale
  const landAlpha = clamp01((overScale * 4 - cam.scale) / (overScale * 2.5))
  const latMin = -(cam.cy + h / 2 / cam.scale)
  const latMax = -(cam.cy - h / 2 / cam.scale)
  const lngMin = (cam.cx - w / 2 / cam.scale) / k
  const lngMax = (cam.cx + w / 2 / cam.scale) / k

  // One lattice for the whole ground, so every dot has the same size and, at rest, the same colour. The wide shot keeps
  // only the land dots; as the camera closes in, the dots grow and spread, and the sea dots fade in. Neighbouring
  // levels are exact halves of each other (anchored to the world), so changing level only fades in the extra dots:
  // dots are never drawn twice on top of each other (that is what made some look darker and made moiré patterns).
  const wide = 11
  const close = 110
  const spacingPx = wide * Math.pow(close / wide, 1 - landAlpha)
  const size = 2.6 + (1 - landAlpha) * 38
  const base = 0.3
  const u = clamp01(Math.log2(Math.max(spacingPx / cam.scale, SPACINGS[0]) / SPACINGS[0]) / (SPACINGS.length - 1)) * (SPACINGS.length - 1)
  const lower = Math.min(Math.floor(u), SPACINGS.length - 1)
  // The extra dots of the finer level only fade over the last quarter before the level changes, so for most of
  // the zoom every dot has the same opacity.
  const fine = lower + 1 < SPACINGS.length ? 1 - clamp01((u - lower - 0.75) / 0.25) : 1
  const spacing = SPACINGS[lower]
  const seaAlpha = 1 - landAlpha
  // Four groups by opacity: (kept dots | dots of the finer level only) x (land | sea).
  const groups = [
    { shared: true, land: true, alpha: 1 },
    { shared: true, land: false, alpha: seaAlpha },
    { shared: false, land: true, alpha: fine },
    { shared: false, land: false, alpha: fine * seaAlpha },
  ]
  const i0 = Math.floor(latMin / spacing)
  const i1 = Math.ceil(latMax / spacing)
  const j0 = Math.floor(lngMin / spacing)
  const j1 = Math.ceil(lngMax / spacing)
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = size
  ctx.lineCap = "round"
  for (const group of groups) {
    const alpha = group.alpha * base
    if (alpha <= 0.004) continue
    ctx.globalAlpha = frame.alpha * alpha
    ctx.beginPath()
    let count = 0
    for (let i = i0; i <= i1 && count <= 9000; i++) {
      for (let j = j0; j <= j1; j++) {
        if ((((i & 1) === 0 && (j & 1) === 0) || lower + 1 >= SPACINGS.length) !== group.shared) continue
        const lat = i * spacing
        const lng = j * spacing
        if (isLand(lat, lng) !== group.land) continue
        const x = sx(lng * k)
        const y = sy(-lat)
        ctx.moveTo(x, y)
        ctx.lineTo(x, y)
        count++
      }
    }
    ctx.stroke()
  }

  // --- The route: the whole line faintly, the part flown so far in colour (the altitude ramp, as on the homepage globe).
  ctx.globalAlpha = frame.alpha
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  // The whole route, faint, so the viewer sees where it is going.
  ctx.beginPath()
  ctx.moveTo(sx(world[0].x), sy(world[0].y))
  for (let i = 1; i < world.length; i++) ctx.lineTo(sx(world[i].x), sy(world[i].y))
  ctx.strokeStyle = palette.ink
  ctx.globalAlpha = frame.alpha * 0.14
  ctx.lineWidth = 2
  ctx.stroke()

  // The part flown, one segment at a time so each takes the colour of its altitude.
  ctx.globalAlpha = frame.alpha
  ctx.lineWidth = 3.6
  const tip = pointAt(flight, frame.drawn)
  const color = (feet: number) => (flight.hasAltitude ? rampColor(palette.ramp, feet) : palette.ramp[1])
  for (let i = 1; i < world.length && cum[i - 1] < frame.drawn; i++) {
    const reached = cum[i] <= frame.drawn
    const end = reached ? { x: world[i].x, y: world[i].y, alt: flight.alts[i] } : tip
    ctx.beginPath()
    ctx.moveTo(sx(world[i - 1].x), sy(world[i - 1].y))
    ctx.lineTo(sx(end.x), sy(end.y))
    ctx.strokeStyle = color((flight.alts[i - 1] + end.alt) / 2)
    ctx.stroke()
  }

  // --- The airports: a dot in the ramp's blue and a pill with the airport code, like the homepage's.
  const pill = (p: World, label: string, opacity: number) => {
    const x = sx(p.x)
    const y = sy(p.y)
    if (x < -60 || x > w + 60 || y < -60 || y > h + 60) return
    ctx.globalAlpha = frame.alpha
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fillStyle = palette.ramp[1]
    ctx.fill()

    if (opacity <= 0.01) return
    ctx.font = '500 12px ui-monospace, "IBM Plex Mono", SFMono-Regular, monospace'
    const textWidth = ctx.measureText(label).width
    const pw = textWidth + 20
    const ph = 25
    // Above the airport; below it if there is no room above. Kept inside the picture on every side.
    const margin = 6
    const above = y - 20 - ph
    const py = Math.min(
      Math.max((above >= margin ? above : y + 20) + (1 - opacity) * 4, margin),
      h - ph - margin,
    )
    const px = Math.min(Math.max(x - pw / 2, margin), w - pw - margin)
    ctx.globalAlpha = frame.alpha * opacity
    ctx.shadowColor = "rgba(0,0,0,0.12)"
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 1
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, ph / 2)
    ctx.fillStyle = palette.labelBg
    ctx.fill()
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    ctx.lineWidth = 1
    ctx.strokeStyle = palette.labelBorder
    ctx.stroke()
    ctx.fillStyle = palette.ink
    ctx.textBaseline = "middle"
    ctx.fillText(label, px + 10, py + ph / 2 + 0.5)
  }
  // Still overview (hover): the route alone, no airport pills.
  if (frame.labels) {
    pill(world[0], labels.origin, 1)
    // The destination's pill comes in as the line arrives.
    pill(world[world.length - 1], labels.destination, clamp01((frame.drawn / flight.total - 0.9) / 0.1))
  } else {
    pill(world[0], "", 0)
    pill(world[world.length - 1], "", 0)
  }

  // The aircraft is not drawn: the coloured line, growing, is the flight.
  ctx.globalAlpha = 1
}
