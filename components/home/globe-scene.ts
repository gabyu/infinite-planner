import * as THREE from "three"
import { ALTITUDE_RAMP, RAMP_MAX_FT } from "./altitude-ramp"
import { LAND_BITMAP, LAND_HEIGHT, LAND_WIDTH } from "@/lib/data/globe-land"

// The homepage globe: a dotted Earth, one arc per recent flight. No React in here; flight-globe.tsx
// owns the DOM (list, callout) and drives this through the returned handle.
//
// Motion is deliberate, not ambient: the globe turns to bring the active flight to the front, the arc
// draws from origin to destination once (that is the "this one was just prepared" signal), the others
// rest quietly. Between activations it keeps drifting slowly.

export interface SceneFlight {
  /** [lat, lng, altitude in feet] per waypoint, departure first. */
  path: [number, number, number][]
}

export interface GlobeHandle {
  /** Bring flight `index` to the front and (re)draw its arc. `instant` skips all motion. */
  focus(index: number, opts?: { instant?: boolean }): void
  /** Screen positions (px, relative to the canvas) of the active flight's two airports; null while on the far side. */
  anchors(): { origin: { x: number; y: number } | null; destination: { x: number; y: number } | null }
  setDark(dark: boolean): void
  setPaused(paused: boolean): void
  dispose(): void
}

const DEG = Math.PI / 180
const TAU = Math.PI * 2

const TUBE_SEGMENTS = 360
export const ARC_DRAW_MS = 3400
export const ARC_DELAY_MS = 350
const TURN_MS = 1900
const DRIFT_RAD_PER_S = 0.035

const PALETTE = {
  light: { dots: "#4a5366", dotAlpha: 0.5, arcHot: "#bcd4ff" },
  dark: { dots: "#b4bfd6", dotAlpha: 0.62, arcHot: "#e6efff" },
}

function latLngToVec(lat: number, lng: number, radius = 1) {
  const la = lat * DEG
  const lo = lng * DEG
  return new THREE.Vector3(radius * Math.cos(la) * Math.sin(lo), radius * Math.sin(la), radius * Math.cos(la) * Math.cos(lo))
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

let landBits: Uint8Array | null = null
function isLand(lat: number, lng: number) {
  if (!landBits) landBits = Uint8Array.from(atob(LAND_BITMAP), (c) => c.charCodeAt(0))
  const x = Math.min(LAND_WIDTH - 1, Math.floor(((lng + 180) / 360) * LAND_WIDTH))
  const y = Math.min(LAND_HEIGHT - 1, Math.floor(((90 - lat) / 180) * LAND_HEIGHT))
  const i = y * LAND_WIDTH + x
  return (landBits[i >> 3] & (1 << (i & 7))) !== 0
}

// Evenly spread points on a sphere (Fibonacci lattice), kept where there is land.
function landPoints(count: number) {
  const out: number[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const lat = Math.asin(y) / DEG
    const lng = Math.atan2(x, z) / DEG
    if (isLand(lat, lng)) out.push(x, y, z)
  }
  return new Float32Array(out)
}

// The route as it was generated: every waypoint on the sphere, lifted by its altitude so the climb,
// cruise and descent show.
// Consecutive waypoints on the same spot (taxi and holding points, rounding) would make the spline divide by
// zero and turn part of the route into NaN, which stops the line from drawing. Keep one of each.
function dedupe(path: [number, number, number][]) {
  const out: [number, number, number][] = []
  for (const p of path) {
    const last = out[out.length - 1]
    if (last && Math.abs(p[0] - last[0]) < 0.005 && Math.abs(p[1] - last[1]) < 0.005) {
      last[2] = Math.max(last[2], p[2])
      continue
    }
    out.push([p[0], p[1], p[2]])
  }
  return out
}

function pathCurve(path: [number, number, number][]) {
  // Between two waypoints that are far apart, a straight line cuts through the planet and the Earth hides
  // it: the route seems to vanish mid-flight. So follow the surface instead: add a point about every 1 degree
  // along the great circle between consecutive waypoints, with the altitude blended in.
  const MAX_STEP = 0.0175
  const units = path.map(([lat, lng, alt]) => ({ v: latLngToVec(lat, lng), alt }))
  const points: THREE.Vector3[] = []
  const alts: number[] = []
  const lift = (alt: number) => 1.004 + (Math.min(Math.max(alt, 0), 45000) / 45000) * 0.035
  units.forEach((p, i) => {
    if (i === 0) {
      points.push(p.v.clone().multiplyScalar(lift(p.alt)))
      alts.push(p.alt)
      return
    }
    const prev = units[i - 1]
    const steps = Math.max(1, Math.ceil(prev.v.angleTo(p.v) / MAX_STEP))
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      const alt = prev.alt + (p.alt - prev.alt) * t
      points.push(prev.v.clone().lerp(p.v, t).normalize().multiplyScalar(lift(alt)))
      alts.push(alt)
    }
  })
  return { curve: new THREE.CatmullRomCurve3(points, false, "centripetal"), alts }
}

const DOT_VERT = /* glsl */ `
  uniform float uDot;
  uniform float uScale;
  varying float vFacing;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * position);
    vFacing = dot(n, normalize(cameraPosition - wp.xyz));
    vec4 mv = viewMatrix * wp;
    gl_PointSize = max(1.0, uDot * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vFacing;
  void main() {
    if (vFacing < 0.02) discard;
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.3, d);
    float limb = smoothstep(0.02, 0.45, vFacing);
    gl_FragColor = vec4(uColor, a * limb * uAlpha);
  }
`

const ARC_VERT = /* glsl */ `
  attribute float alt;
  varying vec2 vUv;
  varying float vAlt;
  void main() {
    vUv = uv;
    vAlt = alt;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ARC_FRAG = /* glsl */ `
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;
  uniform vec3 uHot;
  uniform float uProgress;
  uniform float uEmph;
  varying vec2 vUv;
  varying float vAlt;
  void main() {
    if (vUv.x > uProgress) discard;
    float head = exp(-(uProgress - vUv.x) * 16.0) * (1.0 - step(0.999, uProgress));
    float a = mix(0.32, 1.0, uEmph);
    float a3 = clamp(vAlt, 0.0, 1.0) * 3.0;
    vec3 base = mix(uC0, uC1, smoothstep(0.0, 1.0, a3));
    base = mix(base, uC2, smoothstep(1.0, 2.0, a3));
    base = mix(base, uC3, smoothstep(2.0, 3.0, a3));
    vec3 col = mix(base, uHot, head * 0.85);
    gl_FragColor = vec4(col, a * (0.8 + 0.2 * head));
  }
`

interface FlightObjects {
  arc: THREE.Mesh
  arcMat: THREE.ShaderMaterial
  curve: THREE.CatmullRomCurve3
  originMarker: THREE.Mesh
  destMarker: THREE.Mesh
  ring: THREE.Mesh
  mid: { lat: number; lng: number }
  progress: number
  emph: number
  emphTarget: number
  drawStart: number | null
  arrivalAt: number | null
  seen: boolean
}

export function createGlobe(
  canvas: HTMLCanvasElement,
  flights: SceneFlight[],
  opts: { dark: boolean; reducedMotion: boolean },
): GlobeHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" })
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
  camera.position.set(0, 0, 4.7)

  const world = new THREE.Group() // everything that turns with the Earth
  scene.add(world)

  let dark = opts.dark
  const reduced = opts.reducedMotion
  const small = canvas.clientWidth < 480
  const dotCount = small ? 10000 : 24000
  const dotWorld = 0.0092 * Math.sqrt(24000 / dotCount)

  // Invisible: writes depth only, so a route on the far side of the Earth is hidden. The planet itself
  // is just its dots.
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(0.994, 48, 36),
    new THREE.MeshBasicMaterial({ colorWrite: false }),
  )
  occluder.renderOrder = -1
  world.add(occluder)

  // Land dots
  const dotGeo = new THREE.BufferGeometry()
  dotGeo.setAttribute("position", new THREE.BufferAttribute(landPoints(dotCount), 3))
  const dotMat = new THREE.ShaderMaterial({
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDot: { value: dotWorld },
      uScale: { value: 1 },
      uColor: { value: new THREE.Color() },
      uAlpha: { value: 0.6 },
    },
  })
  world.add(new THREE.Points(dotGeo, dotMat))

  // Flights
  const markerGeo = new THREE.CircleGeometry(0.016, 24)
  const ringGeo = new THREE.RingGeometry(0.016, 0.0195, 48)
  const markerMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })
  const arcMats: THREE.ShaderMaterial[] = []
  const zAxis = new THREE.Vector3(0, 0, 1)

  const objs: FlightObjects[] = flights.map((raw) => {
    const f = { path: dedupe(raw.path) }
    const { curve, alts } = pathCurve(f.path)
    const arcMat = new THREE.ShaderMaterial({
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uC0: { value: new THREE.Color() },
        uC1: { value: new THREE.Color() },
        uC2: { value: new THREE.Color() },
        uC3: { value: new THREE.Color() },
        uHot: { value: new THREE.Color() },
        uProgress: { value: 0 },
        uEmph: { value: 0 },
      },
    })
    arcMats.push(arcMat)
    const tube = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, 0.0038, 6, false)
    // Altitude at every ring of the tube (evenly spaced along the route's length), for the colour ramp.
    const altitudes = new Float32Array(tube.attributes.position.count)
    const ringSize = 7 // radial segments + 1
    for (let i = 0; i <= TUBE_SEGMENTS; i++) {
      const t = curve.getUtoTmapping(i / TUBE_SEGMENTS, 0) * (alts.length - 1)
      const lo = Math.min(alts.length - 2, Math.floor(t))
      const alt = alts[lo] + (alts[lo + 1] - alts[lo]) * (t - lo)
      for (let j = 0; j < ringSize; j++) altitudes[i * ringSize + j] = Math.max(0, Math.min(1, alt / RAMP_MAX_FT))
    }
    tube.setAttribute("alt", new THREE.BufferAttribute(altitudes, 1))
    const arc = new THREE.Mesh(tube, arcMat)
    world.add(arc)

    const place = (mesh: THREE.Mesh, p: [number, number], r: number) => {
      const n = latLngToVec(p[0], p[1])
      mesh.position.copy(n).multiplyScalar(r)
      mesh.quaternion.setFromUnitVectors(zAxis, n)
      world.add(mesh)
      return mesh
    }
    const first = f.path[0]
    const last = f.path[f.path.length - 1]
    const originMarker = place(new THREE.Mesh(markerGeo, markerMat.clone()), [first[0], first[1]], 1.003)
    const destMarker = place(new THREE.Mesh(markerGeo, markerMat.clone()), [last[0], last[1]], 1.003)
    const ring = place(new THREE.Mesh(ringGeo, ringMat.clone()), [last[0], last[1]], 1.004)
    ;[originMarker, destMarker, ring].forEach((m) => {
      m.visible = false
    })

    // Where the route is centred: the average direction of its waypoints.
    const sum = new THREE.Vector3()
    for (const [lat, lng] of f.path) sum.add(latLngToVec(lat, lng))
    const mid = sum.lengthSq() < 1e-6 ? latLngToVec(first[0], first[1]) : sum.normalize()
    return {
      arc,
      arcMat,
      curve,
      originMarker,
      destMarker,
      ring,
      mid: { lat: Math.asin(mid.y) / DEG, lng: Math.atan2(mid.x, mid.z) / DEG },
      progress: 0,
      emph: 0,
      emphTarget: 0,
      drawStart: null,
      arrivalAt: null,
      seen: false,
    }
  })

  function applyPalette() {
    const p = dark ? PALETTE.dark : PALETTE.light
    const ramp = dark ? ALTITUDE_RAMP.dark : ALTITUDE_RAMP.light
    dotMat.uniforms.uColor.value.set(p.dots)
    dotMat.uniforms.uAlpha.value = p.dotAlpha
    for (const m of arcMats) {
      ramp.forEach((c, i) => m.uniforms[`uC${i}`].value.set(c))
      m.uniforms.uHot.value.set(p.arcHot)
    }
    for (const o of objs) {
      ;(o.originMarker.material as THREE.MeshBasicMaterial).color.set(ramp[1])
      ;(o.destMarker.material as THREE.MeshBasicMaterial).color.set(ramp[1])
      ;(o.ring.material as THREE.MeshBasicMaterial).color.set(ramp[1])
    }
  }
  applyPalette()

  // Orientation
  let yaw = 0
  let tilt = 0.32
  let drift = 0
  let turn = { fromYaw: 0, toYaw: 0, fromTilt: tilt, toTilt: tilt, start: 0, active: false }
  let active = -1
  let paused = false

  function setSize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    dotMat.uniforms.uScale.value = (h * dpr) / (2 * Math.tan((camera.fov * DEG) / 2))
  }
  setSize()
  const resizeObserver = new ResizeObserver(setSize)
  resizeObserver.observe(canvas)

  function focus(index: number, o: { instant?: boolean } = {}) {
    const f = objs[index]
    if (!f) return
    active = index
    const now = performance.now()
    objs.forEach((x, i) => {
      x.emphTarget = i === index ? 1 : 0
    })

    // Shortest way round to the flight's longitude, tilted a little toward its latitude.
    const targetYaw = -f.mid.lng * DEG
    const delta = ((((targetYaw - (yaw + drift)) % TAU) + Math.PI * 3) % TAU) - Math.PI
    const targetTilt = Math.max(-0.2, Math.min(0.8, 0.28 + f.mid.lat * DEG * 0.55))
    if (o.instant || reduced) {
      yaw = yaw + drift + delta
      drift = 0
      tilt = targetTilt
      turn.active = false
    } else {
      turn = { fromYaw: yaw + drift, toYaw: yaw + drift + delta, fromTilt: tilt, toTilt: targetTilt, start: now, active: true }
      yaw = turn.fromYaw
      drift = 0
    }

    if (reduced) {
      objs.forEach((x) => {
        x.progress = 1
        x.seen = true
      })
    } else {
      f.drawStart = now + (o.instant ? 0 : ARC_DELAY_MS)
      f.arrivalAt = f.drawStart + ARC_DRAW_MS
      f.progress = 0
      f.seen = true
    }
  }

  const tmp = new THREE.Vector3()
  function project(mesh: THREE.Mesh) {
    mesh.getWorldPosition(tmp)
    const facing = tmp.clone().normalize().dot(camera.position.clone().sub(tmp).normalize())
    if (facing < 0.12) return null
    tmp.project(camera)
    return { x: (tmp.x * 0.5 + 0.5) * canvas.clientWidth, y: (-tmp.y * 0.5 + 0.5) * canvas.clientHeight }
  }
  function anchors() {
    const f = objs[active]
    if (!f) return { origin: null, destination: null }
    return { origin: project(f.originMarker), destination: project(f.destMarker) }
  }

  let raf = 0
  let last = performance.now()
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (paused) return

    if (turn.active) {
      const t = Math.min(1, (now - turn.start) / TURN_MS)
      const e = easeInOut(t)
      yaw = turn.fromYaw + (turn.toYaw - turn.fromYaw) * e
      tilt = turn.fromTilt + (turn.toTilt - turn.fromTilt) * e
      if (t >= 1) turn.active = false
    } else if (!reduced) {
      drift += DRIFT_RAD_PER_S * dt
    }
    world.rotation.set(tilt, yaw + drift, 0)

    for (let i = 0; i < objs.length; i++) {
      const o = objs[i]
      if (o.drawStart !== null && !reduced) {
        const t = Math.max(0, Math.min(1, (now - o.drawStart) / ARC_DRAW_MS))
        o.progress = easeOut(t)
        if (t >= 1) o.drawStart = null
      }
      o.emph += (o.emphTarget - o.emph) * Math.min(1, dt * 4)
      o.arcMat.uniforms.uProgress.value = o.progress
      o.arcMat.uniforms.uEmph.value = o.emph

      const shown = o.progress > 0.001
      o.originMarker.visible = shown
      o.destMarker.visible = o.progress > 0.985
      ;(o.originMarker.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * o.emph
      ;(o.destMarker.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * o.emph

      // Arrival: one ring leaves the destination, only for the active flight.
      if (i === active && !reduced && o.arrivalAt !== null && now >= o.arrivalAt) {
        const t = Math.min(1, (now - o.arrivalAt) / 1800)
        o.ring.visible = t < 1
        o.ring.scale.setScalar(1 + easeOut(t) * 7)
        ;(o.ring.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8
      } else {
        o.ring.visible = false
      }
    }

    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  return {
    focus,
    anchors,
    setDark(next) {
      dark = next
      applyPalette()
    },
    setPaused(next) {
      paused = next
      last = performance.now()
    },
    dispose() {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh
        m.geometry?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
      renderer.dispose()
    },
  }
}
