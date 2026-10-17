"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { altitudeProfile, formatAltitude, formatDistanceNm, hasAltitudeData } from "@/lib/route-render"
import { altitudeLabel, copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

interface StripWaypoint {
  id: string
  lat: number
  lng: number
  altitude: number
}

interface AltitudeStripProps {
  waypoints: StripWaypoint[]
  hoveredId: string | null
  onHover: (id: string | null) => void
}

// Altitude against distance flown, under the map. Hovering the profile highlights the point on the map and the
// other way round (the editor passes the hovered waypoint id both ways). The path comes from the same
// computation as the plan page's graph (lib/route-render.ts).
const FRAME = { width: 1000, height: 100, pad: 6 }

export function AltitudeStrip({ waypoints, hoveredId, onHover }: AltitudeStripProps) {
  const [open, setOpen] = useState(true)
  const profile = altitudeProfile(waypoints, FRAME)
  const hasData = hasAltitudeData(waypoints)
  const hoveredIndex = hoveredId ? waypoints.findIndex((wp) => wp.id === hoveredId) : -1
  const hovered = hoveredIndex >= 0 ? profile.points[hoveredIndex] : null
  const label = altitudeLabel(formatAltitude(profile.maxAltitudeFt), formatDistanceNm(profile.totalNm))

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * FRAME.width
    let nearest = 0
    let best = Number.POSITIVE_INFINITY
    profile.points.forEach((point, index) => {
      const distance = Math.abs(point.x - x)
      if (distance < best) {
        best = distance
        nearest = index
      }
    })
    onHover(waypoints[nearest]?.id ?? null)
  }

  return (
    <section className="border-t bg-card" aria-label={copy.editor.altitudeHeading}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? copy.editor.altitudeHide : copy.editor.altitudeShow}
        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="studio-label">{copy.editor.altitudeHeading}</span>
        <span className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          {hasData && (
            <span>
              {formatAltitude(profile.maxAltitudeFt)} · {formatDistanceNm(profile.totalNm)}
            </span>
          )}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {hasData ? (
            <div
              className="relative h-24 w-full touch-none"
              onPointerMove={handleMove}
              onPointerLeave={() => onHover(null)}
            >
              <svg
                role="img"
                aria-label={label}
                viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
                preserveAspectRatio="none"
                className="h-full w-full text-primary"
              >
                <line
                  x1={0}
                  x2={FRAME.width}
                  y1={FRAME.height - FRAME.pad}
                  y2={FRAME.height - FRAME.pad}
                  className="stroke-border"
                  vectorEffect="non-scaling-stroke"
                />
                <path d={profile.area} fill="currentColor" fillOpacity={0.14} />
                <path
                  d={profile.line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {hovered && (
                <>
                  <div
                    className="pointer-events-none absolute inset-y-0 w-px bg-foreground/30"
                    style={{ left: `${(hovered.x / FRAME.width) * 100}%` }}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                      "bg-primary ring-2 ring-background",
                    )}
                    style={{ left: `${(hovered.x / FRAME.width) * 100}%`, top: `${(hovered.y / FRAME.height) * 100}%` }}
                  />
                </>
              )}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">{copy.editor.altitudeNone}</p>
          )}
        </div>
      )}
    </section>
  )
}
