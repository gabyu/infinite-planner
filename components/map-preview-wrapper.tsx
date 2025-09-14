"use client"

import type React from "react"
import { useEffect, useState } from "react"

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
}

interface MapPreviewWrapperProps {
  waypoints: Waypoint[]
  isEditing: boolean
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void
  onWaypointInsert?: (afterIndex: number, lat: number, lng: number) => void
}

export default function MapPreviewWrapper(props: MapPreviewWrapperProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Only load the map component on the client side
    const loadMapComponent = async () => {
      try {
        const { default: MapPreview } = await import("@/components/map-preview")
        setMapComponent(() => MapPreview)
      } catch (error) {
        console.error("Failed to load map component:", error)
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
      <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        Loading map...
      </div>
    )
  }

  return <MapComponent {...props} />
}
