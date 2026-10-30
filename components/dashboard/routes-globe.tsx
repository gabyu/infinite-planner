"use client"

import { useEffect, useRef, useState } from "react"
import type { DashboardRoute } from "@/app/api/dashboard/routes/route"
import { ALTITUDE_RAMP, RAMP_MAX_FT } from "@/components/home/altitude-ramp"
import { LAND_BITMAP, LAND_HEIGHT, LAND_WIDTH } from "@/lib/data/globe-land"

// The world as a flat, horizontal dot map (Antarctica left out) with every route the user generated on it.
const LAT_TOP = 84
const LAT_BOTTOM = -58
const DEG = Math.PI / 180

let landBits: Uint8Array | null = null
function isLand(lat: number, lng: number) {
  if (!landBits) landBits = Uint8Array.from(atob(LAND_BITMAP), (c) => c.charCodeAt(0))
  const x = Math.min(LAND_WIDTH - 1, Math.floor(((lng + 180) / 360) * LAND_WIDTH))
  const y = Math.min(LAND_HEIGHT - 1, Math.floor(((90 - lat) / 180) * LAND_HEIGHT))
  const i = y * LAND_WIDTH + x
  return (landBits[i >> 3] & (1 << (i & 7))) !== 0
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
function altitudeColor(ramp: readonly string[], altitudeFt: number) {
  const t = Math.max(0, Math.min(1, altitudeFt / RAMP_MAX_FT)) * (ramp.length - 1)
  const lo = Math.min(ramp.length - 2, Math.floor(t))
  const a = hexToRgb(ramp[lo])
  const b = hexToRgb(ramp[lo + 1])
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * (t - lo))).join(",")})`
}

// Points along the great circle between two waypoints, so long legs curve the way they do on the real route.
function leg(a: [number, number, number], b: [number, number, number]) {
  const v = (lat: number, lng: number) => [Math.cos(lat * DEG) * Math.sin(lng * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lng * DEG)]
  const p = v(a[0], a[1])
  const q = v(b[0], b[1])
  const angle = Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])))
  const steps = Math.max(1, Math.ceil(angle / DEG))
  const out: [number, number, number][] = []
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    const s = Math.sin(angle)
    const w1 = s < 1e-6 ? 1 - t : Math.sin((1 - t) * angle) / s
    const w2 = s < 1e-6 ? t : Math.sin(t * angle) / s
    const x = p[0] * w1 + q[0] * w2
    const y = p[1] * w1 + q[1] * w2
    const z = p[2] * w1 + q[2] * w2
    out.push([Math.asin(Math.max(-1, Math.min(1, y))) / DEG, Math.atan2(x, z) / DEG, a[2] + (b[2] - a[2]) * t])
  }
  return out
}

function draw(canvas: HTMLCanvasElement, routes: DashboardRoute[], dark: boolean) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.scale(dpr, dpr)
  const x = (lng: number) => ((lng + 180) / 360) * width
  const y = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * height

  // Land: one dot per grid cell.
  const step = Math.max(1.1, 360 / (width / 4.2))
  ctx.fillStyle = dark ? "rgba(180,191,214,0.55)" : "rgba(74,83,102,0.5)"
  const r = Math.max(0.7, width / 1000)
  for (let lat = LAT_TOP; lat > LAT_BOTTOM; lat -= step)
    for (let lng = -180; lng < 180; lng += step)
      if (isLand(lat, lng)) {
        ctx.beginPath()
        ctx.arc(x(lng), y(lat), r, 0, Math.PI * 2)
        ctx.fill()
      }

  // Routes, coloured by altitude; a leg that crosses the date line is cut instead of drawn across the map.
  const ramp = dark ? ALTITUDE_RAMP.dark : ALTITUDE_RAMP.light
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.globalAlpha = 0.85
  for (const route of routes) {
    for (let i = 1; i < route.path.length; i++) {
      const pts = leg(route.path[i - 1], route.path[i])
      for (let k = 1; k < pts.length; k++) {
        if (Math.abs(pts[k][1] - pts[k - 1][1]) > 180) continue
        ctx.strokeStyle = altitudeColor(ramp, (pts[k][2] + pts[k - 1][2]) / 2)
        ctx.beginPath()
        ctx.moveTo(x(pts[k - 1][1]), y(pts[k - 1][0]))
        ctx.lineTo(x(pts[k][1]), y(pts[k][0]))
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = ramp[1]
  for (const route of routes)
    for (const p of [route.path[0], route.path[route.path.length - 1]]) {
      ctx.beginPath()
      ctx.arc(x(p[1]), y(p[0]), 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
}

export function RoutesGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [routes, setRoutes] = useState<DashboardRoute[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/dashboard/routes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => !cancelled && setRoutes(body.routes as DashboardRoute[]))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !routes || routes.length === 0) return
    const root = document.documentElement
    const paint = () => draw(canvas, routes, root.classList.contains("dark"))
    paint()
    const resize = new ResizeObserver(paint)
    resize.observe(canvas)
    const theme = new MutationObserver(paint)
    theme.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => {
      resize.disconnect()
      theme.disconnect()
    }
  }, [routes])

  if (failed) return <p className="py-16 text-center text-sm text-muted-foreground">Couldn&apos;t draw your routes right now.</p>
  if (!routes) return <div className="aspect-[2.5/1] w-full animate-pulse rounded-md bg-muted" />
  if (routes.length === 0)
    return <p className="py-16 text-center text-sm text-muted-foreground">Your routes appear here once you export a flight plan.</p>

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${routes.length} flight plan route${routes.length === 1 ? "" : "s"} on a world map`}
        className="aspect-[2.55/1] w-full"
      />
      <p className="text-xs text-muted-foreground">
        {routes.length} route{routes.length === 1 ? "" : "s"}
      </p>
    </div>
  )
}
