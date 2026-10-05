import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { formatFlightTime } from "@/lib/flight-plans"
import { getSharedPlan } from "@/lib/shared-plans"

// The preview card of a shared link: the route drawn on a blue field, with the airports and
// a few facts. Same lifecycle as the page: looked up live, never cached.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const alt = "Shared flight plan"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontsDir = join(process.cwd(), "assets", "fonts")
const loadFont = (file: string) => readFile(join(fontsDir, file))

// Route panel (the wide band under the airports), in px.
const MAP = { width: 1072, height: 252, pad: 40 }

type Point = { x: number; y: number }

// Equirectangular projection fitted into the panel, aspect ratio kept. Longitudes are
// unwrapped so a route crossing the antimeridian stays in one piece.
function projectRoute(waypoints: { lat: number; lng: number }[]): Point[] {
  const unwrapped: { lat: number; lng: number }[] = []
  waypoints.forEach((w, i) => {
    let lng = w.lng
    if (i > 0) {
      const prev = unwrapped[i - 1].lng
      while (lng - prev > 180) lng -= 360
      while (lng - prev < -180) lng += 360
    }
    unwrapped.push({ lat: w.lat, lng })
  })

  const lats = unwrapped.map((w) => w.lat)
  const lngs = unwrapped.map((w) => w.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.cos((midLat * Math.PI) / 180)
  const minX = Math.min(...lngs) * k
  const spanX = Math.max((Math.max(...lngs) - Math.min(...lngs)) * k, 0.01)
  const maxY = Math.max(...lats)
  const spanY = Math.max(maxY - Math.min(...lats), 0.01)

  const innerW = MAP.width - MAP.pad * 2
  const innerH = MAP.height - MAP.pad * 2
  const scale = Math.min(innerW / spanX, innerH / spanY)
  const offX = (MAP.width - spanX * scale) / 2
  const offY = (MAP.height - spanY * scale) / 2

  return unwrapped.map((w) => ({
    x: offX + (w.lng * k - minX) * scale,
    y: offY + (maxY - w.lat) * scale,
  }))
}

export default async function Image({ params }: { params: { token: string } }) {
  const plan = await getSharedPlan(params.token)
  if (!plan) return new Response(null, { status: 404 })

  const [logoSvg, inter500, inter700, plexMono] = await Promise.all([
    readFile(join(process.cwd(), "public", "ip_logo.svg")),
    loadFont("inter-latin-500-normal.woff"),
    loadFont("inter-latin-700-normal.woff"),
    loadFont("ibm-plex-mono-latin-600-normal.woff"),
  ])

  // The logo's blue is the same as the top of the card's gradient: lightened a touch so it reads.
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg.toString().replace("#3C82F6", "#6FA3F9")).toString("base64")}`

  // Thousands of waypoints are pointless at this size.
  const step = Math.max(1, Math.ceil(plan.waypoints.length / 150))
  const sampled = plan.waypoints.filter((_, i) => i % step === 0 || i === plan.waypoints.length - 1)
  const points = sampled.length >= 2 ? projectRoute(sampled) : []
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const first = points[0]
  const last = points[points.length - 1]

  const facts = [plan.flightNumber, formatFlightTime(plan.flightTimeMinutes), `${plan.waypoints.length} waypoints`].filter(
    (f): f is string => Boolean(f),
  )
  const codeSize = plan.origin.length > 4 || plan.destination.length > 4 ? 84 : 104
  const codeStyle = { display: "flex", fontFamily: "IBM Plex Mono", fontSize: codeSize, fontWeight: 600, lineHeight: 1 } as const

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "32px 64px 40px",
          color: "white",
          fontFamily: "Inter",
          backgroundImage: "linear-gradient(180deg, #3b82f6 0%, #1d6bff 55%, #0a5cff 100%)",
        }}
      >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 44 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, opacity: 0.85 }}>
            {`Flight plan by ${plan.authorName}`} · Infinite Planner
          </div>
        </div>
        {/* Logo: top on the first text line, right edge on the route panel's, out of the flow so
            it doesn't push the content down. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={132} height={132} alt="" style={{ position: "absolute", top: 40, right: 64 }} />

        <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
          <div style={codeStyle}>{plan.origin}</div>
          <svg width={codeSize * 0.7} height={codeSize * 0.7} viewBox="0 0 24 24" style={{ margin: "0 28px" }}>
            <path d="M4 12h16M14 6l6 6-6 6" fill="none" stroke="#7ee0ff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ ...codeStyle, color: "#7ee0ff" }}>{plan.destination}</div>
        </div>

        <div
          style={{
            display: "block",
            maxWidth: MAP.width,
            marginTop: 14,
            fontSize: 28,
            fontWeight: 500,
            opacity: 0.95,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {`${plan.originName ?? plan.origin}  →  ${plan.destinationName ?? plan.destination}`}
        </div>

        <div
          style={{
            display: "flex",
            width: MAP.width,
            height: MAP.height,
            marginTop: 22,
            borderRadius: 24,
            backgroundColor: "rgba(255,255,255,0.12)",
            border: "2px solid rgba(255,255,255,0.28)",
          }}
        >
          {path && first && last ? (
            <svg width={MAP.width} height={MAP.height} viewBox={`0 0 ${MAP.width} ${MAP.height}`}>
              <path d={path} fill="none" stroke="#7ee0ff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={first.x} cy={first.y} r={12} fill="white" stroke="#0a5cff" strokeWidth={5} />
              <circle cx={last.x} cy={last.y} r={12} fill="#7ee0ff" stroke="#0a5cff" strokeWidth={5} />
            </svg>
          ) : null}
        </div>

        <div style={{ display: "flex", marginTop: 20, fontSize: 28, fontWeight: 700 }}>{facts.join("  ·  ")}</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter500, weight: 500, style: "normal" },
        { name: "Inter", data: inter700, weight: 700, style: "normal" },
        { name: "IBM Plex Mono", data: plexMono, weight: 600, style: "normal" },
      ],
    },
  )
}
