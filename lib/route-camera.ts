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
const T = { depEnd: 3.6, depToOverEnd: 5.0, overEnd: 8.0, overToArrEnd: 9.4, arrEnd: 11.4, fadeStart: 11.5 }
// A flight with nothing to zoom on is simply drawn once, in the overview.
const PLAIN = { drawEnd: 6.5, fadeStart: 8.6 }
export const PLAIN_LOOP_SECONDS = 9

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2)
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

  // Where the line has got to.
  let drawn: number
  if (t < T.depEnd) drawn = headLen * easeInOutSine(t / T.depEnd)
  else if (t < T.overToArrEnd) drawn = lerp(headLen, tailStartLen, easeInOutSine((t - T.depEnd) / (T.overToArrEnd - T.depEnd)))
  else if (t < T.arrEnd) drawn = lerp(tailStartLen, total, easeOutSine((t - T.overToArrEnd) / (T.arrEnd - T.overToArrEnd)))
  else drawn = total

  // Where the camera is.
  const first = world[0]
  const last = world[world.length - 1]
  let cam: Camera
  let shot: Frame["shot"]
  if (t < T.depEnd) {
    // Close on the departure: starts centred on the airport and drifts after the aircraft.
    const drift = easeInOutSine(t / T.depEnd)
    cam = { cx: lerp(first.x, cams.dep.cx, drift), cy: lerp(first.y, cams.dep.cy, drift), scale: cams.dep.scale }
    shot = "departure"
  } else if (t < T.depToOverEnd) {
    cam = mixCamera(cams.dep, cams.over, easeInOutCubic((t - T.depEnd) / (T.depToOverEnd - T.depEnd)))
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

  const lattice = (spacing: number, test: ((lat: number, lng: number) => boolean) | null, alpha: number, size: number) => {
    if (alpha <= 0.01) return
    ctx.globalAlpha = frame.alpha * alpha
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = size
    ctx.lineCap = "round"
    ctx.beginPath()
    const lat0 = Math.floor(latMin / spacing) * spacing
    const lng0 = Math.floor(lngMin / spacing) * spacing
    let count = 0
    for (let lat = lat0; lat <= latMax; lat += spacing) {
      for (let lng = lng0; lng <= lngMax; lng += spacing) {
        if (test && !test(lat, lng)) continue
        const x = sx(lng * k)
        const y = sy(-lat)
        ctx.moveTo(x, y)
        ctx.lineTo(x, y)
        if (++count > 9000) break
      }
    }
    ctx.stroke()
  }

  if (landAlpha > 0.01) {
    // Spacing so that dots sit about 11 px apart, blended between the two nearest lattices.
    const target = 11 / cam.scale
    const u = clamp01(Math.log2(Math.max(target, SPACINGS[0]) / SPACINGS[0]) / (SPACINGS.length - 1)) * (SPACINGS.length - 1)
    const lower = Math.min(Math.floor(u), SPACINGS.length - 1)
    const mix = u - lower
    lattice(SPACINGS[lower], isLand, landAlpha * 0.3 * (1 - mix), 2.6)
    if (lower + 1 < SPACINGS.length) lattice(SPACINGS[lower + 1], isLand, landAlpha * 0.3 * mix, 2.6)
  }
  if (landAlpha < 0.99) {
    // The close lattice: about 34 px apart, anchored to the world.
    const target = 34 / cam.scale
    const u = clamp01(Math.log2(Math.max(target, SPACINGS[0]) / SPACINGS[0]) / (SPACINGS.length - 1)) * (SPACINGS.length - 1)
    const lower = Math.min(Math.floor(u), SPACINGS.length - 1)
    const mix = u - lower
    const a = (1 - landAlpha) * 0.38
    // The closer the shot, the bigger the dots: they grow from the overview's size to more than four times it, so the
    // ground still reads as a texture when the camera is on the climb or the final.
    const dot = 2.6 + (1 - landAlpha) * 9.2
    lattice(SPACINGS[lower], null, a * (1 - mix), dot)
    if (lower + 1 < SPACINGS.length) lattice(SPACINGS[lower + 1], null, a * mix, dot)
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
    const px = x - pw / 2
    const py = y - 20 - ph + (1 - opacity) * 4
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
