import { isLand } from "@/lib/land"
import {
  colorSegments,
  createProjection,
  hasAltitudeData,
  terrainDots,
  toSvgPath,
  type RoutePoint,
} from "@/lib/route-render"

// A picture of a route for the library's cards: the land as dots (same data as the plan page and the homepage
// globe), the route over it coloured by altitude with the homepage's ramp, and the two endpoints. Inline SVG, fixed
// aspect ratio. `large` is for the cover story of Explore.
const SIZES = {
  card: { width: 320, height: 132, pad: 18, step: 7, dot: 2.4, line: 2, end: 4 },
  large: { width: 760, height: 360, pad: 40, step: 10, dot: 3.2, line: 3, end: 6 },
} as const

export function RouteThumbnail({ route, size = "card" }: { route: RoutePoint[]; size?: keyof typeof SIZES }) {
  const config = SIZES[size]
  const frame = { width: config.width, height: config.height, pad: config.pad }
  const ready = route.length >= 2
  const projection = ready ? createProjection(route, frame, 6) : null
  const points = projection ? projection.route.map((w) => projection.project(w.lat, w.lng)) : []
  const first = points[0]
  const last = points[points.length - 1]
  const colored = hasAltitudeData(route)
  const segments = colored ? colorSegments(points, route.map((w) => w.altitude ?? 0)) : []

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${config.width} ${config.height}`}
      className="block h-auto w-full rounded-2xl bg-muted/50 text-foreground"
      style={{ aspectRatio: `${config.width} / ${config.height}` }}
    >
      {projection && (
        <path
          d={terrainDots(frame, projection.unproject, isLand, config.step)}
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth={config.dot}
          strokeLinecap="round"
          fill="none"
        />
      )}
      {first && last && (
        <>
          {colored ? (
            segments.map((segment, index) => (
              <path
                key={index}
                d={segment.d}
                className={`alt-${segment.bucket}`}
                fill="none"
                strokeWidth={config.line}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          ) : (
            <path d={toSvgPath(points)} fill="none" stroke="hsl(var(--primary))" strokeWidth={config.line} strokeLinecap="round" strokeLinejoin="round" />
          )}
          <circle cx={first.x.toFixed(1)} cy={first.y.toFixed(1)} r={config.end} fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth={config.line} />
          <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r={config.end} fill="hsl(var(--foreground))" />
        </>
      )}
    </svg>
  )
}
