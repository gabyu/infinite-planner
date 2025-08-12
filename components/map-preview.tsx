"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
}

interface MapPreviewProps {
  waypoints: Waypoint[]
  isEditing: boolean // New prop to control draggable state
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void // Callback for drag end
}

export default function MapPreview({ waypoints, isEditing, onWaypointDragEnd }: MapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null) // Ref for the polyline
  const markersRef = useRef<Map<string, L.Marker>>(new Map()) // Ref for markers
  const legendRef = useRef<L.Control | null>(null) // Ref for the legend
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Custom icon SVG data for rounded pins
  const getCustomIconSvg = (color: string, size: number) => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E`
  }

  // Zoom to departure airport (first waypoint) - increased zoom level
  const zoomToDeparture = () => {
    if (waypoints.length > 0 && mapInstanceRef.current) {
      const firstWaypoint = waypoints[0]
      mapInstanceRef.current.setView([firstWaypoint.lat, firstWaypoint.lng], 14)
    }
  }

  // Zoom to arrival airport (last waypoint) - increased zoom level
  const zoomToArrival = () => {
    if (waypoints.length > 0 && mapInstanceRef.current) {
      const lastWaypoint = waypoints[waypoints.length - 1]
      mapInstanceRef.current.setView([lastWaypoint.lat, lastWaypoint.lng], 14)
    }
  }

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([0, 0], 2)

      // Use a dark theme map if in dark mode
      const tileLayer = isDark
        ? L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
          })
        : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          })

      tileLayer.addTo(mapInstanceRef.current)

      // Add legend only once during initial map setup
      const legend = L.control({ position: "bottomright" })
      legend.onAdd = () => {
        const div = L.DomUtil.create("div", "info legend")
        div.style.backgroundColor = isDark ? "#1f2937" : "white"
        div.style.color = isDark ? "#e5e7eb" : "#374151"
        div.style.padding = "6px 8px"
        div.style.border = isDark ? "1px solid #374151" : "1px solid #ccc"
        div.style.borderRadius = "4px"
        div.style.lineHeight = "18px"
        div.style.fontFamily = "Arial, sans-serif"
        div.style.fontSize = "12px"

        div.innerHTML = `
        <div style="margin-bottom: 5px"><strong>Flight Plan</strong></div>
        <div style="display: flex; align-items: center; margin-bottom: 3px">
          <div style="background-color: #22c55e; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Departure (${waypoints[0]?.name || "N/A"})</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 3px">
          <div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Arrival (${waypoints[waypoints.length - 1]?.name || "N/A"})</span>
        </div>
        <div style="display: flex; align-items: center">
          <div style="background-color: #3B82F6; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Waypoint</span>
        </div>
      `
        return div
      }
      legend.addTo(mapInstanceRef.current)
      legendRef.current = legend // Store legend instance
    }

    const map = mapInstanceRef.current
    if (!map) return

    // Update tile layer based on theme
    const currentTileLayer = map.hasLayer(
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {}),
    )
    if (isDark && !currentTileLayer) {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.removeLayer(layer)
        }
      })
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map)
    } else if (!isDark && currentTileLayer) {
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.removeLayer(layer)
        }
      })
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)
    }

    // Update polyline
    const routePoints = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number])
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs(routePoints)
    } else {
      routeLineRef.current = L.polyline(routePoints, {
        color: "#3B82F6",
        weight: 3,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(map)
    }

    // Update markers
    const currentMarkerIds = new Set<string>()
    waypoints.forEach((waypoint, index) => {
      currentMarkerIds.add(waypoint.id)
      const isFirst = index === 0
      const isLast = index === waypoints.length - 1
      const isMilestone = index % Math.max(1, Math.floor(waypoints.length / 10)) === 0

      let iconUrl: string
      let iconSize: [number, number]

      if (waypoint.selected) {
        // Check if selected
        iconUrl = getCustomIconSvg("#f97316", 28) // Orange for selected, slightly larger
        iconSize = [28, 28]
      } else if (isFirst) {
        iconUrl = getCustomIconSvg("#22c55e", 32) // Green for departure, increased size
        iconSize = [32, 32]
      } else if (isLast) {
        iconUrl = getCustomIconSvg("#ef4444", 32) // Red for arrival, increased size
        iconSize = [32, 32]
      } else if (isMilestone) {
        iconUrl = getCustomIconSvg("#3B82F6", 20) // Blue for milestone, increased size
        iconSize = [20, 20]
      } else {
        iconUrl = getCustomIconSvg("#3B82F6", 16) // Smaller blue for regular waypoints, increased size
        iconSize = [16, 16]
      }

      const icon = L.icon({
        iconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
        popupAnchor: [0, -iconSize[1] / 2],
      })

      let marker = markersRef.current.get(waypoint.id)
      if (marker) {
        // Update existing marker
        marker.setLatLng([waypoint.lat, waypoint.lng])
        marker.setIcon(icon)
        marker.setPopupContent(
          `<strong>${waypoint.name}</strong><br>
         Lat: ${waypoint.lat.toFixed(6)}<br>
         Lng: ${waypoint.lng.toFixed(6)}<br>
         Alt: ${waypoint.altitude} ft`,
        )
        marker.dragging?.enable() // Ensure draggable is enabled/disabled based on isEditing
        if (!isEditing) {
          marker.dragging?.disable()
        }
      } else {
        // Create new marker
        marker = L.marker([waypoint.lat, waypoint.lng], { icon, draggable: isEditing })
          .addTo(map)
          .bindPopup(
            `<strong>${waypoint.name}</strong><br>
           Lat: ${waypoint.lat.toFixed(6)}<br>
           Lng: ${waypoint.lng.toFixed(6)}<br>
           Alt: ${waypoint.altitude} ft`,
          )

        // Add drag event listeners only once
        const currentWaypointIndex = index // Capture index in closure
        marker.on("drag", (e) => {
          const draggedLatLng = e.latlng
          const currentPolylineLatLngs = routeLineRef.current?.getLatLngs()
          if (currentPolylineLatLngs) {
            // Create a new array to update the polyline without mutating the original
            const updatedPolylineLatLngs = [...currentPolylineLatLngs]
            updatedPolylineLatLngs[currentWaypointIndex] = draggedLatLng
            routeLineRef.current?.setLatLngs(updatedPolylineLatLngs as L.LatLngExpression[])
          }
        })

        marker.on("dragend", (e) => {
          const newLatLng = e.target.getLatLng()
          onWaypointDragEnd(waypoint.id, newLatLng.lat, newLatLng.lng)
        })
        markersRef.current.set(waypoint.id, marker)
      }
    })

    // Remove markers that are no longer in the waypoints array
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        map.removeLayer(marker)
        markersRef.current.delete(id)
      }
    })

    // Update legend content if waypoints change (e.g., names)
    if (legendRef.current && waypoints.length > 0) {
      const legendDiv = legendRef.current.getContainer()
      if (legendDiv) {
        legendDiv.innerHTML = `
        <div style="margin-bottom: 5px"><strong>Flight Plan</strong></div>
        <div style="display: flex; align-items: center; margin-bottom: 3px">
          <div style="background-color: #22c55e; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Departure (${waypoints[0]?.name || "N/A"})</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 3px">
          <div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Arrival (${waypoints[waypoints.length - 1]?.name || "N/A"})</span>
        </div>
        <div style="display: flex; align-items: center">
          <div style="background-color: #3B82F6; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Waypoint</span>
        </div>
      `
      }
    }

    // Fit the map to show all waypoints with padding only on initial load or when not editing
    if (waypoints.length > 0 && !isEditing) {
      const bounds = L.latLngBounds(routePoints)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [waypoints, isDark, isEditing, onWaypointDragEnd]) // Added isEditing and onWaypointDragEnd to dependencies

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />

      {/* Zoom Controls */}
      {waypoints.length > 1 && (
        <div className="absolute bottom-4 left-4 flex gap-2 z-[1000]">
          <Button
            onClick={zoomToDeparture}
            size="sm"
            className="bg-white hover:bg-gray-100 text-gray-900 shadow-lg border border-gray-200"
          >
            🛫 Departure
          </Button>
          <Button
            onClick={zoomToArrival}
            size="sm"
            className="bg-white hover:bg-gray-100 text-gray-900 shadow-lg border border-gray-200"
          >
            🛬 Arrival
          </Button>
        </div>
      )}
    </div>
  )
}
