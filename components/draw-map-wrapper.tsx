"use client"

import type React from "react"
import { useEffect, useState } from "react"

interface LatLngPoint {
  lat: number
  lng: number
}

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
  locked?: boolean
  handleOut?: LatLngPoint | null
  handleIn?: LatLngPoint | null
}

interface PenAnchorCommit {
  lat: number
  lng: number
  handleOut: LatLngPoint | null
  handleIn: LatLngPoint | null
}

interface DrawMapWrapperProps {
  waypoints: Waypoint[]
  activeTool: "select" | "line" | "pen"
  onAddPoints: (points: LatLngPoint[]) => void
  onCommitPenAnchor: (anchor: PenAnchorCommit) => void
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void
  onHandleDragEnd: (anchorId: string, which: "handleOut" | "handleIn", newPoint: LatLngPoint) => void
  onToggleWaypointSelect: (id: string) => void
}

export default function DrawMapWrapper(props: DrawMapWrapperProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadMapComponent = async () => {
      try {
        const { default: DrawMap } = await import("@/components/draw-map")
        setMapComponent(() => DrawMap)
      } catch (error) {
        console.error("Failed to load draw map component:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (typeof window !== "undefined") {
      loadMapComponent()
    }
  }, [])

  if (isLoading || !MapComponent) {
    return (
      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-md">
        Loading map...
      </div>
    )
  }

  return <MapComponent {...props} />
}
