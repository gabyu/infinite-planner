import { projectRoute, sampleWaypoints, toSvgPath, type RoutePoint } from "@/lib/route-render"

// The route as a plain inline SVG: no client JavaScript, fixed aspect ratio (no layout shift).
// A thin line with the two endpoint dots on a calm surface; it follows the theme through
// currentColor and the design tokens.
const FRAME = { width: 1072, height: 440, pad: 56 }

export function RouteMap({ waypoints, label }: { waypoints: RoutePoint[]; label: string }) {
  const points = projectRoute(sampleWaypoints(waypoints, 400), FRAME)
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      className="block h-auto w-full rounded-3xl bg-card text-foreground ring-1 ring-border"
      style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
    >
      <defs>
        <pattern id="route-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="currentColor" strokeOpacity="0.06" />
        </pattern>
      </defs>
      <rect width={FRAME.width} height={FRAME.height} fill="url(#route-grid)" />
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
