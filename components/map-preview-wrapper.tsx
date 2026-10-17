"use client"

import type React from "react"
import { useEffect, useState } from "react"

import type { MapPreviewProps } from "@/components/map-preview"

export default function MapPreviewWrapper(props: MapPreviewProps) {
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
      <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading map...
      </div>
    )
  }

  return <MapComponent {...props} />
}
