import { projectRoute, toSvgPath, type RoutePoint } from "@/lib/route-render"

// A small picture of a route for the library's cards: the line and its two endpoints, nothing else.
// Same geometry as the plan page (lib/route-render), inline SVG, fixed aspect ratio.
const FRAME = { width: 320, height: 132, pad: 18 }

export function RouteThumbnail({ route }: { route: RoutePoint[] }) {
  const points = route.length >= 2 ? projectRoute(route, FRAME) : []
  const first = points[0]
  const last = points[points.length - 1]
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      className="block h-auto w-full rounded-2xl bg-muted/60"
      style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
    >
      {first && last && (
        <>
          <path
            d={toSvgPath(points)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={first.x} cy={first.y} r={4} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={2} />
          <circle cx={last.x} cy={last.y} r={4} fill="hsl(var(--primary))" />
        </>
      )}
    </svg>
  )
}
