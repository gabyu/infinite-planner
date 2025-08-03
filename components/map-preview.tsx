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
}

export default function MapPreview({ waypoints }: MapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

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
    }

    const map = mapInstanceRef.current

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return // Keep the base tile layer
      map.removeLayer(layer)
    })

    if (waypoints.length === 0) return

    // Create a polyline for the route
    const routePoints = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number])

    // Create a more visible route line
    const routeLine = L.polyline(routePoints, {
      color: "#3B82F6",
      weight: 3,
      opacity: 0.8,
      smoothFactor: 1,
    }).addTo(map)

    // Add direction indicators by placing arrow markers at regular intervals
    if (waypoints.length > 1) {
      // Place arrows at regular intervals along the route
      const arrowCount = Math.min(10, Math.floor(waypoints.length / 2))
      const step = Math.max(1, Math.floor(waypoints.length / arrowCount))

      for (let i = step; i < waypoints.length - 1; i += step) {
        const current = waypoints[i]
        const next = waypoints[i + 1]

        // Calculate the midpoint between two waypoints
        const midLat = (current.lat + next.lat) / 2
        const midLng = (current.lng + next.lng) / 2

        // Calculate the angle for the arrow
        const angle = (Math.atan2(next.lat - current.lat, next.lng - current.lng) * 180) / Math.PI

        // Create an arrow icon
        const arrowIcon = L.divIcon({
          html: `<div style="transform: rotate(${angle}deg); font-size: 20px; color: #3B82F6;">➔</div>`,
          className: "arrow-icon",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })

        // Add the arrow marker
        L.marker([midLat, midLng], { icon: arrowIcon }).addTo(map)
      }
    }

    // Add markers for each waypoint
    const markers: L.Marker[] = []
    waypoints.forEach((waypoint, index) => {
      const isFirst = index === 0
      const isLast = index === waypoints.length - 1
      const isMilestone = index % Math.max(1, Math.floor(waypoints.length / 10)) === 0

      // Create custom icon based on waypoint position
      let iconUrl = "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png"
      let iconSize: [number, number] = [12, 12] // Make regular waypoints smaller

      if (isFirst) {
        // Green for first waypoint (departure)
        iconUrl =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10' fill='%2322c55e'/%3E%3Cpath d='M8 12h8'/%3E%3Cpath d='M12 8v8'/%3E%3C/svg%3E"
        iconSize = [24, 24]
      } else if (isLast) {
        // Red for last waypoint (arrival)
        iconUrl =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10' fill='%23ef4444'/%3E%3Cpath d='M8 12h8'/%3E%3C/svg%3E"
        iconSize = [24, 24]
      } else if (isMilestone) {
        // Blue for milestone waypoints
        iconUrl =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10' fill='%233B82F6'/%3E%3C/svg%3E"
        iconSize = [16, 16]
      }

      const icon = L.icon({
        iconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
        popupAnchor: [0, -iconSize[1] / 2],
      })

      const marker = L.marker([waypoint.lat, waypoint.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<strong>${waypoint.name}</strong><br>
         Lat: ${waypoint.lat.toFixed(6)}<br>
         Lng: ${waypoint.lng.toFixed(6)}<br>
         Alt: ${waypoint.altitude} ft`,
        )

      markers.push(marker)
    })

    // Add a legend to explain the markers
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
          <span>Departure (${waypoints[0].name})</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 3px">
          <div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Arrival (${waypoints[waypoints.length - 1].name})</span>
        </div>
        <div style="display: flex; align-items: center">
          <div style="background-color: #3B82F6; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px"></div>
          <span>Waypoint</span>
        </div>
      `

      return div
    }
    legend.addTo(map)

    // Fit the map to show all waypoints with padding
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(routePoints)
      map.fitBounds(bounds, { padding: [50, 50] })
    }

    // Cleanup function
    return () => {
      // We don't destroy the map, just clear the layers
    }
  }, [waypoints, isDark])

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
