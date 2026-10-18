"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Globe, Layers, Minus, PlaneLanding, PlaneTakeoff, Plus } from "lucide-react"
import {
  BASEMAP_CHOICES,
  basemapTone,
  loadBasemapChoice,
  resolveBasemap,
  saveBasemapChoice,
  setBasemap,
  type BasemapChoice,
} from "@/lib/map-tiles"
import { altitudeBucket, hasAltitudeData, unwrapLongitudes } from "@/lib/route-render"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { copy } from "@/lib/copy"
import { Lock, X } from "lucide-react"

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
}

export interface MapPreviewProps {
  waypoints: Waypoint[]
  isEditing: boolean
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void
  onWaypointInsert?: (afterIndex: number, lat: number, lng: number) => void
  selectMode?: boolean
  onToggleWaypointSelect?: (id: string) => void
  onWaypointsMarqueeSelect?: (ids: string[], additive: boolean) => void
  onClearSelection?: () => void
  /** The waypoint under the pointer in the list or the altitude strip, highlighted on the map. */
  hoveredId?: string | null
  onHoverWaypoint?: (id: string | null) => void
  /** A point was clicked on the map (not in edit or select mode): the editor scrolls its list to the row. */
  onWaypointClick?: (id: string) => void
  /** The editing buttons (Edit waypoints, Select points...), stacked at the top right above the zoom tools. */
  toolbarLeading?: React.ReactNode
  /** Waypoints a ground trim would remove (preview): drawn grey, with their stretch of route dashed. */
  ghostIds?: Set<string>
  /** Zoom to these waypoints (and the kept ones next to them). A new `nonce` asks again. The view then stays where it is
   *  (no refit when the plan changes) until "Fit route" is pressed. */
  focus?: { ids: string[]; nonce: number } | null
}

// Back into -180..180 (a point dragged or inserted beyond the date line).
const foldLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// Selection state of the select-mode marquee. Calmer than Tailwind's orange-500; the dots take their colour
// from the --route-* tokens in globals.css, this one is for the rubber band drawn in script.
const SELECTION_COLOR = "#ea580c"

// With many waypoints, a zoomed-out map draws only every Nth dot (first, last, selected and hovered always stay).
// Only the rendering is thinned: the data is untouched, and editing always shows every point.
const DECLUTTER_MIN_POINTS = 60
const dotStep = (zoom: number) => (zoom >= 10 ? 1 : zoom >= 8 ? 2 : zoom >= 6 ? 4 : 8)
const CHEVRON_MIN_ZOOM = 6
const CHEVRON_SPACING_PX = 150

export default function MapPreview({
  waypoints: rawWaypoints,
  isEditing,
  onWaypointDragEnd,
  onWaypointInsert,
  selectMode = false,
  onToggleWaypointSelect,
  onWaypointsMarqueeSelect,
  onClearSelection,
  hoveredId = null,
  onHoverWaypoint,
  onWaypointClick,
  toolbarLeading,
  ghostIds,
  focus,
}: MapPreviewProps) {
  // A route that crosses the antimeridian (Tokyo to San Francisco) has longitudes that jump from +140 to -122. The map
  // draws it continuous by carrying on past 180 (the tiles repeat), so the line goes over the Pacific and not across
  // the whole world; positions going back to the editor are folded back into -180..180.
  const waypoints = useMemo(() => unwrapLongitudes(rawWaypoints), [rawWaypoints])
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)
  const routeCasingRef = useRef<any>(null)
  const chevronLayerRef = useRef<any>(null)
  const hoverLineRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const insertMarkerRef = useRef<any>(null)
  const [hoverSegmentIndex, setHoverSegmentIndex] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<any>(null)
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [L, setL] = useState<any>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [zoom, setZoom] = useState(2)
  // What the person picked for the background (Auto follows the site theme) and whether the route is coloured
  // by altitude. Both are remembered in the browser.
  const [basemapChoice, setBasemapChoice] = useState<BasemapChoice>("auto")
  const [altColours, setAltColours] = useState(false)
  const altLayerRef = useRef<any>(null)
  useEffect(() => {
    setBasemapChoice(loadBasemapChoice())
    try {
      setAltColours(window.localStorage.getItem("infinite-planner:alt-colours") === "1")
    } catch {
      // ignore
    }
  }, [])
  const basemap = resolveBasemap(basemapChoice, isDark)
  const lastFitCountRef = useRef(0)
  // Set when the editor zoomed somewhere on purpose (a ground trim): the route is not refitted behind its back.
  const viewLockedRef = useRef(false)

  // Handlers bound once on marker creation read the latest callbacks from here.
  const callbacksRef = useRef({ onHoverWaypoint, onWaypointClick, onToggleWaypointSelect, onWaypointDragEnd })
  callbacksRef.current = { onHoverWaypoint, onWaypointClick, onToggleWaypointSelect, onWaypointDragEnd }

  // Refs mirroring latest props so marker event handlers (bound once, on marker
  // creation) never read stale closures when select mode or selection changes.
  const selectModeRef = useRef(selectMode)
  useEffect(() => {
    selectModeRef.current = selectMode
  }, [selectMode])

  const waypointsRef = useRef(waypoints)
  useEffect(() => {
    waypointsRef.current = waypoints
  }, [waypoints])

  const editingRef = useRef(isEditing)
  useEffect(() => {
    editingRef.current = isEditing
  }, [isEditing])

  // Leaflet fires a "click" right after "dragend" on the marker that was just
  // dragged (even though the pointer moved) - without this guard that phantom
  // click would immediately toggle the marker's selection back off.
  const justDraggedIdRef = useRef<string | null>(null)

  // Rubber-band (marquee) selection overlay, drawn with raw pointer events
  // instead of Leaflet's own drag handling (which is disabled in select mode).
  const selectionBoxRef = useRef<HTMLDivElement | null>(null)

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

  // Zoom to departure airport (first waypoint)
  const zoomToDeparture = () => {
    if (waypoints.length > 0 && mapInstanceRef.current) {
      const firstWaypoint = waypoints[0]
      mapInstanceRef.current.setView([firstWaypoint.lat, firstWaypoint.lng], 13)
    }
  }

  // Zoom to arrival airport (last waypoint)
  const zoomToArrival = () => {
    if (waypoints.length > 0 && mapInstanceRef.current) {
      const lastWaypoint = waypoints[waypoints.length - 1]
      mapInstanceRef.current.setView([lastWaypoint.lat, lastWaypoint.lng], 13)
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
    if (!isEditing || selectMode || !mapInstanceRef.current || !L || waypoints.length < 2) {
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
      onWaypointInsert(hoverSegmentIndex, hoverPoint.lat, foldLng(hoverPoint.lng))
      // Clear hover state after insertion
      setHoverSegmentIndex(null)
      setHoverPoint(null)
    }
  }

  // Create the map once: no built-in zoom control (the toolbar has its own), attribution kept visible
  // (top left on a phone, where the bottom sheet covers the bottom edge).
  useEffect(() => {
    if (!mapRef.current || !L || !isMapReady || mapInstanceRef.current) return
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false, worldCopyJump: true }).setView(
      [20, 0],
      2,
    )
    const attribution = L.control.attribution({ position: "bottomright", prefix: false }).addTo(map)
    const placeAttribution = () => attribution.setPosition(window.innerWidth < 1024 ? "topleft" : "bottomright")
    placeAttribution()
    window.addEventListener("resize", placeAttribution)
    map.on("zoomend", () => setZoom(map.getZoom()))
    chevronLayerRef.current = L.layerGroup().addTo(map)
    mapInstanceRef.current = map
    altLayerRef.current = L.layerGroup().addTo(map)
    setBasemap(L, map, basemap)
    setZoom(map.getZoom())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, isMapReady])

  // The chosen basemap
  useEffect(() => {
    if (!L || !mapInstanceRef.current) return
    setBasemap(L, mapInstanceRef.current, basemap)
  }, [L, basemap, isMapReady])


  // The route line: a casing under it so it reads on any background (tokens in globals.css).
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) return
    const routePoints = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number])
    if (routeLineRef.current) {
      routeCasingRef.current.setLatLngs(routePoints)
      routeLineRef.current.setLatLngs(routePoints)
    } else {
      routeCasingRef.current = L.polyline(routePoints, {
        className: "ip-route-casing",
        weight: 6,
        smoothFactor: 1,
        interactive: false,
      }).addTo(map)
      routeLineRef.current = L.polyline(routePoints, {
        className: "ip-route-line",
        weight: 3,
        smoothFactor: 1,
        interactive: false,
      }).addTo(map)
    }
  }, [waypoints, L, isMapReady, zoom])

  // Route coloured by altitude: the same 16-step ramp as the plan page and the globe (.alt-N in globals.css),
  // drawn over the plain line, which is hidden while it is on.
  useEffect(() => {
    const layer = altLayerRef.current
    if (!layer || !L) return
    layer.clearLayers()
    const on = altColours && hasAltitudeData(waypoints)
    const base = routeLineRef.current?.getElement?.()
    if (base) base.style.display = on ? "none" : ""
    if (!on) return
    let run: [number, number][] = []
    let runBucket = -1
    const flush = () => {
      if (run.length > 1) L.polyline(run, { className: `alt-${runBucket}`, weight: 3, interactive: false }).addTo(layer)
    }
    for (let i = 1; i < waypoints.length; i++) {
      const bucket = altitudeBucket((waypoints[i - 1].altitude + waypoints[i].altitude) / 2)
      const a: [number, number] = [waypoints[i - 1].lat, waypoints[i - 1].lng]
      const b: [number, number] = [waypoints[i].lat, waypoints[i].lng]
      if (bucket !== runBucket) {
        flush()
        run = [a]
        runBucket = bucket
      }
      run.push(b)
    }
    flush()
  }, [waypoints, altColours, L, isMapReady])

  // Ground trim preview: each run of waypoints to be removed, plus the kept point next to it, as a dashed grey line.
  const ghostLayerRef = useRef<any>(null)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) return
    if (!ghostLayerRef.current) ghostLayerRef.current = L.layerGroup().addTo(map)
    const layer = ghostLayerRef.current
    layer.clearLayers()
    if (!ghostIds || ghostIds.size === 0) return
    let i = 0
    while (i < waypoints.length) {
      if (!ghostIds.has(waypoints[i].id)) {
        i++
        continue
      }
      let j = i
      while (j + 1 < waypoints.length && ghostIds.has(waypoints[j + 1].id)) j++
      const from = Math.max(0, i - 1)
      const to = Math.min(waypoints.length - 1, j + 1)
      const points = waypoints.slice(from, to + 1).map((wp) => [wp.lat, wp.lng] as [number, number])
      L.polyline(points, { className: "ip-route-casing", weight: 6, interactive: false }).addTo(layer)
      L.polyline(points, { className: "ip-route-ghost", weight: 3, interactive: false }).addTo(layer)
      i = j + 1
    }
  }, [waypoints, ghostIds, L, isMapReady])

  // Zoom to the waypoints of a ground trim (and the kept one beside them), like the Departure / Arrival buttons do.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L || !focus || focus.ids.length === 0) return
    const wanted = new Set(focus.ids)
    const indices = waypoints.map((wp, i) => (wanted.has(wp.id) ? i : -1)).filter((i) => i >= 0)
    if (indices.length === 0) return
    const from = Math.max(0, indices[0] - 1)
    const to = Math.min(waypoints.length - 1, indices[indices.length - 1] + 1)
    const phone = window.innerWidth < 1024
    viewLockedRef.current = true
    map.fitBounds(L.latLngBounds(waypoints.slice(from, to + 1).map((wp) => [wp.lat, wp.lng])), {
      paddingTopLeft: [phone ? 24 : 392, phone ? 80 : 64],
      paddingBottomRight: [phone ? 24 : 80, phone ? 260 : 64],
      maxZoom: 17,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, L, isMapReady])

  // Fit the route when a plan appears or its length changes (not while the person is editing it).
  const fitRoute = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map || !L || waypoints.length === 0) return
    const phone = window.innerWidth < 1024
    map.fitBounds(L.latLngBounds(waypoints.map((wp) => [wp.lat, wp.lng])), {
      paddingTopLeft: [phone ? 24 : 392, phone ? 80 : 64],
      paddingBottomRight: [phone ? 24 : 80, phone ? 220 : 48],
      maxZoom: 12,
    })
  }, [L, waypoints])
  const fitRouteRef = useRef(fitRoute)
  fitRouteRef.current = fitRoute
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || isEditing) return
    if (lastFitCountRef.current === waypoints.length) return
    lastFitCountRef.current = waypoints.length
    if (viewLockedRef.current) return
    fitRouteRef.current()
  }, [waypoints.length, isEditing, isMapReady, zoom])

  // Direction chevrons along the line, from a medium zoom up.
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = chevronLayerRef.current
    if (!map || !L || !layer) return
    layer.clearLayers()
    if (zoom < CHEVRON_MIN_ZOOM || waypoints.length < 2) return
    let carry = CHEVRON_SPACING_PX / 2
    let count = 0
    for (let i = 0; i < waypoints.length - 1 && count < 400; i++) {
      const a = map.latLngToLayerPoint([waypoints[i].lat, waypoints[i].lng])
      const b = map.latLngToLayerPoint([waypoints[i + 1].lat, waypoints[i + 1].lng])
      const length = a.distanceTo(b)
      if (length === 0) continue
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
      for (let d = carry; d < length && count < 400; d += CHEVRON_SPACING_PX) {
        const at = map.layerPointToLatLng(L.point(a.x + ((b.x - a.x) * d) / length, a.y + ((b.y - a.y) * d) / length))
        L.marker(at, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "ip-marker",
            iconSize: [0, 0],
            html: `<div class="ip-chevron" style="transform:translate(-50%,-50%) rotate(${angle}deg)"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 1.5 L7 5 L2.5 8.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`,
          }),
        }).addTo(layer)
        count++
        carry = d + CHEVRON_SPACING_PX - length
      }
      if (carry > length) carry -= length
      else carry = Math.max(0, carry)
    }
  }, [waypoints, zoom, L, isMapReady])

  // Edit mode: a wide invisible line to find the segment under the pointer, for the insert marker.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) return
    const routePoints = waypoints.map((wp) => [wp.lat, wp.lng] as [number, number])

    if (isEditing && !selectMode && waypoints.length > 1) {
      if (hoverLineRef.current) map.removeLayer(hoverLineRef.current)
      hoverLineRef.current = L.polyline(routePoints, {
        color: "transparent",
        weight: 40,
        opacity: 0,
        interactive: true,
      }).addTo(map)
      map.on("mousemove", handleMapMouseMove)
      map.on("mouseout", () => {
        setHoverSegmentIndex(null)
        setHoverPoint(null)
      })
    } else {
      if (hoverLineRef.current) {
        map.removeLayer(hoverLineRef.current)
        hoverLineRef.current = null
      }
      map.off("mousemove", handleMapMouseMove)
      map.off("mouseout")
      setHoverSegmentIndex(null)
      setHoverPoint(null)
    }

    return () => {
      map.off("mousemove", handleMapMouseMove)
      map.off("mouseout")
      if (mouseMoveTimeoutRef.current) clearTimeout(mouseMoveTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, isEditing, selectMode, L, isMapReady])

  // The points: airports are large pills with their ICAO code, the rest small dots. Names show on hover or selection.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !L) return
    const thin = !isEditing && !selectMode && waypoints.length > DECLUTTER_MIN_POINTS
    const step = dotStep(zoom)
    const currentIds = new Set<string>()

    waypoints.forEach((waypoint, index) => {
      currentIds.add(waypoint.id)
      const isFirst = index === 0
      const isLast = index === waypoints.length - 1
      const isAirport = isFirst || isLast
      const hovered = waypoint.id === hoveredId
      const show = !thin || isAirport || waypoint.selected || hovered || index % step === 0

      const ghost = !!ghostIds?.has(waypoint.id)
      const html = isAirport
        ? `<div class="ip-airport ${ghost ? "ip-airport--ghost" : waypoint.selected ? "ip-airport--selected" : isFirst ? "ip-airport--departure" : "ip-airport--arrival"}">${escapeHtml(waypoint.name)}</div>`
        : `<div class="ip-dot${ghost ? " ip-dot--ghost" : waypoint.selected ? " ip-dot--selected" : ""}"></div>`
      const tip = isAirport ? "" : `${escapeHtml(waypoint.name)}${waypoint.altitude > 0 ? ` · ${Math.round(waypoint.altitude)} ft` : ""}`

      let marker = markersRef.current.get(waypoint.id)
      if (!marker) {
        marker = L.marker([waypoint.lat, waypoint.lng], {
          icon: L.divIcon({ className: "ip-marker", iconSize: [0, 0], html }),
          draggable: isEditing && !selectMode,
          zIndexOffset: isAirport ? 500 : 0,
        })
        marker._ipHtml = html

        marker.on("click", () => {
          if (justDraggedIdRef.current === waypoint.id) {
            justDraggedIdRef.current = null
            return
          }
          if (selectModeRef.current) callbacksRef.current.onToggleWaypointSelect?.(waypoint.id)
          else if (!editingRef.current) callbacksRef.current.onWaypointClick?.(waypoint.id)
        })
        marker.on("mouseover", () => callbacksRef.current.onHoverWaypoint?.(waypoint.id))
        marker.on("mouseout", () => callbacksRef.current.onHoverWaypoint?.(null))

        marker.on("drag", (e: any) => {
          const live = waypointsRef.current
          const at = live.findIndex((wp) => wp.id === waypoint.id)
          const latlngs = routeLineRef.current?.getLatLngs()
          if (at < 0 || !latlngs) return
          const next = [...latlngs]
          next[at] = e.latlng
          routeLineRef.current.setLatLngs(next)
          routeCasingRef.current?.setLatLngs(next)
          hoverLineRef.current?.setLatLngs(next)
        })
        marker.on("dragend", (e: any) => {
          const newLatLng = e.target.getLatLng()
          callbacksRef.current.onWaypointDragEnd(waypoint.id, newLatLng.lat, foldLng(newLatLng.lng))
          justDraggedIdRef.current = waypoint.id
        })
        markersRef.current.set(waypoint.id, marker)
      } else {
        marker.setLatLng([waypoint.lat, waypoint.lng])
        if (marker._ipHtml !== html) {
          // A new element replaces the old one: close its tooltip, or it would stay open with no mouseout to end it.
          marker.closeTooltip()
          marker.setIcon(L.divIcon({ className: "ip-marker", iconSize: [0, 0], html }))
          marker._ipHtml = html
        }
      }

      // Dragging repositions single waypoints; in select mode markers can only be selected, not moved.
      if (isEditing && !selectMode) marker.dragging?.enable()
      else marker.dragging?.disable()

      if (tip && !selectMode) {
        if (marker._ipTip !== tip) {
          marker.unbindTooltip()
          marker.bindTooltip(tip, { direction: "top", offset: [0, -10], className: "ip-tip" })
          marker._ipTip = tip
        }
      } else if (marker._ipTip) {
        marker.unbindTooltip()
        marker._ipTip = ""
      }

      if (show && !map.hasLayer(marker)) marker.addTo(map)
      else if (!show && map.hasLayer(marker)) {
        marker.closeTooltip()
        map.removeLayer(marker)
      }

      // Hover is a class on the live element (not part of the icon), so the element under the pointer is never replaced.
      const dot = marker.getElement()?.querySelector(".ip-dot")
      if (dot) dot.classList.toggle("ip-dot--hover", hovered && !waypoint.selected)
    })

    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.closeTooltip()
        map.removeLayer(marker)
        markersRef.current.delete(id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, isEditing, selectMode, zoom, hoveredId, ghostIds, L, isMapReady])

  // Lock panning and zooming while the user is selecting points, so a drag on
  // the map background can't be mistaken for a pan and pinch/scroll can't
  // zoom out from under a selection.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const interactionHandlers = [map.dragging, map.scrollWheelZoom, map.doubleClickZoom, map.touchZoom, map.boxZoom]

    if (selectMode) {
      interactionHandlers.forEach((handler) => handler?.disable())
      map.tap?.disable()
      map.getContainer().style.cursor = "crosshair"
    } else {
      interactionHandlers.forEach((handler) => handler?.enable())
      map.tap?.enable()
      map.getContainer().style.cursor = ""
    }
  }, [selectMode, isMapReady])

  // Rubber-band (marquee) selection: press-and-drag on empty map background
  // draws a rectangle, and releasing selects every waypoint inside it - the
  // same interaction as icon selection in Finder or the marquee tool in
  // Photoshop. Built with raw pointer events (not Leaflet's own drag/click)
  // since Leaflet's dragging is disabled in select mode and this needs to
  // work uniformly for mouse and touch.
  useEffect(() => {
    const container = mapRef.current
    const map = mapInstanceRef.current
    if (!container || !map || !L || !selectMode) return

    container.style.touchAction = "none"

    const box = document.createElement("div")
    box.style.position = "absolute"
    box.style.border = `1.5px dashed ${SELECTION_COLOR}`
    box.style.backgroundColor = "rgba(234, 88, 12, 0.15)"
    box.style.pointerEvents = "none"
    box.style.zIndex = "1000"
    box.style.display = "none"
    container.appendChild(box)
    selectionBoxRef.current = box

    const DRAG_THRESHOLD = 4
    let state: { startX: number; startY: number; additive: boolean; pointerId: number } | null = null

    const isOnMarkerOrControl = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(".leaflet-marker-icon, .leaflet-control, .leaflet-popup")

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return
      if (isOnMarkerOrControl(e.target)) return
      const rect = container.getBoundingClientRect()
      state = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        additive: e.shiftKey,
        pointerId: e.pointerId,
      }
      container.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!state) return
      const rect = container.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top

      if (box.style.display === "none") {
        if (Math.abs(currentX - state.startX) < DRAG_THRESHOLD && Math.abs(currentY - state.startY) < DRAG_THRESHOLD) {
          return
        }
        box.style.display = "block"
      }

      const left = Math.min(state.startX, currentX)
      const top = Math.min(state.startY, currentY)
      box.style.left = `${left}px`
      box.style.top = `${top}px`
      box.style.width = `${Math.abs(currentX - state.startX)}px`
      box.style.height = `${Math.abs(currentY - state.startY)}px`
    }

    const finishMarquee = () => {
      if (!state) return
      if (box.style.display === "block") {
        const minX = Number.parseFloat(box.style.left)
        const minY = Number.parseFloat(box.style.top)
        const maxX = minX + Number.parseFloat(box.style.width)
        const maxY = minY + Number.parseFloat(box.style.height)

        const idsInBox = waypointsRef.current
          .filter((wp) => {
            const point = map.latLngToContainerPoint(L.latLng(wp.lat, wp.lng))
            return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
          })
          .map((wp) => wp.id)

        onWaypointsMarqueeSelect?.(idsInBox, state.additive)
      }
      box.style.display = "none"
      container.releasePointerCapture?.(state.pointerId)
      state = null
    }

    const onPointerUp = (e: PointerEvent) => finishMarquee()
    const onPointerCancel = () => {
      box.style.display = "none"
      state = null
    }

    container.addEventListener("pointerdown", onPointerDown)
    container.addEventListener("pointermove", onPointerMove)
    container.addEventListener("pointerup", onPointerUp)
    container.addEventListener("pointercancel", onPointerCancel)

    return () => {
      container.removeEventListener("pointerdown", onPointerDown)
      container.removeEventListener("pointermove", onPointerMove)
      container.removeEventListener("pointerup", onPointerUp)
      container.removeEventListener("pointercancel", onPointerCancel)
      container.style.touchAction = ""
      if (selectionBoxRef.current && container.contains(selectionBoxRef.current)) {
        container.removeChild(selectionBoxRef.current)
      }
      selectionBoxRef.current = null
    }
  }, [selectMode, isMapReady, onWaypointsMarqueeSelect, L])

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
      const insertIcon = L.divIcon({
        className: "ip-marker",
        iconSize: [0, 0],
        html: `<div style="display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:9999px;background:#10b981;color:#fff;box-shadow:0 0 0 2px #fff,0 2px 6px rgb(0 0 0/.3);cursor:pointer"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>`,
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
      <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        {copy.editor.mapLoading}
      </div>
    )
  }

  const selectedCount = waypoints.filter((wp) => wp.selected).length
  const toolButton =
    "flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"

  return (
    <div className="ip-map relative h-full w-full" data-basemap={basemapTone(basemap)}>
      <div ref={mapRef} className="h-full w-full" />

      {/* Select mode status banner - explains the locked pan/zoom and current selection */}
      {selectMode && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg sm:gap-2 sm:text-sm"
          style={{ backgroundColor: SELECTION_COLOR }}
        >
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>Drag to select</span>
          {selectedCount > 0 && (
            <>
              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5">{selectedCount} selected</span>
              <button
                type="button"
                onClick={onClearSelection}
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Toolbar, top right: the editing buttons, then the zoom tools (pan and zoom are locked in select mode) */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2 sm:right-4 sm:top-4">
        {toolbarLeading}
        {!selectMode && waypoints.length > 0 && (
          <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-md">
            <button type="button" className={toolButton} onClick={() => {
                viewLockedRef.current = false
                fitRoute()
              }} title={copy.editor.fitRoute} aria-label={copy.editor.fitRoute}>
              <Globe className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={toolButton} title={copy.editor.mapStyle} aria-label={copy.editor.mapStyle}>
                  <Layers className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[1100] w-52">
                <DropdownMenuLabel>{copy.editor.mapStyle}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={basemapChoice}
                  onValueChange={(value) => {
                    setBasemapChoice(value as BasemapChoice)
                    saveBasemapChoice(value as BasemapChoice)
                  }}
                >
                  {BASEMAP_CHOICES.map((choice) => (
                    <DropdownMenuRadioItem key={choice} value={choice}>
                      {{ auto: copy.editor.styleAuto, light: copy.editor.styleLight, dark: copy.editor.styleDark, colour: copy.editor.styleColour }[choice]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={altColours}
                  onCheckedChange={(checked) => {
                    setAltColours(!!checked)
                    try {
                      window.localStorage.setItem("infinite-planner:alt-colours", checked ? "1" : "0")
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {copy.editor.altitudeColours}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" className={toolButton} onClick={() => mapInstanceRef.current?.zoomIn()} title={copy.editor.zoomIn} aria-label={copy.editor.zoomIn}>
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" className={toolButton} onClick={() => mapInstanceRef.current?.zoomOut()} title={copy.editor.zoomOut} aria-label={copy.editor.zoomOut}>
              <Minus className="h-4 w-4" />
            </button>
            {waypoints.length > 1 && (
              <>
                <button type="button" className={toolButton} onClick={zoomToDeparture} title={copy.editor.zoomToDeparture} aria-label={copy.editor.zoomToDeparture}>
                  <PlaneTakeoff className="h-4 w-4" />
                </button>
                <button type="button" className={toolButton} onClick={zoomToArrival} title={copy.editor.zoomToArrival} aria-label={copy.editor.zoomToArrival}>
                  <PlaneLanding className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
