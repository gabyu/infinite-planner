import { isLand } from "@/lib/land"
import {
  colorSegments,
  createProjection,
  hasAltitudeData,
  sampleWaypoints,
  terrainDots,
  toSvgPath,
  type RoutePoint,
} from "@/lib/route-render"

// The route as a plain inline SVG: no client JavaScript, fixed aspect ratio (no layout shift). Drawn like the
// homepage globe: the land as a field of dots (same coastline data), the route over it as one thin line coloured by
// altitude with the homepage's colour ramp (a single colour when the plan has no altitude), and the two endpoints.
// Everything follows the theme through the design tokens.
const FRAME = { width: 1072, height: 440, pad: 64 }
// Distance between two land dots, in px.
const DOT_STEP = 9
// Never zoom in closer than this many degrees, so a short hop still shows the land around it.
const MIN_SPAN_DEG = 6

export function RouteMap({ waypoints, label }: { waypoints: RoutePoint[]; label: string }) {
  const sampled = sampleWaypoints(waypoints, 400)
  const { project, unproject, route } = createProjection(sampled, FRAME, MIN_SPAN_DEG)
  const points = route.map((w) => project(w.lat, w.lng))
  const first = points[0]
  const last = points[points.length - 1]
  const colored = hasAltitudeData(sampled)
  const segments = colored ? colorSegments(points, sampled.map((w) => w.altitude ?? 0)) : []

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        className="block h-auto w-full rounded-3xl bg-card text-foreground ring-1 ring-border"
        style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
      >
        <path
          d={terrainDots(FRAME, unproject, isLand, DOT_STEP)}
          stroke="currentColor"
          strokeOpacity="0.38"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
        {first && last && (
          <>
            {colored ? (
              segments.map((segment, index) => (
                <path
                  key={index}
                  d={segment.d}
                  className={`alt-${segment.bucket}`}
                  fill="none"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            ) : (
              <path d={toSvgPath(points)} fill="none" stroke="hsl(var(--primary))" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            )}
            <circle cx={first.x} cy={first.y} r={8} fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth={3} />
            <circle cx={last.x} cy={last.y} r={8} fill="hsl(var(--foreground))" stroke="hsl(var(--card))" strokeWidth={3} />
          </>
        )}
      </svg>
      {colored && (
        <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 text-[11px] text-muted-foreground" aria-hidden>
          <span>0 ft</span>
          <span className="alt-swatch h-1.5 w-20 rounded-full" />
          <span>40,000 ft</span>
        </div>
      )}
    </div>
  )
}
