import { altitudeProfile, formatAltitude, formatDistanceNm } from "@/lib/route-render"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Altitude (feet) against the distance flown, as inline SVG. Handles a plan with a single
// altitude (a flat line) and reads out the cruise level for screen readers.
const FRAME = { width: 1072, height: 220, pad: 28 }

export function AltitudeGraph({ waypoints }: { waypoints: StoredWaypoint[] }) {
  const profile = altitudeProfile(waypoints, FRAME)
  const top = Math.max(profile.maxAltitudeFt, 1000)
  const baseline = FRAME.height - FRAME.pad
  const label = `Cruises at ${formatAltitude(profile.maxAltitudeFt)}, ${formatDistanceNm(profile.totalNm)}`

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      className="block h-auto w-full rounded-3xl bg-card text-muted-foreground ring-1 ring-border"
      style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
    >
      <defs>
        <linearGradient id="alt-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={FRAME.pad} x2={FRAME.width - FRAME.pad} y1={baseline} y2={baseline} stroke="currentColor" strokeOpacity="0.25" />
      <line x1={FRAME.pad} x2={FRAME.width - FRAME.pad} y1={FRAME.pad} y2={FRAME.pad} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="4 6" />
      <path d={profile.area} fill="url(#alt-fill)" />
      <path d={profile.line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
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
