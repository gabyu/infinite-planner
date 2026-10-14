import { isLand } from "@/lib/land"
import { createProjection, sampleWaypoints, toSvgPath, type RoutePoint } from "@/lib/route-render"

// The route as a plain inline SVG: no client JavaScript, fixed aspect ratio (no layout shift).
// Drawn like the homepage globe: the land as a field of dots (same coastline data), the route over it
// as one thin line with the two endpoint dots. Everything follows the theme through the design tokens.
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

  // One path of zero-length segments with round caps: a dot per land cell, a few bytes each.
  let dots = ""
  for (let y = DOT_STEP / 2; y < FRAME.height; y += DOT_STEP) {
    for (let x = DOT_STEP / 2; x < FRAME.width; x += DOT_STEP) {
      const { lat, lng } = unproject(x, y)
      if (isLand(lat, lng)) dots += `M${Math.round(x)} ${Math.round(y)}h0`
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      className="block h-auto w-full rounded-3xl bg-card text-foreground ring-1 ring-border"
      style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
    >
      <path d={dots} stroke="currentColor" strokeOpacity="0.38" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      {first && last && (
        <>
          <path
            d={toSvgPath(points)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={first.x} cy={first.y} r={8} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={3} />
          <circle cx={last.x} cy={last.y} r={8} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={3} />
        </>
      )}
    </svg>
  )
}
