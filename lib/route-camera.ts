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
  hasZoom: boolean
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
    hasZoom,
    cams: { over, dep, arr },
    width,
    height,
    k,
  }
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
    cam = mixCamera(cams.over, cams.arr, easeInOutCubic((t - T.overEnd) / (T.overToArrEnd - T.overEnd)))
    shot = "arrival"
  } else {
    // Close on the arrival: the camera settles on the runway end.
    const settle = 0.6 * easeInOutSine(clamp01((t - T.overToArrEnd) / (T.arrEnd - T.overToArrEnd)))
    cam = { cx: lerp(cams.arr.cx, last.x, settle), cy: lerp(cams.arr.cy, last.y, settle), scale: cams.arr.scale }
    shot = "arrival"
  }

  let alpha = 1
  if (t < 0.35) alpha = t / 0.35
  else if (t > T.fadeStart) alpha = clamp01(1 - (t - T.fadeStart) / (LOOP_SECONDS - T.fadeStart))
  return { cam, drawn, alpha, shot }
}

// The whole flight, fully drawn, in the overview: what hovering shows, and what reduced motion gets.
export function overviewFrame(flight: Flight): Frame {
  return { cam: flight.cams.over, drawn: flight.total, alpha: 1, shot: "cruise" }
}

export interface Palette {
  ink: string
  accent: string
  background: string
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
    // The closer the shot, the bigger the dots: they grow from the overview's size to more than double it, so the ground
    // still reads as a texture when the camera is on the climb or the final.
    const dot = 2.6 + (1 - landAlpha) * 4.2
    lattice(SPACINGS[lower], null, a * (1 - mix), dot)
    if (lower + 1 < SPACINGS.length) lattice(SPACINGS[lower + 1], null, a * mix, dot)
  }

  // --- The route: the whole line faintly, the part flown so far in full.
  ctx.globalAlpha = frame.alpha
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  const trace = (until: number) => {
    ctx.beginPath()
    ctx.moveTo(sx(world[0].x), sy(world[0].y))
    let tip = { x: world[0].x, y: world[0].y }
    for (let i = 1; i < world.length; i++) {
      if (cum[i] <= until) {
        ctx.lineTo(sx(world[i].x), sy(world[i].y))
        tip = world[i]
      } else {
        const span = cum[i] - cum[i - 1] || 1
        const f = clamp01((until - cum[i - 1]) / span)
        tip = { x: lerp(world[i - 1].x, world[i].x, f), y: lerp(world[i - 1].y, world[i].y, f) }
        ctx.lineTo(sx(tip.x), sy(tip.y))
        break
      }
    }
    return tip
  }
  ctx.strokeStyle = palette.ink
  ctx.globalAlpha = frame.alpha * 0.16
  ctx.lineWidth = 2
  trace(flight.total)
  ctx.stroke()
  ctx.globalAlpha = frame.alpha
  ctx.lineWidth = 3.2
  const tip = trace(frame.drawn)
  ctx.stroke()

  // --- The airports, and the aircraft at the tip of the line.
  const marker = (p: World, label: string, filled: boolean) => {
    const x = sx(p.x)
    const y = sy(p.y)
    if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return
    ctx.beginPath()
    ctx.arc(x, y, 5.5, 0, Math.PI * 2)
    ctx.fillStyle = filled ? palette.ink : palette.background
    ctx.fill()
    ctx.lineWidth = 2.4
    ctx.strokeStyle = palette.ink
    ctx.stroke()
    ctx.font = '600 12px ui-monospace, "IBM Plex Mono", monospace'
    ctx.fillStyle = palette.ink
    ctx.globalAlpha = frame.alpha * 0.75
    ctx.fillText(label, x + 11, y - 9)
    ctx.globalAlpha = frame.alpha
  }
  marker(world[0], labels.origin, false)
  if (frame.drawn >= flight.total - 1e-6) marker(world[world.length - 1], labels.destination, true)
  else marker(world[world.length - 1], labels.destination, true)

  if (frame.drawn < flight.total - 1e-6) {
    const x = sx(tip.x)
    const y = sy(tip.y)
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fillStyle = palette.accent
    ctx.globalAlpha = frame.alpha * 0.22
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 4.6, 0, Math.PI * 2)
    ctx.globalAlpha = frame.alpha
    ctx.fillStyle = palette.accent
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
