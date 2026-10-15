import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { formatFlightTime } from "@/lib/flight-plans"
import { isLand } from "@/lib/land"
import { getLibraryLaunched } from "@/lib/library"
import { describeEnd } from "@/lib/plan-meta"
import { publicIdFromSlug } from "@/lib/plan-slug"
import { getPublicPlan } from "@/lib/public-plans"
import { createProjection, formatDistanceNm, sampleWaypoints, terrainDots, toSvgPath } from "@/lib/route-render"

// The preview card of a plan link (Discord, X, Slack, search results). Calm and plain, like the site in dark mode:
// a near-black surface, the two cities as the headline, the route drawn in white over the land as dots, one touch of
// the accent blue. Same lifecycle as the page: data-cached, refreshed every 5 minutes and dropped at once by the plan's
// cache tag when it is made private, deleted or hidden.
export const revalidate = 300
export const runtime = "nodejs"
export const alt = "Flight plan"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const fontsDir = join(process.cwd(), "assets", "fonts")
const loadFont = (file: string) => readFile(join(fontsDir, file))

const PAD = 64
// The route panel on the right, in px.
const MAP = { width: 556, height: 502, pad: 44 }
const COLUMN = size.width - PAD * 2 - MAP.width - 48

// Surface and ink: the site's dark theme, a touch warmer than pure black.
const BG = "#0e0e10"
const PANEL = "#17171a"
const HAIRLINE = "rgba(255,255,255,0.09)"
const INK = "#f5f5f7"
const MUTED = "#8e8e93"
const ACCENT = "#3b82f6"

// The longest city name sets the headline size, so a short name is large and "San Francisco" still fits the column.
function headlineSize(longest: number) {
  return Math.max(46, Math.min(96, Math.floor(COLUMN / (Math.max(longest, 4) * 0.56))))
}

export default async function Image({ params }: { params: { slug: string } }) {
  const publicId = publicIdFromSlug(params.slug)
  const plan = publicId ? await getPublicPlan(publicId) : null
  // Before the launch a public plan doesn't exist for anyone outside the admins and contributors: no card either.
  if (!plan || (plan.visibility === "public" && !(await getLibraryLaunched()))) return new Response(null, { status: 404 })

  const [logoSvg, inter500, inter700, plexMono] = await Promise.all([
    readFile(join(process.cwd(), "public", "ip_logo.svg")),
    loadFont("inter-latin-500-normal.woff"),
    loadFont("inter-latin-700-normal.woff"),
    loadFont("ibm-plex-mono-latin-600-normal.woff"),
  ])
  const logoDataUri = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`

  const from = describeEnd(plan.origin, plan.originName)
  const to = describeEnd(plan.destination, plan.destinationName)
  const fromName = from.city ?? from.name ?? plan.origin
  const toName = to.city ?? to.name ?? plan.destination
  const headline = headlineSize(Math.max(fromName.length, toName.length))

  // The route in one colour, over the land (the homepage globe's coastlines) as dots.
  const sampled = sampleWaypoints(plan.waypoints, 150)
  const projection = plan.waypoints.length >= 2 ? createProjection(sampled, MAP, 6) : null
  const points = projection ? projection.route.map((w) => projection.project(w.lat, w.lng)) : []
  const path = toSvgPath(points)
  const land = projection ? terrainDots(MAP, projection.unproject, isLand, 11) : ""
  const first = points[0]
  const last = points[points.length - 1]

  const facts = [
    plan.flightNumber,
    plan.distanceNm > 0 ? formatDistanceNm(plan.distanceNm) : null,
    formatFlightTime(plan.flightTimeMinutes),
  ].filter((fact): fact is string => Boolean(fact))

  const codes = { display: "flex", fontFamily: "IBM Plex Mono", fontSize: 26, fontWeight: 600, color: MUTED } as const
  const name = {
    display: "flex",
    fontFamily: "Inter",
    fontSize: headline,
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1.04,
    color: INK,
  } as const

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: PAD,
          gap: 48,
          backgroundColor: BG,
          color: INK,
          fontFamily: "Inter",
        }}
      >
        {/* The text column. */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: COLUMN, height: MAP.height }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDataUri} width={44} height={44} alt="" />
            <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: MUTED, letterSpacing: "-0.01em" }}>Infinite Planner</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={name}>{fromName}</div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
              <svg width={headline * 0.62} height={headline * 0.62} viewBox="0 0 24 24" style={{ marginRight: headline * 0.18 }}>
                <path d="M12 4v16M6 14l6 6 6-6" fill="none" stroke={ACCENT} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={name}>{toName}</div>
            </div>
            <div style={{ ...codes, marginTop: 22 }}>
              {plan.origin}
              {from.iata ? ` / ${from.iata}` : ""}
              {"   "}→{"   "}
              {plan.destination}
              {to.iata ? ` / ${to.iata}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em" }}>{facts.join("   ·   ")}</div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: MUTED }}>{`Flight plan by ${plan.authorName}`}</div>
          </div>
        </div>

        {/* The route. */}
        <div
          style={{
            display: "flex",
            width: MAP.width,
            height: MAP.height,
            borderRadius: 32,
            overflow: "hidden",
            backgroundColor: PANEL,
            border: `2px solid ${HAIRLINE}`,
          }}
        >
          {path && first && last ? (
            <svg width={MAP.width} height={MAP.height} viewBox={`0 0 ${MAP.width} ${MAP.height}`}>
              <path d={land} fill="none" stroke="white" strokeOpacity={0.2} strokeWidth={4} strokeLinecap="round" />
              <path d={path} fill="none" stroke="white" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={first.x} cy={first.y} r={10} fill={PANEL} stroke="white" strokeWidth={4} />
              <circle cx={last.x} cy={last.y} r={10} fill="white" stroke={PANEL} strokeWidth={4} />
            </svg>
          ) : null}
        </div>
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
