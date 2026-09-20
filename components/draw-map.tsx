"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { sampleCubicBezier } from "@/lib/bezier"

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

interface DrawMapProps {
  waypoints: Waypoint[]
  activeTool: "select" | "line" | "pen"
  onAddPoints: (points: LatLngPoint[]) => void
  onCommitPenAnchor: (anchor: PenAnchorCommit) => void
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void
  onHandleDragEnd: (anchorId: string, which: "handleOut" | "handleIn", newPoint: LatLngPoint) => void
  onToggleWaypointSelect: (id: string) => void
}

const SELECTION_COLOR = "#ea580c"
const PREVIEW_COLOR = "#3B82F6"
const HANDLE_COLOR = "#a855f7"
const DRAG_THRESHOLD_PX = 4

export default function DrawMap({
  waypoints,
  activeTool,
  onAddPoints,
  onCommitPenAnchor,
  onWaypointDragEnd,
  onHandleDragEnd,
  onToggleWaypointSelect,
}: DrawMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)
  const previewLineRef = useRef<any>(null)
  const handlePreviewLineRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const handleMarkersRef = useRef<Map<string, { out?: any; in?: any; outLine?: any; inLine?: any }>>(new Map())
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [L, setL] = useState<any>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  // In-progress pen placement: set on mousedown while the pen tool is
  // active, cleared on mouseup/Escape/tool switch.
  const [penDrag, setPenDrag] = useState<{ down: LatLngPoint; current: LatLngPoint } | null>(null)
  // Hover preview of the next segment, shown once an anchor exists and the
  // pen tool is active but nothing is currently being dragged.
  const [hoverPoint, setHoverPoint] = useState<LatLngPoint | null>(null)

  const activeToolRef = useRef(activeTool)
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  const waypointsRef = useRef(waypoints)
  useEffect(() => {
    waypointsRef.current = waypoints
  }, [waypoints])

  // Source of truth for the in-progress pen drag, written to directly inside
  // the mouse handlers below (not synced from `penDrag` state via an effect)
  // - a fast native mousedown/mousemove/mouseup burst can fire before React
  // flushes an effect, so an effect-synced ref would still read stale/null
  // on mouseup. `penDrag` state exists only to trigger the preview render.
  const penDragRef = useRef<{ down: LatLngPoint; current: LatLngPoint } | null>(null)

  const justDraggedIdRef = useRef<string | null>(null)

  // Reset any in-progress pen placement / hover preview when the tool changes.
  useEffect(() => {
    penDragRef.current = null
    setPenDrag(null)
    setHoverPoint(null)
  }, [activeTool])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        penDragRef.current = null
        setPenDrag(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        const leaflet = await import("leaflet")
        await import("leaflet/dist/leaflet.css")

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

  const getCustomIconSvg = (color: string, size: number) => {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3C/svg%3E`
  }

  // Map init - blank world view, zoom control moved to top-right so it never
  // collides with the drawing toolbar docked at top-left.
  useEffect(() => {
    if (!mapRef.current || !L || !isMapReady) return

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { worldCopyJump: true, zoomControl: false })
        .setView([20, 0], 2)
      L.control.zoom({ position: "topright" }).addTo(mapInstanceRef.current)
    }

    const map = mapInstanceRef.current

    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: isDark ? "dark-map-tiles" : "",
    })

    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer)
    })
    tileLayer.addTo(map)
  }, [L, isMapReady, isDark])

  // Canvas navigation belongs to the Select tool only - Line/Pen reserve
  // click (and click-drag, for Pen) for placing points, matching how a
  // drawing tool in Illustrator claims the canvas away from panning.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (activeTool === "select") {
      map.dragging.enable()
    } else {
      map.dragging.disable()
    }
    map.getContainer().style.cursor = activeTool === "select" ? "" : "crosshair"
  }, [activeTool])

  const clearPreviewLines = () => {
    const map = mapInstanceRef.current
    if (!map) return
    if (previewLineRef.current) {
      map.removeLayer(previewLineRef.current)
      previewLineRef.current = null
    }
    if (handlePreviewLineRef.current) {
      map.removeLayer(handlePreviewLineRef.current)
      handlePreviewLineRef.current = null
    }
  }

  // Mouse interaction for the Line and Pen tools.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) return

    const isOnMarker = (e: any) => {
      const target = e.originalEvent?.target as HTMLElement | undefined
      return !!target?.closest?.(".leaflet-marker-icon")
    }

    const onClick = (e: any) => {
      if (activeToolRef.current !== "line" || isOnMarker(e)) return
      onAddPoints([{ lat: e.latlng.lat, lng: e.latlng.lng }])
    }

    const onMouseDown = (e: any) => {
      if (activeToolRef.current !== "pen" || isOnMarker(e)) return
      const point = { lat: e.latlng.lat, lng: e.latlng.lng }
      penDragRef.current = { down: point, current: point }
      setPenDrag(penDragRef.current)
    }

    const onMouseMove = (e: any) => {
      const mouse = { lat: e.latlng.lat, lng: e.latlng.lng }

      if (activeToolRef.current !== "pen") {
        setHoverPoint(null)
        return
      }

      if (penDragRef.current) {
        penDragRef.current = { ...penDragRef.current, current: mouse }
        setPenDrag(penDragRef.current)
      } else {
        setHoverPoint(mouse)
      }
    }

    const onMouseUp = (e: any) => {
      if (activeToolRef.current !== "pen" || !penDragRef.current) return
      const drag = penDragRef.current
      const downPx = map.latLngToContainerPoint(L.latLng(drag.down.lat, drag.down.lng))
      const currentPx = map.latLngToContainerPoint(L.latLng(drag.current.lat, drag.current.lng))
      const movedPx = Math.hypot(currentPx.x - downPx.x, currentPx.y - downPx.y)

      let handleOut: LatLngPoint | null = null
      let handleIn: LatLngPoint | null = null
      if (movedPx >= DRAG_THRESHOLD_PX) {
        const dLat = drag.current.lat - drag.down.lat
        const dLng = drag.current.lng - drag.down.lng
        handleOut = { lat: drag.down.lat + dLat, lng: drag.down.lng + dLng }
        handleIn = { lat: drag.down.lat - dLat, lng: drag.down.lng - dLng }
      }

      onCommitPenAnchor({ lat: drag.down.lat, lng: drag.down.lng, handleOut, handleIn })
      penDragRef.current = null
      setPenDrag(null)
    }

    map.on("click", onClick)
    map.on("mousedown", onMouseDown)
    map.on("mousemove", onMouseMove)
    map.on("mouseup", onMouseUp)

    return () => {
      map.off("click", onClick)
      map.off("mousedown", onMouseDown)
      map.off("mousemove", onMouseMove)
      map.off("mouseup", onMouseUp)
    }
  }, [L, onAddPoints, onCommitPenAnchor])

  // Live preview rendering: the in-progress handle drag (a straight line
  // through the anchor) plus the curved/straight segment it would create
  // from the last committed waypoint, or - when just hovering with no drag -
  // a preview of the next segment from the last waypoint to the cursor.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) {
      return
    }

    clearPreviewLines()

    if (activeTool !== "pen") return

    const prevPoint = waypoints[waypoints.length - 1]

    if (penDrag) {
      const dLat = penDrag.current.lat - penDrag.down.lat
      const dLng = penDrag.current.lng - penDrag.down.lng
      const handleOut = { lat: penDrag.down.lat + dLat, lng: penDrag.down.lng + dLng }
      const handleIn = { lat: penDrag.down.lat - dLat, lng: penDrag.down.lng - dLng }

      handlePreviewLineRef.current = L.polyline(
        [handleIn, handleOut].map((p) => [p.lat, p.lng]),
        { color: HANDLE_COLOR, weight: 2, opacity: 0.9, interactive: false },
      ).addTo(map)

      if (prevPoint) {
        const p0 = { lat: prevPoint.lat, lng: prevPoint.lng }
        const p1 = prevPoint.handleOut ?? p0
        const p2 = handleIn
        const p3 = penDrag.down
        const sampled = sampleCubicBezier(p0, p1, p2, p3)
        previewLineRef.current = L.polyline(
          [p0, ...sampled].map((p) => [p.lat, p.lng]),
          { color: PREVIEW_COLOR, weight: 3, opacity: 0.6, dashArray: "6, 6", interactive: false },
        ).addTo(map)
      }
      return
    }

    if (hoverPoint && prevPoint) {
      const p0 = { lat: prevPoint.lat, lng: prevPoint.lng }
      const p1 = prevPoint.handleOut ?? p0
      const p2 = hoverPoint
      const p3 = hoverPoint
      const sampled = prevPoint.handleOut ? sampleCubicBezier(p0, p1, p2, p3) : [hoverPoint]
      previewLineRef.current = L.polyline(
        [p0, ...sampled].map((p) => [p.lat, p.lng]),
        { color: PREVIEW_COLOR, weight: 3, opacity: 0.6, dashArray: "6, 6", interactive: false },
      ).addTo(map)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penDrag, hoverPoint, activeTool, waypoints, L])

  // Render the route + waypoint markers + (when relevant) handle markers.
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return
    const map = mapInstanceRef.current

    const routePoints = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number])
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs(routePoints)
    } else if (routePoints.length > 0) {
      routeLineRef.current = L.polyline(routePoints, {
        color: "#3B82F6",
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
        interactive: false,
      }).addTo(map)
    }

    const currentMarkerIds = new Set<string>()
    const canEdit = activeTool === "select"

    waypoints.forEach((waypoint, index) => {
      currentMarkerIds.add(waypoint.id)
      const isFirst = index === 0
      const isLast = index === waypoints.length - 1

      let iconUrl: string
      let iconSize: [number, number]

      if (waypoint.selected) {
        iconUrl = getCustomIconSvg(SELECTION_COLOR, 26)
        iconSize = [26, 26]
      } else if (isFirst) {
        iconUrl = getCustomIconSvg("#22c55e", 28)
        iconSize = [28, 28]
      } else if (isLast) {
        iconUrl = getCustomIconSvg("#ef4444", 28)
        iconSize = [28, 28]
      } else {
        iconUrl = getCustomIconSvg("#3B82F6", 16)
        iconSize = [16, 16]
      }

      const icon = L.icon({
        iconUrl,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
      })

      let marker = markersRef.current.get(waypoint.id)
      if (marker) {
        marker.setLatLng([waypoint.lat, waypoint.lng])
        marker.setIcon(icon)
        if (canEdit) {
          marker.dragging?.enable()
        } else {
          marker.dragging?.disable()
        }
      } else {
        marker = L.marker([waypoint.lat, waypoint.lng], { icon, draggable: canEdit }).addTo(map)

        marker.on("click", () => {
          if (justDraggedIdRef.current === waypoint.id) {
            justDraggedIdRef.current = null
            return
          }
          if (activeToolRef.current === "select") {
            onToggleWaypointSelect(waypoint.id)
          }
        })

        marker.on("dragend", (e: any) => {
          const newLatLng = e.target.getLatLng()
          onWaypointDragEnd(waypoint.id, newLatLng.lat, newLatLng.lng)
          justDraggedIdRef.current = waypoint.id
        })

        markersRef.current.set(waypoint.id, marker)
      }
    })

    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        map.removeLayer(marker)
        markersRef.current.delete(id)
      }
    })

    // Handle markers - only for a selected waypoint, under the Select tool,
    // that actually carries handle data (i.e. was placed with the pen drag).
    const currentHandleOwners = new Set<string>()
    if (activeTool === "select") {
      waypoints.forEach((waypoint) => {
        if (!waypoint.selected || (!waypoint.handleOut && !waypoint.handleIn)) return
        currentHandleOwners.add(waypoint.id)

        const existing = handleMarkersRef.current.get(waypoint.id) ?? {}
        const anchorPos: [number, number] = [waypoint.lat, waypoint.lng]

        const ensureHandle = (
          key: "out" | "in",
          handle: LatLngPoint | null | undefined,
          onDragEnd: (p: LatLngPoint) => void,
        ) => {
          const lineKey = key === "out" ? "outLine" : "inLine"
          if (!handle) {
            if (existing[key]) {
              map.removeLayer(existing[key])
              existing[key] = undefined
            }
            if (existing[lineKey]) {
              map.removeLayer(existing[lineKey])
              existing[lineKey] = undefined
            }
            return
          }

          const handlePos: [number, number] = [handle.lat, handle.lng]
          if (existing[lineKey]) {
            existing[lineKey].setLatLngs([anchorPos, handlePos])
          } else {
            existing[lineKey] = L.polyline([anchorPos, handlePos], {
              color: HANDLE_COLOR,
              weight: 1.5,
              opacity: 0.8,
              dashArray: "3, 4",
              interactive: false,
            }).addTo(map)
          }

          if (existing[key]) {
            existing[key].setLatLng(handlePos)
          } else {
            const handleIcon = L.icon({
              iconUrl: getCustomIconSvg(HANDLE_COLOR, 10),
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })
            const handleMarker = L.marker(handlePos, { icon: handleIcon, draggable: true }).addTo(map)
            handleMarker.on("dragend", (e: any) => {
              const newLatLng = e.target.getLatLng()
              onDragEnd({ lat: newLatLng.lat, lng: newLatLng.lng })
            })
            existing[key] = handleMarker
          }
        }

        ensureHandle("out", waypoint.handleOut, (p) => onHandleDragEnd(waypoint.id, "handleOut", p))
        ensureHandle("in", waypoint.handleIn, (p) => onHandleDragEnd(waypoint.id, "handleIn", p))

        handleMarkersRef.current.set(waypoint.id, existing)
      })
    }

    handleMarkersRef.current.forEach((entry, id) => {
      if (!currentHandleOwners.has(id)) {
        ;[entry.out, entry.in, entry.outLine, entry.inLine].forEach((layer) => {
          if (layer) map.removeLayer(layer)
        })
        handleMarkersRef.current.delete(id)
      }
    })
  }, [waypoints, activeTool, L, onWaypointDragEnd, onToggleWaypointSelect, onHandleDragEnd])

  if (!isMapReady || !L) {
    return (
      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-md">
        Loading map...
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full rounded-md overflow-hidden" />
    </div>
  )
}
