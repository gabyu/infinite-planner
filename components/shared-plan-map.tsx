"use client"

import dynamic from "next/dynamic"
import type { StoredWaypoint } from "@/lib/flight-plans"

// Same Leaflet map as the editor's preview, loaded on the client only.
const MapPreview = dynamic(() => import("@/components/map-preview-wrapper"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">Loading map...</div>,
})

// Read-only: no editing, no dragging.
export function SharedPlanMap({ waypoints }: { waypoints: StoredWaypoint[] }) {
  return (
    <MapPreview
      waypoints={waypoints.map((waypoint, index) => ({ ...waypoint, id: String(index) }))}
      isEditing={false}
      onWaypointDragEnd={() => {}}
    />
  )
}
