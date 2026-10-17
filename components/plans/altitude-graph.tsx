import { altitudeProfile, ALTITUDE_BUCKETS, formatAltitude, formatDistanceNm } from "@/lib/route-render"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Altitude (feet) against the distance flown, as inline SVG, in the same colours as the route on the map: the line
// and the area under it take the altitude ramp of the homepage globe (cyan near the ground, through blue, to
// violet at cruise) by their HEIGHT, so a level of the graph is the colour that level has on the map. Reads out
// the cruise level for screen readers.
const FRAME = { width: 1072, height: 220, pad: 28 }
const RAMP_TOP_FT = 40000

export function AltitudeGraph({ waypoints }: { waypoints: StoredWaypoint[] }) {
  const profile = altitudeProfile(waypoints, FRAME)
  const top = Math.max(profile.maxAltitudeFt, 1000)
  const innerH = FRAME.height - FRAME.pad * 2
  const baseline = FRAME.height - FRAME.pad
  // Where 0 ft and 40,000 ft fall on the graph, so the gradient follows the altitude scale whatever the plan's ceiling.
  const yAt = (feet: number) => baseline - (feet / top) * innerH
  const label = `Cruises at ${formatAltitude(profile.maxAltitudeFt)}, ${formatDistanceNm(profile.totalNm)}`

  const stops = Array.from({ length: ALTITUDE_BUCKETS }, (_, i) => i)

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      className="block h-auto w-full rounded-3xl bg-card text-muted-foreground ring-1 ring-border"
      style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
    >
      <defs>
        {(["alt-line", "alt-fill"] as const).map((id) => (
          <linearGradient key={id} id={id} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={yAt(0)} y2={yAt(RAMP_TOP_FT)}>
            {stops.map((i) => (
              <stop
                key={i}
                offset={i / (ALTITUDE_BUCKETS - 1)}
                className={`alt-stop-${i}`}
                stopOpacity={id === "alt-fill" ? 0.28 : 1}
              />
            ))}
          </linearGradient>
        ))}
      </defs>
      <line x1={FRAME.pad} x2={FRAME.width - FRAME.pad} y1={baseline} y2={baseline} stroke="currentColor" strokeOpacity="0.25" />
      <line x1={FRAME.pad} x2={FRAME.width - FRAME.pad} y1={FRAME.pad} y2={FRAME.pad} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="4 6" />
      <path d={profile.area} fill="url(#alt-fill)" />
      <path d={profile.line} fill="none" stroke="url(#alt-line)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <g fontSize="15" fill="currentColor" fontFamily="var(--font-ibm-plex-mono), monospace">
        <text x={FRAME.pad} y={FRAME.pad - 8}>{`${top.toLocaleString("en-US")} ft`}</text>
        <text x={FRAME.pad} y={FRAME.height - 6}>0 NM</text>
        <text x={FRAME.width - FRAME.pad} y={FRAME.height - 6} textAnchor="end">
          {formatDistanceNm(profile.totalNm)}
        </text>
      </g>
    </svg>
  )
}
