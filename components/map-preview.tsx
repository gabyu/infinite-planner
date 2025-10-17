"use client"

import { useEffect, useRef, useState } from "react"
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
  isEditing: boolean
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void
  onWaypointInsert?: (afterIndex: number, lat: number, lng: number) => void
}

export default function MapPreview({ waypoints, isEditing, onWaypointDragEnd, onWaypointInsert }: MapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)
  const hoverLineRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const legendRef = useRef<any>(null)
  const insertMarkerRef = useRef<any>(null)
  const [hoverSegmentIndex, setHoverSegmentIndex] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<any>(null)
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [L, setL] = useState<any>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  // Load Leaflet dynamically
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        // Dynamic import of Leaflet
        const leaflet = await import("leaflet")

        // Import CSS
        await import("leaflet/dist/leaflet.css")

        // Fix for default markers in Leaflet with webpack
        delete (leaflet.Icon.Default.prototype as any)._getIconUrl
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: "/marker-icon.png",
          iconUrl: "/marker-icon.png",
          shadowUrl: "/marker-shadow.png",
        })

        setL(leaflet.default || leaflet)
        setIsMapReady(true)
      } catch (error) {
        console.error("Failed to load Leaflet:", error)
      }
    }

    if (typeof window !== "undefined") {
      loadLeaflet()
    }
  }, [])

  // Custom icon SVG data for rounded pins
  const getCustomIconSvg = (color: string, size: number) => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E`
  }

  // Custom icon for the insert waypoint indicator - perfect circle
  const getInsertIconSvg = (size: number) => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24' fill='%2310b981' stroke='white' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='16'/%3E%3Cline x1='8' y1='12' x2='16' y2='12'/%3E%3C/svg%3E`
  }

  // Zoom to departure airport (first waypoint)
  const zoomToDeparture = () => {
    if (waypoints.length > 0 && mapInstanceRef.current) {
      const firstWaypoint = waypoints[0]
      mapInstanceRef.current.setView([firstWaypoint.lat, firstWaypoint.lng], 14)
    }
  }

  // Zoom to arrival airport (last waypoint)
  const zoomToArrival = () => {
    if (waypoints.length > 0 && mapInstanceRef.current) {
      const lastWaypoint = waypoints[waypoints.length - 1]
      mapInstanceRef.current.setView([lastWaypoint.lat, lastWaypoint.lng], 14)
    }
  }

  // Function to find the closest point on a line segment to a given point
  const getClosestPointOnSegment = (point: any, segmentStart: any, segmentEnd: any) => {
    const map = mapInstanceRef.current
    if (!map || !L) return null

    // Convert to pixel coordinates for more accurate calculations
    const pointPixel = map.latLngToContainerPoint(point)
    const startPixel = map.latLngToContainerPoint(segmentStart)
    const endPixel = map.latLngToContainerPoint(segmentEnd)

    // Calculate the closest point on the line segment
    const dx = endPixel.x - startPixel.x
    const dy = endPixel.y - startPixel.y
    const length = Math.sqrt(dx * dx + dy * dy)

    if (length === 0) return segmentStart

    const t = Math.max(
      0,
      Math.min(1, ((pointPixel.x - startPixel.x) * dx + (pointPixel.y - startPixel.y) * dy) / (length * length)),
    )

    const closestPixel = {
      x: startPixel.x + t * dx,
      y: startPixel.y + t * dy,
    }

    return map.containerPointToLatLng(L.point(closestPixel.x, closestPixel.y))
  }

  // Check if mouse is near an existing waypoint (priority zone)
  const isNearExistingWaypoint = (mouseLatLng: any, threshold = 30) => {
    const map = mapInstanceRef.current
    if (!map || !L) return false

    const mousePixel = map.latLngToContainerPoint(mouseLatLng)

    for (const waypoint of waypoints) {
      const waypointPixel = map.latLngToContainerPoint(L.latLng(waypoint.lat, waypoint.lng))
      const distance = Math.sqrt(
        Math.pow(mousePixel.x - waypointPixel.x, 2) + Math.pow(mousePixel.y - waypointPixel.y, 2),
      )

      if (distance <= threshold) {
        return true
      }
    }
    return false
  }

  // Check distance in pixels between mouse and closest point on route
  const getPixelDistanceToRoute = (mouseLatLng: any) => {
    const map = mapInstanceRef.current
    if (!map || !L || waypoints.length < 2) return Number.POSITIVE_INFINITY

    const mousePixel = map.latLngToContainerPoint(mouseLatLng)
    let minPixelDistance = Number.POSITIVE_INFINITY

    // Check distance to each segment
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segmentStart = L.latLng(waypoints[i].lat, waypoints[i].lng)
      const segmentEnd = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng)

      const pointOnSegment = getClosestPointOnSegment(mouseLatLng, segmentStart, segmentEnd)
      if (pointOnSegment) {
        const segmentPixel = map.latLngToContainerPoint(pointOnSegment)
        const pixelDistance = Math.sqrt(
          Math.pow(mousePixel.x - segmentPixel.x, 2) + Math.pow(mousePixel.y - segmentPixel.y, 2),
        )
        minPixelDistance = Math.min(minPixelDistance, pixelDistance)
      }
    }

    return minPixelDistance
  }

  // Handle map mousemove to find the closest segment
  const handleMapMouseMove = (e: any) => {
    if (!isEditing || !mapInstanceRef.current || !L || waypoints.length < 2) {
      setHoverSegmentIndex(null)
      setHoverPoint(null)
      return
    }

    // Clear existing timeout
    if (mouseMoveTimeoutRef.current) {
      clearTimeout(mouseMoveTimeoutRef.current)
    }

    // Debounce the mousemove to reduce flickering
    mouseMoveTimeoutRef.current = setTimeout(() => {
      const mouseLatLng = e.latlng

      // Check if we're near an existing waypoint (priority zone)
      if (isNearExistingWaypoint(mouseLatLng)) {
        setHoverSegmentIndex(null)
        setHoverPoint(null)
        return
      }

      // Check pixel distance to route
      const pixelDistance = getPixelDistanceToRoute(mouseLatLng)

      // Show (+) icon only when within 20 pixels of the route line
      if (pixelDistance <= 20) {
        let closestSegmentIndex = -1
        let closestPoint: any = null
        let minDistance = Number.POSITIVE_INFINITY

        // Find the closest segment
        for (let i = 0; i < waypoints.length - 1; i++) {
          const segmentStart = L.latLng(waypoints[i].lat, waypoints[i].lng)
          const segmentEnd = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng)

          const pointOnSegment = getClosestPointOnSegment(mouseLatLng, segmentStart, segmentEnd)
          if (pointOnSegment) {
            const distance = mouseLatLng.distanceTo(pointOnSegment)
            if (distance < minDistance) {
              minDistance = distance
              closestSegmentIndex = i
              closestPoint = pointOnSegment
            }
          }
        }

        if (closestPoint && closestSegmentIndex >= 0) {
          setHoverSegmentIndex(closestSegmentIndex)
          setHoverPoint(closestPoint)
        } else {
          setHoverSegmentIndex(null)
          setHoverPoint(null)
        }
      } else {
        setHoverSegmentIndex(null)
        setHoverPoint(null)
      }
    }, 10)
  }

  // Handle insert marker click
  const handleInsertMarkerClick = () => {
    if (hoverSegmentIndex !== null && hoverPoint && onWaypointInsert) {
      onWaypointInsert(hoverSegmentIndex, hoverPoint.lat, hoverPoint.lng)
      // Clear hover state after insertion
      setHoverSegmentIndex(null)
      setHoverPoint(null)
    }
  }

  useEffect(() => {
    if (!mapRef.current || !L || !isMapReady) return

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([0, 0], 2)

      // Use a better dark theme map with improved infrastructure visibility
      const tileLayer = isDark
        ? L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
            // Add custom CSS filter to enhance infrastructure visibility
            className: "dark-map-enhanced",
          })
        : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          })

      tileLayer.addTo(mapInstanceRef.current)

      // Add custom CSS for dark map enhancement
      if (isDark) {
        const style = document.createElement("style")
        style.innerHTML = `
          .dark-map-enhanced {
            filter: brightness(1.2) saturate(1.3) hue-rotate(10deg);
          }
        `
        document.head.appendChild(style)
      }

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
      legendRef.current = legend
    }

    const map = mapInstanceRef.current
    if (!map) return

    // Update tile layer based on theme
    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer)
      }
    })

    if (isDark) {
      const darkTileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
        className: "dark-map-enhanced",
      })
      darkTileLayer.addTo(map)

      // Ensure CSS filter is applied
      const existingStyle = document.getElementById("dark-map-style")
      if (!existingStyle) {
        const style = document.createElement("style")
        style.id = "dark-map-style"
        style.innerHTML = `
          .dark-map-enhanced {
            filter: brightness(1.2) saturate(1.3) hue-rotate(10deg);
          }
        `
        document.head.appendChild(style)
      }
    } else {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      // Remove dark mode style if it exists
      const existingStyle = document.getElementById("dark-map-style")
      if (existingStyle) {
        existingStyle.remove()
      }
    }

    // Update polyline
    const routePoints = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number])
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs(routePoints)
      routeLineRef.current.setStyle({ interactive: false, weight: 5 })
    } else {
      routeLineRef.current = L.polyline(routePoints, {
        color: "#3B82F6",
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1,
        interactive: false,
      }).addTo(map)
    }

    // Setup hover detection ONLY for edit mode
    if (isEditing && waypoints.length > 1) {
      // Remove old hover line if it exists
      if (hoverLineRef.current) {
        map.removeLayer(hoverLineRef.current)
      }

      hoverLineRef.current = L.polyline(routePoints, {
        color: "transparent",
        weight: 40,
        opacity: 0,
        interactive: true,
      }).addTo(map)

      // Add mousemove event to the map ONLY in edit mode
      map.on("mousemove", handleMapMouseMove)

      // Also add mouseleave to clear hover state when leaving the map
      map.on("mouseout", () => {
        setHoverSegmentIndex(null)
        setHoverPoint(null)
      })
    } else {
      // Remove hover line when not in editing mode
      if (hoverLineRef.current) {
        map.removeLayer(hoverLineRef.current)
        hoverLineRef.current = null
      }

      // Remove mousemove event
      map.off("mousemove", handleMapMouseMove)
      map.off("mouseout")

      // Clear hover state when not editing
      setHoverSegmentIndex(null)
      setHoverPoint(null)
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
        iconUrl = getCustomIconSvg("#f97316", 28)
        iconSize = [28, 28]
      } else if (isFirst) {
        iconUrl = getCustomIconSvg("#22c55e", 32)
        iconSize = [32, 32]
      } else if (isLast) {
        iconUrl = getCustomIconSvg("#ef4444", 32)
        iconSize = [32, 32]
      } else if (isMilestone) {
        iconUrl = getCustomIconSvg("#3B82F6", 20)
        iconSize = [20, 20]
      } else {
        iconUrl = getCustomIconSvg("#3B82F6", 16)
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
        marker.setLatLng([waypoint.lat, waypoint.lng])
        marker.setIcon(icon)

        // Handle popup based on editing mode
        if (!isEditing) {
          marker.bindPopup(
            `<strong>${waypoint.name}</strong><br>
             Lat: ${waypoint.lat.toFixed(6)}<br>
             Lng: ${waypoint.lng.toFixed(6)}<br>
             Alt: ${waypoint.altitude} ft`,
          )
        } else {
          marker.unbindPopup()
        }

        if (isEditing) {
          marker.dragging?.enable()
        } else {
          marker.dragging?.disable()
        }
      } else {
        marker = L.marker([waypoint.lat, waypoint.lng], { icon, draggable: isEditing }).addTo(map)

        // Only bind popup when NOT in editing mode
        if (!isEditing) {
          marker.bindPopup(
            `<strong>${waypoint.name}</strong><br>
             Lat: ${waypoint.lat.toFixed(6)}<br>
             Lng: ${waypoint.lng.toFixed(6)}<br>
             Alt: ${waypoint.altitude} ft`,
          )
        }

        const currentWaypointIndex = index
        marker.on("drag", (e: any) => {
          const draggedLatLng = e.latlng
          const currentPolylineLatLngs = routeLineRef.current?.getLatLngs()
          if (currentPolylineLatLngs) {
            const updatedPolylineLatLngs = [...currentPolylineLatLngs]
            updatedPolylineLatLngs[currentWaypointIndex] = draggedLatLng
            routeLineRef.current?.setLatLngs(updatedPolylineLatLngs)

            // Also update hover line
            if (hoverLineRef.current) {
              hoverLineRef.current.setLatLngs(updatedPolylineLatLngs)
            }
          }
        })

        marker.on("dragend", (e: any) => {
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

    // Update legend content if waypoints change
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

    // Cleanup function
    return () => {
      if (map) {
        map.off("mousemove", handleMapMouseMove)
        map.off("mouseout")
      }
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current)
      }
    }
  }, [waypoints, isDark, isEditing, onWaypointDragEnd, L, isMapReady])

  // Effect to handle the insert marker - ONLY in edit mode
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) return

    // Remove existing insert marker
    if (insertMarkerRef.current) {
      map.removeLayer(insertMarkerRef.current)
      insertMarkerRef.current = null
    }

    // Add new insert marker ONLY if we're in edit mode and have a hover point
    if (isEditing && hoverPoint && hoverSegmentIndex !== null) {
      const insertIcon = L.icon({
        iconUrl: getInsertIconSvg(24),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      insertMarkerRef.current = L.marker(hoverPoint, {
        icon: insertIcon,
        interactive: true,
        zIndexOffset: 1000,
      }).addTo(map)

      // Add click handler to insert waypoint
      insertMarkerRef.current.on("click", handleInsertMarkerClick)
    }

    // Cleanup function
    return () => {
      if (insertMarkerRef.current && map) {
        map.removeLayer(insertMarkerRef.current)
        insertMarkerRef.current = null
      }
    }
  }, [hoverPoint, hoverSegmentIndex, isEditing, L])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current)
      }
    }
  }, [])

  if (!isMapReady || !L) {
    return (
      <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        Loading map...
      </div>
    )
  }

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
