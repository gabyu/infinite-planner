import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { formatFlightTime } from "@/lib/flight-plans"

import { getLibraryLaunched } from "@/lib/library"
import { publicIdFromSlug } from "@/lib/plan-slug"
import { getPublicPlan } from "@/lib/public-plans"
import { altitudeHex, hasAltitudeData, projectRoute, sampleWaypoints, toSvgPath } from "@/lib/route-render"

// The preview card of a plan link: the route drawn on a blue field, with the airports and a few
// facts. Same lifecycle as the page: data-cached, refreshed every 5 minutes and dropped at once by
// the plan's cache tag when it is unpublished, deleted or hidden.
export const revalidate = 300
export const runtime = "nodejs"
export const alt = "Flight plan"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontsDir = join(process.cwd(), "assets", "fonts")
const loadFont = (file: string) => readFile(join(fontsDir, file))

// Route panel (the wide band under the airports), in px.
const MAP = { width: 1072, height: 252, pad: 40 }

export default async function Image({ params }: { params: { slug: string } }) {
  const publicId = publicIdFromSlug(params.slug)
  const plan = publicId ? await getPublicPlan(publicId) : null
  // Before the launch a public plan doesn't exist for anyone outside the admins: no card either.
  if (!plan || (plan.visibility === "public" && !(await getLibraryLaunched()))) return new Response(null, { status: 404 })

  const [logoSvg, inter500, inter700, plexMono] = await Promise.all([
    readFile(join(process.cwd(), "public", "ip_logo.svg")),
    loadFont("inter-latin-500-normal.woff"),
    loadFont("inter-latin-700-normal.woff"),
    loadFont("ibm-plex-mono-latin-600-normal.woff"),
  ])

  // The logo's blue is the same as the top of the card's gradient: lightened a touch so it reads.
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg.toString().replace("#3C82F6", "#6FA3F9")).toString("base64")}`

  const points = plan.waypoints.length >= 2 ? projectRoute(sampleWaypoints(plan.waypoints, 150), MAP) : []
  const path = toSvgPath(points)
  // Coloured by altitude with the homepage's ramp, unless the plan has none.
  const sampledRoute = sampleWaypoints(plan.waypoints, 150)
  const colored = hasAltitudeData(sampledRoute)
  const segments = colored
    ? points.slice(1).map((point, i) => ({
        from: points[i],
        to: point,
        color: altitudeHex(((sampledRoute[i].altitude ?? 0) + (sampledRoute[i + 1].altitude ?? 0)) / 2),
      }))
    : []
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
              {colored ? (
                segments.map((segment, i) => (
                  <path
                    key={i}
                    d={`M${segment.from.x.toFixed(1)} ${segment.from.y.toFixed(1)} L${segment.to.x.toFixed(1)} ${segment.to.y.toFixed(1)}`}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                ))
              ) : (
                <path d={path} fill="none" stroke="#7ee0ff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
              )}
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
