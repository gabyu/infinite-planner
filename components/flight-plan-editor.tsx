"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Download,
  Upload,
  Trash2,
  Map,
  CheckCircle2,
  Layers,
  Pencil,
  ChevronLeft,
  HelpCircle,
  LassoSelect,
  AlertCircle,
  Info,
  History,
  Share2,
  RotateCcw,
} from "lucide-react"
import { parseKML } from "@/lib/kml-parser"
import { generateFPL, fplFileName } from "@/lib/fpl-generator"
import { parseFlightFilename, saveFlightData } from "@/lib/flight-stats-service"
import { BRAND_NAMES, BRANDING_MIN_WAYPOINTS, type FlightPlanSource } from "@/lib/flight-plans"
import { ShareDialog } from "@/components/share-dialog"
import { RouteArrow } from "@/components/route-arrow"
import { FlightTimeField } from "@/components/flight-time-field"
import { Checkbox } from "@/components/ui/checkbox"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { useAuthUser } from "@/hooks/use-auth-user"
import { sampleCubicBezier } from "@/lib/bezier"
import { WaypointTable } from "@/components/waypoint-table"
import { DrawingBoard } from "@/components/drawing-board"
import { useHistoryState } from "@/hooks/use-history-state"
import { useIsTouchPrimary } from "@/hooks/use-is-touch-primary"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { Toaster } from "@/components/ui/toaster"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/admin/page-header"

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapPreview = dynamic(() => import("@/components/map-preview-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">Loading map...</div>
  ),
})

interface LatLngPoint {
  lat: number
  lng: number
}

// Type for waypoints
interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
  locked?: boolean
  // Set on the four MADE/WITH/INFINITE/PLANNER waypoints, with the name each one
  // had before so unticking the branding checkbox restores it instead of resetting
  // every name in the plan.
  branded?: boolean
  unbrandedName?: string
  // Only set on waypoints placed with the pen tool that had their curve
  // handles dragged out - undefined/null means a plain corner point.
  handleOut?: LatLngPoint | null
  handleIn?: LatLngPoint | null
}

// Bookkeeping for a pen-drawn curve segment between two anchor waypoints, so
// a later handle or anchor edit can regenerate just its interior samples.
interface CurveSegment {
  startId: string
  endId: string
  sampleIds: string[]
}

interface SimplificationInfo {
  originalCount: number
  simplifiedCount: number
  reason: string
  source?: string
}

const DRAFT_STORAGE_KEY = "infinite-planner:draft-flightplan"

// The branding block is the four waypoints just before the destination.
function isBrandingSlot(index: number, total: number) {
  return total >= BRANDING_MIN_WAYPOINTS && index >= total - 5 && index <= total - 2
}

// Puts the MADE/WITH/INFINITE/PLANNER block on (or takes it off) without touching any other
// name. Idempotent: it first restores every branded waypoint, then re-brands the current
// last-four-before-the-destination, so it also repairs a block that edits have shifted.
function applyBrandingOverlay(waypoints: Waypoint[], include: boolean): Waypoint[] {
  const restored = waypoints.map((wp, index) =>
    wp.branded
      ? { ...wp, name: wp.unbrandedName ?? String(index).padStart(3, "0"), locked: false, branded: false, unbrandedName: undefined }
      : wp,
  )
  if (!include) return restored
  return restored.map((wp, index) =>
    isBrandingSlot(index, restored.length)
      ? { ...wp, unbrandedName: wp.name, name: BRAND_NAMES[index - (restored.length - 5)], locked: true, branded: true }
      : wp,
  )
}

// Recomputes the interior sample waypoints of a curve segment from its
// current anchor positions/handles, replacing them in place by id. Bails out
// (returns the array unchanged) if either anchor is gone or the sample count
// has drifted (e.g. the user deleted one directly) - a documented scope cut
// rather than full path-topology repair.
function regenerateSegmentSamples(waypoints: Waypoint[], segment: CurveSegment): Waypoint[] {
  const start = waypoints.find((wp) => wp.id === segment.startId)
  const end = waypoints.find((wp) => wp.id === segment.endId)
  if (!start || !end) return waypoints

  const p0 = { lat: start.lat, lng: start.lng }
  const p1 = start.handleOut ?? p0
  const p2 = end.handleIn ?? { lat: end.lat, lng: end.lng }
  const p3 = { lat: end.lat, lng: end.lng }
  const freshPoints = sampleCubicBezier(p0, p1, p2, p3).slice(0, -1)

  if (freshPoints.length !== segment.sampleIds.length) return waypoints

  // globalThis.Map to avoid colliding with the "Map" icon imported from lucide-react above.
  const positionById = new globalThis.Map(segment.sampleIds.map((id, i) => [id, freshPoints[i]]))
  return waypoints.map((wp) => {
    const pos = positionById.get(wp.id)
    return pos ? { ...wp, lat: pos.lat, lng: pos.lng } : wp
  })
}

interface FlightPlanEditorProps {
  // Which dedicated route this instance backs: /convert (KML import) or
  // /sketch (draw from scratch). The chooser between the two now lives on
  // the homepage, not inside this component.
  initialMode: "import" | "draw"
}

export function FlightPlanEditor({ initialMode }: FlightPlanEditorProps) {
  const mode = initialMode
  const [waypoints, setWaypoints, waypointsHistory] = useHistoryState<Waypoint[]>([])
  const [curveSegments, setCurveSegments] = useState<CurveSegment[]>([])
  const waypointsRef = useRef(waypoints)
  useEffect(() => {
    waypointsRef.current = waypoints
  }, [waypoints])
  const curveSegmentsRef = useRef(curveSegments)
  useEffect(() => {
    curveSegmentsRef.current = curveSegments
  }, [curveSegments])
  const isTouchPrimary = useIsTouchPrimary()
  const [simplificationInfo, setSimplificationInfo] = useState<SimplificationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [showMapPreview, setShowMapPreview] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [waypointPrefix, setWaypointPrefix] = useState("")
  const [importedFileName, setImportedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const txtFileInputRef = useRef<HTMLInputElement>(null)
  const { theme } = useTheme()
  const [isMobile, setIsMobile] = useState(false)
  const [originAirport, setOriginAirport] = useState("")
  const [destinationAirport, setDestinationToAirport] = useState("")
  // One checkbox for Sketch and Convert, ticked by default: whether the MADE/WITH/INFINITE/PLANNER
  // waypoints go into the exported (and saved) plan. Needs BRANDING_MIN_WAYPOINTS waypoints to apply.
  const [includeBranding, setIncludeBranding] = useState(true)
  const [flightTimeMinutes, setFlightTimeMinutes] = useState<number | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [isPreparingShare, setIsPreparingShare] = useState(false)
  // Share link of the plan this session saved, if it is being shared (null = not shared).
  const [planShareToken, setPlanShareToken] = useState<string | null>(null)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)
  const [importSource, setImportSource] = useState<FlightPlanSource | null>(null)
  // The history row this editing session has already saved to: exporting again updates it
  // instead of piling up near-identical entries. Cleared when a new plan is started.
  const savedPlanIdRef = useRef<string | null>(null)
  const { user: authUser, ready: authReady, available: authAvailable } = useAuthUser()
  const [isEditingMap, setIsEditingMap] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [icaoValidation, setIcaoValidation] = useState({
    origin: false,
    destination: false,
  })
  const [hasImported, setHasImported] = useState(false)
  const [showOptionsPanel, setShowOptionsPanel] = useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [showOptions, setShowOptions] = useState(false) // Added state for options panel visibility

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Draw mode: silently restore a saved draft when entering an empty drawing
  // board, and autosave (debounced) while drawing - local-only, MVP scope.
  useEffect(() => {
    if (mode !== "draw" || waypoints.length > 0) return
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as {
        waypoints?: Waypoint[]
        originAirport?: string
        destinationAirport?: string
      }
      if (draft.waypoints && draft.waypoints.length > 0) {
        setWaypoints(draft.waypoints)
        if (draft.originAirport) handleICAOChange("origin", draft.originAirport)
        if (draft.destinationAirport) handleICAOChange("destination", draft.destinationAirport)
      }
    } catch {
      // Corrupt or unavailable draft - ignore, user just starts fresh.
    }
    // Only attempt this once, right when the drawing board opens empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    if (mode !== "draw") return
    const timeout = setTimeout(() => {
      try {
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ waypoints, originAirport, destinationAirport }),
        )
      } catch {
        // localStorage unavailable (private browsing, quota, etc.) - autosave is best-effort.
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [mode, waypoints, originAirport, destinationAirport])

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Validate the flight plan when waypoints change - REMOVED WARNING LOGIC
  useEffect(() => {
    // Validation removed as requested
    setWarning(null)
  }, [waypoints])

  // Apply naming rules (locks first/last to origin/destination) whenever the
  // airports change. Works from 2 waypoints so the draw flow's origin/destination
  // fields also lock the endpoint names. The branding checkbox is NOT a dependency:
  // toggling it goes through applyBrandingOverlay, which leaves every other name alone.
  useEffect(() => {
    if (waypoints.length >= 2) {
      const updatedWaypoints = applyWaypointNamingRules(waypoints, originAirport, destinationAirport, includeBranding)
      setWaypoints(updatedWaypoints)
    }
  }, [originAirport, destinationAirport, mode])

  // Handle focus event to select all text in the input field
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  // Handle tab key navigation for waypoint names
  const handleTabKeyNavigation = (
    e: React.KeyboardEvent<HTMLInputElement>,
    waypointId: string,
    fieldName: keyof Waypoint,
  ) => {
    if (e.key === "Tab" && !e.shiftKey && fieldName === "name") {
      e.preventDefault()

      const currentIndex = waypoints.findIndex((wp) => wp.id === waypointId)

      if (currentIndex < waypoints.length - 1) {
        const nextWaypointId = waypoints[currentIndex + 1].id
        const nextInput = document.getElementById(`name-${nextWaypointId}`)
        if (nextInput) {
          nextInput.focus()
        }
      }
    }
  }

  // Calculate distance between two points in kilometers (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180)
  }

  // Handle KML file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setWarning(null)
    setSuccessMessage(null)

    const fileName = file.name.replace(/\.[^/.]+$/, "")
    setImportedFileName(fileName)

    const currentOrigin = originAirport.trim()
    const currentDestination = destinationAirport.trim()

    const flightAwareMatch = fileName.match(/FlightAware_[^_]+_([A-Z]{4})_([A-Z]{4})_/)
    if (flightAwareMatch) {
      const extractedOrigin = flightAwareMatch[1]
      const extractedDestination = flightAwareMatch[2]

      setOriginAirport(extractedOrigin)
      setDestinationToAirport(extractedDestination)

      await processKMLFile(file, fileName, extractedOrigin, extractedDestination)
    } else {
      await processKMLFile(file, fileName, currentOrigin, currentDestination)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Separate function to process the KML file
  const processKMLFile = async (file: File, fileName: string, origin: string, destination: string) => {
    try {
      const text = await file.text()

      const result = parseKML(text, file.name, origin, destination)

      if (result.waypoints.length === 0) {
        setError("No valid waypoints found in the KML file. Please check the file format.")
      } else {
        const renamedWaypoints = applyWaypointNamingRules(result.waypoints, origin, destination, includeBranding)
        setWaypoints(renamedWaypoints)
        // A new import is a new plan: it must not overwrite the one saved from the previous import.
        savedPlanIdRef.current = null
        setSavedPlanId(null)
        setPlanShareToken(null)
        setImportSource(result.source === "FlightAware" || result.source === "FlightRadar24" ? result.source : null)
        setSimplificationInfo({
          originalCount: result.originalCount,
          simplifiedCount: result.simplifiedCount,
          reason: result.simplificationReason,
          source: result.source,
        })

        // Set hasImported to true to reveal the rest of the UI
        setHasImported(true)

        if (renamedWaypoints.length > 0) {
          setShowMapPreview(true)
        }

        setSuccessMessage(
          `Successfully imported ${renamedWaypoints.length} waypoints from ${result.source || "KML file"}`,
        )
      }
    } catch (error) {
      console.error("Error importing KML file:", error)
      setError(`Error importing KML file: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle TXT file import for waypoint names
  const handleTxtImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || waypoints.length === 0) return

    setError(null)
    setWarning(null)
    setSuccessMessage(null)

    try {
      const text = await file.text()

      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")

      const updatedWaypoints = [...waypoints]

      for (let i = 0; i < updatedWaypoints.length; i++) {
        if (updatedWaypoints[i].branded) {
          // Keeps its branding name; the imported one is what unticking the checkbox restores.
          updatedWaypoints[i] = { ...updatedWaypoints[i], unbrandedName: i < lines.length ? lines[i].trim() : "" }
        } else if (i < lines.length && !updatedWaypoints[i].locked) {
          updatedWaypoints[i] = {
            ...updatedWaypoints[i],
            name: lines[i].trim(),
          }
        } else if (i >= lines.length) {
          updatedWaypoints[i] = {
            ...updatedWaypoints[i],
            name: updatedWaypoints[i].locked ? updatedWaypoints[i].name : "",
          }
        }
      }

      setWaypoints(updatedWaypoints)

      if (lines.length > waypoints.length) {
        setWarning(
          `The text file contains ${lines.length} lines, but there are only ${waypoints.length} waypoints. Some lines were not used.`,
        )
      }

      setSuccessMessage(
        `Successfully imported ${Math.min(lines.length, waypoints.length)} waypoint names from text file.`,
      )
    } catch (error) {
      console.error("Error importing TXT file:", error)
      setError(`Error importing TXT file: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (txtFileInputRef.current) {
      txtFileInputRef.current.value = ""
    }
  }

  // Export button (table bar and options panel): exports straight away, with the branding and
  // flight-time options as they currently are on the page.
  const handleExportFPL = () => {
    if (waypoints.length === 0) {
      setError("No waypoints to export")
      return
    }
    performExport()
  }

  // The flight number the KML's filename reliably carries (FlightAware: FlightAware_KLM605_EHAM_KSFO_20260526,
  // FlightRadar24: AF186-41db2d6c), else null. parseFlightFilename sets `source` only for those two
  // strict patterns, so a looser guess never counts. Shown on the page and saved with the plan.
  const detectedFlightNumber = (() => {
    if (mode !== "import" || !importedFileName) return null
    const parsed = parseFlightFilename(importedFileName)
    return parsed.source ? (parsed.flight_number?.toUpperCase() ?? null) : null
  })()

  // Saves the plan to the signed-in user's history: the first export of this editing
  // session creates the entry, later ones update it. Nothing happens when signed out.
  const saveToHistory = async (finalWaypoints: Waypoint[], effectiveBranding: boolean): Promise<string | null> => {
    const source: FlightPlanSource | null = mode === "draw" ? "Sketch" : importSource
    if (!source) return "This plan's source couldn't be determined."

    const body = JSON.stringify({
      source,
      flightNumber: detectedFlightNumber,
      origin: originAirport,
      destination: destinationAirport,
      waypoints: finalWaypoints.map(({ name, lat, lng, altitude }) => ({ name, lat, lng, altitude })),
      includesBranding: effectiveBranding,
      flightTimeMinutes,
    })

    const send = (url: string, method: "POST" | "PUT") =>
      fetch(url, { method, headers: { "Content-Type": "application/json" }, body })

    try {
      let response = savedPlanIdRef.current
        ? await send(`/api/flight-plans/${savedPlanIdRef.current}`, "PUT")
        : await send("/api/flight-plans", "POST")
      // The entry was deleted from the history in the meantime: save it as a new one.
      if (response.status === 404 && savedPlanIdRef.current) {
        savedPlanIdRef.current = null
        setPlanShareToken(null)
        response = await send("/api/flight-plans", "POST")
      }
      const result = await response.json().catch(() => null)
      if (!response.ok) return result?.error ?? "Couldn't save the flight plan."
      savedPlanIdRef.current = result.id
      setSavedPlanId(result.id)
      return null
    } catch (saveError) {
      console.error("Error saving flight plan to history:", saveError)
      return "Couldn't reach the server."
    }
  }

  // Downloads the FPL and, when signed in, saves the plan to the history.
  const performExport = async () => {
    setError(null)
    setSuccessMessage(null)

    // Whatever the checkbox says is what gets exported AND stored, applied to the waypoints
    // as they are right now (this also repairs a branding block that edits had shifted).
    const finalWaypoints = applyBrandingOverlay(waypoints, includeBranding)
    const effectiveBranding = includeBranding && finalWaypoints.length >= BRANDING_MIN_WAYPOINTS
    if (finalWaypoints.some((wp, i) => wp.name !== waypoints[i].name || wp.locked !== waypoints[i].locked)) {
      setWaypoints(finalWaypoints)
    }

    try {
      const fplContent = generateFPL(finalWaypoints)
      const blob = new Blob([fplContent], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      const fileName = fplFileName(originAirport, destinationAirport)
      a.download = fileName

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // The import flow already records flight_number/origin/destination via
      // saveFlightData() at import time (lib/kml-parser.ts), which is both
      // what feeds "Popular Airports"/"Popular Flights"/"Unique Airports" on
      // the homepage AND what increments the total flight count (all of
      // these read row counts/aggregates from the same flight_statistics
      // table). Drawn plans never went through that path, so they never
      // showed up anywhere - not the homepage stats, not the total counter -
      // even though the export button here used to also POST to
      // /api/counter: that route only ever inserted `{created_at}`, which
      // violates the table's `filename NOT NULL` constraint and has been
      // silently failing on every single export (both flows) - it just never
      // mattered for the import flow because saveFlightData's import-time
      // insert was already the thing incrementing the count. Removed rather
      // than fixed in place, since a working version of it would double-count
      // every KML import (once at import time, once again here at export).
      if (mode === "draw") {
        saveFlightData({
          origin_airport: originAirport,
          destination_airport: destinationAirport,
          filename: fileName,
          source: "DrawingBoard",
        }).catch((dataError) => {
          console.error("Error saving drawn flight data:", dataError)
        })
      }

      if (!authUser) {
        setSuccessMessage(`Flight plan exported as ${fileName}!`)
        return
      }

      const saveError = await saveToHistory(finalWaypoints, effectiveBranding)
      if (saveError) {
        setError(`Exported as ${fileName}, but it wasn't saved to your history: ${saveError}`)
      } else {
        setSuccessMessage(`Flight plan exported as ${fileName} and saved to your history.`)
      }
    } catch (error) {
      console.error("Error exporting FPL file:", error)
      setError(`Error exporting FPL file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Update waypoint field
  const updateWaypoint = (id: string, field: keyof Waypoint, value: string | number) => {
    setWaypoints(
      waypoints.map((wp) =>
        wp.id === id && !wp.locked ? { ...wp, [field]: typeof value === "string" ? value : Number(value) } : wp,
      ),
    )
  }

  // Toggle waypoint selection with shift+click support
  const handleRowClick = (e: React.MouseEvent, id: string, index: number) => {
    // Prevent if clicking on input fields
    if ((e.target as HTMLElement).tagName === "INPUT") {
      return
    }

    if (e.shiftKey && lastSelectedIndex !== null) {
      // Shift+click: select range
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)

      setWaypoints(
        waypoints.map((wp, idx) => {
          if (idx >= start && idx <= end) {
            return { ...wp, selected: true }
          }
          return wp
        }),
      )
    } else {
      // Normal click: toggle single
      setWaypoints(waypoints.map((wp) => (wp.id === id ? { ...wp, selected: !wp.selected } : wp)))
      setLastSelectedIndex(index)
    }
  }

  // Delete selected waypoints
  const deleteSelectedWaypoints = () => {
    const selectedCount = waypoints.filter((wp) => wp.selected).length

    if (selectedCount === 0) {
      setError("No waypoints selected for deletion")
      return
    }

    const filtered = waypoints.filter((wp) => !wp.selected)
    // In draw mode, re-run naming so the branding block follows the new last waypoints
    // (or drops away if the route is now too short for it).
    const newWaypoints =
      mode === "draw" ? applyWaypointNamingRules(filtered, originAirport, destinationAirport, includeBranding) : filtered

    setWaypoints(newWaypoints)
    setSuccessMessage(`${selectedCount} waypoint${selectedCount !== 1 ? "s" : ""} removed successfully!`)
  }

  // Clear altitudes of selected waypoints
  const clearSelectedAltitudes = () => {
    const selectedCount = waypoints.filter((wp) => wp.selected).length

    if (selectedCount === 0) {
      setError("No waypoints selected to clear altitudes.")
      return
    }

    const updatedWaypoints = waypoints.map((wp) => (wp.selected ? { ...wp, altitude: 0 } : wp))
    setWaypoints(updatedWaypoints)
    setSuccessMessage(`Cleared altitude for ${selectedCount} selected waypoint${selectedCount !== 1 ? "s" : ""}.`)
  }

  // Select/deselect all waypoints
  const toggleSelectAll = (checked: boolean) => {
    setWaypoints(waypoints.map((wp) => ({ ...wp, selected: checked })))
  }

  // Apply prefix to all waypoint names
  const applyWaypointPrefix = () => {
    if (waypoints.length === 0) {
      setError("No waypoints to rename")
      return
    }

    const renamedWaypoints = waypoints.map((wp, index) => {
      const prefixed = `${waypointPrefix}${String(index).padStart(3, "0")}`
      // A branded waypoint keeps its MADE/WITH/... name, but remembers the prefixed one for
      // when the branding checkbox is unticked.
      if (wp.branded) return { ...wp, unbrandedName: prefixed }
      if (wp.locked) return wp

      return {
        ...wp,
        name: prefixed,
      }
    })

    setWaypoints(renamedWaypoints)
    setSuccessMessage(`Prefix "${waypointPrefix}" applied to unlocked waypoints!`)
  }

  // Callback for when a waypoint is dragged on the map. If the waypoint
  // carries pen-tool curve handles, they're translated by the same delta
  // (so the curve's shape follows the anchor), and any adjoining curve
  // segments are resampled in place. Uses refs rather than a functional
  // setWaypoints update so the curveSegments read stays outside the state
  // updater (which React may invoke more than once).
  const handleWaypointDragEnd = useCallback((id: string, newLat: number, newLng: number) => {
    const prevWaypoints = waypointsRef.current
    const target = prevWaypoints.find((wp) => wp.id === id)
    if (!target) return
    const deltaLat = newLat - target.lat
    const deltaLng = newLng - target.lng

    let updated = prevWaypoints.map((wp) =>
      wp.id === id
        ? {
            ...wp,
            lat: newLat,
            lng: newLng,
            altitude: 0,
            handleOut: wp.handleOut ? { lat: wp.handleOut.lat + deltaLat, lng: wp.handleOut.lng + deltaLng } : wp.handleOut,
            handleIn: wp.handleIn ? { lat: wp.handleIn.lat + deltaLat, lng: wp.handleIn.lng + deltaLng } : wp.handleIn,
          }
        : wp,
    )

    curveSegmentsRef.current
      .filter((segment) => segment.startId === id || segment.endId === id)
      .forEach((segment) => {
        updated = regenerateSegmentSamples(updated, segment)
      })

    setWaypoints(updated)
    setSuccessMessage(`Waypoint ${target.name} updated on map. Altitude cleared.`)
  }, [])

  // Callback for when a pen-tool curve handle is dragged under the Select
  // tool - updates the handle, then resamples the one segment it controls.
  const handleHandleDragEnd = useCallback(
    (anchorId: string, which: "handleOut" | "handleIn", newPoint: LatLngPoint) => {
      const prevWaypoints = waypointsRef.current
      let updated = prevWaypoints.map((wp) => (wp.id === anchorId ? { ...wp, [which]: newPoint } : wp))

      curveSegmentsRef.current
        .filter((segment) => (which === "handleOut" ? segment.startId === anchorId : segment.endId === anchorId))
        .forEach((segment) => {
          updated = regenerateSegmentSamples(updated, segment)
        })

      setWaypoints(updated)
    },
    [],
  )

  // Callback for when a waypoint is inserted on the map
  const handleWaypointInsert = useCallback((afterIndex: number, lat: number, lng: number) => {
    setWaypoints((prevWaypoints) => {
      const newWaypoint: Waypoint = {
        id: `${Date.now()}-map-insert`,
        name: "",
        lat,
        lng,
        altitude: 0,
        selected: false,
      }

      const newWaypoints = [...prevWaypoints]
      newWaypoints.splice(afterIndex + 1, 0, newWaypoint)

      setSuccessMessage(
        `New waypoint inserted between ${prevWaypoints[afterIndex]?.name || "waypoint"} and ${prevWaypoints[afterIndex + 1]?.name || "waypoint"}`,
      )
      return newWaypoints
    })
  }, [])

  // Appends one or more points drawn on the drawing board (a single line-tool
  // click, or a whole baked curve) as one atomic waypoint-list update, so a
  // curve segment is a single undo step.
  const handleAddDrawnPoints = useCallback((points: { lat: number; lng: number }[]) => {
    setWaypoints((prevWaypoints) => {
      const newWaypoints: Waypoint[] = [
        ...prevWaypoints,
        ...points.map((point, offset) => ({
          id: `${Date.now()}-draw-${prevWaypoints.length + offset}`,
          name: String(prevWaypoints.length + offset).padStart(3, "0"),
          lat: point.lat,
          lng: point.lng,
          altitude: 0,
          selected: false,
        })),
      ]
      return applyWaypointNamingRules(newWaypoints, originAirport, destinationAirport, includeBranding)
    })
  }, [originAirport, destinationAirport, includeBranding])

  // Commits a pen-tool anchor (a plain click, or a click-and-drag that pulled
  // out curve handles). If a previous waypoint exists and either side has a
  // handle, samples a cubic bezier between them and inserts the interior
  // points, recording a CurveSegment so a later handle/anchor edit can
  // regenerate them. Reads from refs (not a setWaypoints updater) so the
  // paired setCurveSegments call never lands inside another state updater.
  const handleCommitPenAnchor = useCallback(
    (anchor: { lat: number; lng: number; handleOut: LatLngPoint | null; handleIn: LatLngPoint | null }) => {
      const prevWaypoints = waypointsRef.current
      const prevPoint = prevWaypoints[prevWaypoints.length - 1]
      const newAnchorId = `${Date.now()}-pen-${prevWaypoints.length}`

      let interiorWaypoints: Waypoint[] = []
      const isStraight = !prevPoint?.handleOut && !anchor.handleIn
      if (prevPoint && !isStraight) {
        const p0 = { lat: prevPoint.lat, lng: prevPoint.lng }
        const p1 = prevPoint.handleOut ?? p0
        const p2 = anchor.handleIn ?? { lat: anchor.lat, lng: anchor.lng }
        const p3 = { lat: anchor.lat, lng: anchor.lng }
        interiorWaypoints = sampleCubicBezier(p0, p1, p2, p3)
          .slice(0, -1)
          .map((point, offset) => ({
            id: `${newAnchorId}-sample-${offset}`,
            name: "",
            lat: point.lat,
            lng: point.lng,
            altitude: 0,
            selected: false,
          }))
      }

      const newAnchor: Waypoint = {
        id: newAnchorId,
        name: "",
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: 0,
        selected: false,
        handleOut: anchor.handleOut,
        handleIn: anchor.handleIn,
      }

      const newWaypoints = applyWaypointNamingRules(
        [...prevWaypoints, ...interiorWaypoints, newAnchor],
        originAirport,
        destinationAirport,
        includeBranding,
      )
      setWaypoints(newWaypoints)

      if (interiorWaypoints.length > 0 && prevPoint) {
        setCurveSegments((prevSegments) => [
          ...prevSegments,
          { startId: prevPoint.id, endId: newAnchorId, sampleIds: interiorWaypoints.map((w) => w.id) },
        ])
      }
    },
    [originAirport, destinationAirport, includeBranding],
  )

  // Clears the entire drawing board. What gets drawn next is a new plan.
  const clearDrawing = useCallback(() => {
    setWaypoints([])
    setCurveSegments([])
    savedPlanIdRef.current = null
    setSavedPlanId(null)
    setPlanShareToken(null)
  }, [])

  // Toggle a single waypoint's selection from the map (select mode)
  const toggleWaypointSelection = useCallback((id: string) => {
    setWaypoints((prevWaypoints) => prevWaypoints.map((wp) => (wp.id === id ? { ...wp, selected: !wp.selected } : wp)))
  }, [])

  // Callback for the map's marquee (rubber-band) selection: replaces the
  // selection with the given ids, unless additive (Shift-drag), which only
  // adds them without clearing what was already selected.
  const handleMarqueeSelect = useCallback((ids: string[], additive: boolean) => {
    const idSet = new Set(ids)
    setWaypoints((prevWaypoints) =>
      prevWaypoints.map((wp) => {
        if (additive) {
          return idSet.has(wp.id) ? { ...wp, selected: true } : wp
        }
        return { ...wp, selected: idSet.has(wp.id) }
      }),
    )
  }, [])

  // Clears the map's current point selection (the pill's "Clear selection")
  const handleClearMapSelection = useCallback(() => {
    setWaypoints((prevWaypoints) => prevWaypoints.map((wp) => (wp.selected ? { ...wp, selected: false } : wp)))
  }, [])

  // Toggle map editing mode
  const toggleMapEditing = () => {
    setIsEditingMap((prev) => {
      const newEditingState = !prev

      if (newEditingState) {
        setSuccessMessage(
          "Map editing mode enabled. Drag waypoints to adjust their position or hover over the route to add new waypoints.",
        )
      } else {
        const updatedWaypoints = applyWaypointNamingRules(waypoints, originAirport, destinationAirport, includeBranding)
        setWaypoints(updatedWaypoints)
        setSuccessMessage("Map editing mode disabled. Waypoint names updated according to rules.")
        setSelectMode(false)
      }

      return newEditingState
    })
  }

  // Toggle point-selection mode on the map (locks pan/zoom, click-to-select points)
  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      const next = !prev
      setSuccessMessage(
        next
          ? "Select mode enabled. Pan and zoom are locked — tap points to select them, then drag any selected point to move the group."
          : "Select mode disabled.",
      )
      return next
    })
  }

  const validateICAO = (code: string): boolean => {
    return /^[A-Z]{4}$/.test(code.toUpperCase())
  }

  const handleICAOChange = (field: "origin" | "destination", value: string) => {
    const upperValue = value.toUpperCase()
    const isValid = validateICAO(upperValue)

    if (field === "origin") {
      setOriginAirport(upperValue)
      setIcaoValidation((prev) => ({ ...prev, origin: isValid }))
    } else {
      setDestinationToAirport(upperValue)
      setIcaoValidation((prev) => ({ ...prev, destination: isValid }))
    }
  }

  // Share: saves the plan to the history first (updating it if this session already saved it, so
  // the live link serves what is on screen now), then opens the share modal.
  const handleShare = async () => {
    if (waypoints.length < 2) {
      setError("Add at least 2 waypoints before sharing.")
      return
    }
    if (mode === "draw" && exportBlockReason) {
      setError(exportBlockReason)
      return
    }
    setError(null)
    setSuccessMessage(null)
    setIsPreparingShare(true)

    const finalWaypoints = applyBrandingOverlay(waypoints, includeBranding)
    if (finalWaypoints.some((wp, i) => wp.name !== waypoints[i].name || wp.locked !== waypoints[i].locked)) {
      setWaypoints(finalWaypoints)
    }
    const effectiveBranding = includeBranding && finalWaypoints.length >= BRANDING_MIN_WAYPOINTS

    const saveError = await saveToHistory(finalWaypoints, effectiveBranding)
    if (saveError || !savedPlanIdRef.current) {
      setIsPreparingShare(false)
      setError(`Couldn't prepare the share link: ${saveError ?? "the plan wasn't saved."}`)
      return
    }

    // Is it already being shared (from an earlier press in this session)?
    const supabase = getBrowserSupabase()
    const { data } = supabase
      ? await supabase.from("flight_plans").select("share_token").eq("id", savedPlanIdRef.current).maybeSingle()
      : { data: null }
    setPlanShareToken((data?.share_token as string | null | undefined) ?? null)
    setIsPreparingShare(false)
    setShowShareDialog(true)
  }

  // Applies the naming rules: the first/last waypoints are locked to the origin/destination,
  // everything else is numbered by position, and - when the branding checkbox is ticked and
  // the plan has at least BRANDING_MIN_WAYPOINTS - the four waypoints before the destination
  // become MADE / WITH / INFINITE / PLANNER (locked, and remembered as branded so unticking
  // the checkbox can restore them). The same rule for Convert and Sketch: no length-based
  // "auto" branding any more, only the checkbox decides.
  const applyWaypointNamingRules = (waypoints: Waypoint[], origin: string, destination: string, branding = false) => {
    if (waypoints.length === 0) return waypoints

    return waypoints.map((wp, index) => {
      const isFirst = index === 0
      const isLast = index === waypoints.length - 1
      const numbered = String(index).padStart(3, "0")

      if (isFirst) {
        return { ...wp, name: origin || "ORIG", locked: true, branded: false, unbrandedName: undefined }
      }

      if (isLast) {
        return { ...wp, name: destination || "DEST", locked: true, branded: false, unbrandedName: undefined }
      }

      if (branding && isBrandingSlot(index, waypoints.length)) {
        return {
          ...wp,
          name: BRAND_NAMES[index - (waypoints.length - 5)],
          locked: true,
          branded: true,
          unbrandedName: numbered,
        }
      }

      return { ...wp, name: numbered, locked: false, branded: false, unbrandedName: undefined }
    })
  }

  // The checkbox in the export dialog. Only the four branding waypoints change.
  const handleBrandingChange = (checked: boolean) => {
    setIncludeBranding(checked)
    setWaypoints((prev) => applyBrandingOverlay(prev, checked))
  }

  const exportBlockReason =
    waypoints.length < 2
      ? "Add at least 2 waypoints to export."
      : !icaoValidation.origin || !icaoValidation.destination
        ? "Enter valid departure and arrival ICAO codes to export."
        : null

  const icaoInputClass = (value: string, valid: boolean) =>
    cn(
      "text-center font-mono uppercase tracking-widest",
      value && !valid
        ? "border-destructive focus-visible:ring-destructive"
        : valid
          ? "border-emerald-500/70 focus-visible:ring-emerald-500"
          : "",
    )

  const brandingAvailable = waypoints.length >= BRANDING_MIN_WAYPOINTS
  const canSave = !!authUser

  // Export options, directly on the page for both Convert and Sketch, laid out like the other
  // panel sections: the branding checkbox (ticked by default) and, when signed in, the optional
  // flight time that is saved with the plan.
  const exportSectionClass = "sm:border-b-0 sm:border-r"
  const exportOptions = (inGrid: boolean) => (
    <>
      <PanelSection
        label="Made with"
        className={inGrid ? exportSectionClass : undefined}
        help={
          brandingAvailable
            ? "Names the last four waypoints before the destination MADE, WITH, INFINITE and PLANNER. Untick it to leave them out."
            : `Needs at least ${BRANDING_MIN_WAYPOINTS} waypoints, so it isn't applied to this plan.`
        }
      >
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="include-branding"
            checked={includeBranding && brandingAvailable}
            disabled={!brandingAvailable}
            onCheckedChange={(checked) => handleBrandingChange(!!checked)}
          />
          <Label htmlFor="include-branding" className="whitespace-nowrap text-sm font-normal">
            Add &ldquo;Made with Infinite Planner&rdquo;
          </Label>
        </div>
      </PanelSection>

      {canSave && (
        <PanelSection
          label="Flight time"
          className={inGrid ? exportSectionClass : undefined}
          help="Optional. How long the flight takes: saved with the plan in your history."
        >
          <FlightTimeField idPrefix="flight-time" value={flightTimeMinutes} onChange={setFlightTimeMinutes} />
        </PanelSection>
      )}
    </>
  )

  // Where the plan came from and the flight number its filename carried (Convert only).
  const flightSummary =
    mode === "import" && importSource ? (
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {detectedFlightNumber ? (
          <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-foreground">
            {detectedFlightNumber}
          </span>
        ) : (
          <span>No flight number in the file name</span>
        )}
        <span>{importSource}</span>
      </div>
    ) : null

  const exportButtons = (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={handleExportFPL} className="flex-1" disabled={waypoints.length === 0 || isLoading}>
          <Download />
          Export FPL
        </Button>
        <span title={canSave ? undefined : "Sign in with Discord to share a flight plan"}>
          <Button
            variant="outline"
            onClick={handleShare}
            disabled={!canSave || waypoints.length === 0 || isLoading || isPreparingShare}
          >
            <Share2 />
            {isPreparingShare ? "Saving..." : "Share"}
          </Button>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {canSave
          ? "Exporting saves the plan to your history, where you can share it too."
          : authAvailable && authReady
            ? "Sign in with Discord (top right) to save plans to a history and share them."
            : ""}
      </p>
    </div>
  )

  // Result banners shared by Convert and Sketch: compact, neutral surface, colour only on the icon/title.
  const alerts = (
    <>
      {error && (
        <Alert className="mb-3 p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-sm text-destructive">Error</AlertTitle>
          <AlertDescription className="text-muted-foreground">{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert className="mb-3 p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-sm text-emerald-600 dark:text-emerald-400">Success</AlertTitle>
          <AlertDescription className="text-muted-foreground">{successMessage}</AlertDescription>
        </Alert>
      )}
    </>
  )

  // Shown before any work is in progress: signing in reloads the page, so it has to come first.
  const accountHint =
    authAvailable && authReady ? (
      authUser ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5 shrink-0" />
          <span>
            Signed in: plans you export are saved to your{" "}
            <Link href="/history" className="underline underline-offset-2 hover:text-foreground">
              history
            </Link>
            .
          </span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Not signed in: plans you export aren&apos;t saved. Sign in with Discord (top right) first to keep a history and
          share plans. Signing in reloads the page.
        </p>
      )
    ) : null

  // Names tools (TXT import, prefix) - the right-hand panel on desktop, below the table on mobile/tablet.
  const optionsContent = (
    <>
      <PanelSection label="Import TXT to waypoints" help="Import a text file to populate waypoint names.">
        <Button
          onClick={() => txtFileInputRef.current?.click()}
          variant="outline"
          size="sm"
          className="w-full"
          disabled={waypoints.length === 0}
        >
          <Upload />
          Import TXT file
        </Button>
        <input ref={txtFileInputRef} type="file" accept=".txt" onChange={handleTxtImport} className="hidden" />
      </PanelSection>

      <PanelSection label="Waypoint prefix" help='Add a prefix to all waypoint names (e.g., "WP").'>
        <Input
          id="waypointPrefix"
          value={waypointPrefix}
          onChange={(e) => setWaypointPrefix(e.target.value)}
          placeholder="Prefix, e.g. WP"
          onFocus={handleInputFocus}
          className="font-mono"
        />
        <Button
          onClick={applyWaypointPrefix}
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isLoading || waypoints.length === 0}
        >
          Apply prefix
        </Button>
      </PanelSection>
    </>
  )

  // Back link + page title. Sits above the content, inside the narrow column on the pre-import screen.
  const intro = (
    <>
      <div className="mb-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2.5 gap-1 text-muted-foreground">
          <Link href="/">
            <ChevronLeft size={14} />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        actions={
          mode === "import" && hasImported ? (
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `${window.location.pathname}?reset=${Date.now()}`
              }}
            >
              <RotateCcw />
              Reset planner
            </Button>
          ) : undefined
        }
        title={mode === "draw" ? "Route Sketch" : "Convert a flight"}
        description={
          mode === "draw"
            ? "Draw a route on the map, then export it as an Infinite Flight flight plan."
            : "Turn a KML file from FlightRadar24 or FlightAware into an Infinite Flight flight plan."
        }
      />
    </>
  )

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-6">
        {mode !== "import" || hasImported ? intro : null}

        {mode === "draw" && (
          <>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <DrawingBoard
                  waypoints={waypoints}
                  onAddPoints={handleAddDrawnPoints}
                  onCommitPenAnchor={handleCommitPenAnchor}
                  onWaypointDragEnd={handleWaypointDragEnd}
                  onHandleDragEnd={handleHandleDragEnd}
                  onToggleWaypointSelect={toggleWaypointSelection}
                  onDeleteSelected={deleteSelectedWaypoints}
                  onClear={clearDrawing}
                  undo={waypointsHistory.undo}
                  redo={waypointsHistory.redo}
                  canUndo={waypointsHistory.canUndo}
                  canRedo={waypointsHistory.canRedo}
                  originAirport={originAirport}
                  destinationAirport={destinationAirport}
                  icaoValidation={icaoValidation}
                  onICAOChange={handleICAOChange}
                  isTouchPrimary={isTouchPrimary}
                />

                {(error || successMessage) && <div className="mt-4">{alerts}</div>}

                <div className="mt-4">
                  <WaypointTable
                    waypoints={waypoints}
                    isMobile={isMobile}
                    isLoading={isLoading}
                    onRowClick={handleRowClick}
                    onUpdateWaypoint={updateWaypoint}
                    onTabKeyNavigation={handleTabKeyNavigation}
                    onInputFocus={handleInputFocus}
                    onToggleSelectAll={toggleSelectAll}
                    onDeleteSelected={deleteSelectedWaypoints}
                    onClearAltitudes={clearSelectedAltitudes}
                    onExport={handleExportFPL}
                    exportDisabled={!!exportBlockReason}
                    emptyStateMessage="No waypoints yet. Draw a route on the map above to get started."
                  />
                  {exportBlockReason && <p className="mt-2 text-xs text-muted-foreground">{exportBlockReason}</p>}
                </div>

                <div className="mt-4 grid overflow-hidden rounded-md border sm:grid-cols-[1fr_1fr_auto]">
                  {exportOptions(true)}
                  <div className="p-4 sm:w-72">{exportButtons}</div>
                </div>
              </CardContent>
            </Card>
            {accountHint}
          </>
        )}

        {mode === "import" && !hasImported && (
          <div className="mx-auto max-w-xl">
            {intro}
            {error && alerts}
            <Card className="shadow-none">
              <div className="border-b px-5 py-3.5">
                <h2 className="text-sm font-medium">Flight information</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the origin and destination airport codes, then upload the KML file you downloaded from
                  FlightRadar24 or FlightAware.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 px-5 py-5">
                <div className="space-y-2">
                  <Label htmlFor="origin" className="studio-label">
                    Origin
                  </Label>
                  <Input
                    id="origin"
                    value={originAirport}
                    onChange={(e) => handleICAOChange("origin", e.target.value)}
                    placeholder="EHAM"
                    autoComplete="off"
                    className={icaoInputClass(originAirport, icaoValidation.origin)}
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination" className="studio-label">
                    Destination
                  </Label>
                  <Input
                    id="destination"
                    value={destinationAirport}
                    onChange={(e) => handleICAOChange("destination", e.target.value)}
                    placeholder="KSFO"
                    autoComplete="off"
                    className={icaoInputClass(destinationAirport, icaoValidation.destination)}
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                <p className="text-xs text-muted-foreground">4-letter ICAO codes</p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || !icaoValidation.origin || !icaoValidation.destination}
                  title={
                    !icaoValidation.origin || !icaoValidation.destination
                      ? "Enter valid departure and arrival ICAO codes to enable import"
                      : undefined
                  }
                >
                  <Upload />
                  {isLoading ? "Importing..." : "Import KML file"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".kml"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
            </Card>
            {accountHint}
          </div>
        )}

        {mode === "import" && hasImported && (
          <div className={cn(!isMobile && "flex items-start gap-4")}>
            <div className={cn(!isMobile ? "min-w-0 flex-1" : "w-full")}>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  {alerts}

                  {simplificationInfo && (
                    <Alert className="mb-3 p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6">
                      <Info className="h-4 w-4 text-primary" />
                      <AlertTitle className="text-sm">Waypoint simplification applied</AlertTitle>
                      <AlertDescription className="space-y-0.5 text-xs text-muted-foreground">
                        <p>
                          Imported file: <strong className="font-medium text-foreground">{importedFileName || "Unknown"}.kml</strong>
                          {simplificationInfo.source && (
                            <>
                              {" "}
                              from <strong className="font-medium text-foreground">{simplificationInfo.source}</strong>
                            </>
                          )}
                        </p>
                        <p>
                          {simplificationInfo.originalCount} waypoints before simplification, {simplificationInfo.simplifiedCount} after.
                        </p>
                        <p>{simplificationInfo.reason}</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <WaypointTable
                    waypoints={waypoints}
                    isMobile={isMobile}
                    isLoading={isLoading}
                    onRowClick={handleRowClick}
                    onUpdateWaypoint={updateWaypoint}
                    onTabKeyNavigation={handleTabKeyNavigation}
                    onInputFocus={handleInputFocus}
                    onToggleSelectAll={toggleSelectAll}
                    onDeleteSelected={deleteSelectedWaypoints}
                    onClearAltitudes={clearSelectedAltitudes}
                    onExport={handleExportFPL}
                    exportDisabled={waypoints.length === 0}
                    onShowMap={() => setShowMapPreview(true)}
                    emptyStateMessage="No waypoints added. Import a KML file to get started."
                    leftActions={
                      <Button
                        onClick={() => {
                          setShowOptions(!showOptions)
                          setTimeout(() => {
                            document
                              .getElementById("options-section")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" })
                          }, 100)
                        }}
                        variant="outline"
                        size="icon"
                        className="lg:hidden"
                        title="Show options"
                      >
                        <Layers />
                      </Button>
                    }
                  />

                  {isMobile && waypoints.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-md border">
                      <div className="border-b p-4">
                        <p className="studio-label">Your flight plan</p>
                        <p className="mt-2 font-mono text-base font-medium text-primary">
                          {originAirport || "ORIG"}
                          <RouteArrow />
                          {destinationAirport || "DEST"}
                        </p>
                        {flightSummary}
                      </div>
                      {exportOptions(false)}
                      <div className="p-4">{exportButtons}</div>
                    </div>
                  )}

                  {/* Options - below the table on mobile/tablet */}
                  {showOptions && waypoints.length > 0 && (
                    <div id="options-section" className="mt-4 overflow-hidden rounded-md border lg:hidden">
                      {optionsContent}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Options panel - desktop only, right side */}
            {!isMobile && waypoints.length > 0 && (
              <aside className="w-72 flex-shrink-0">
                <Card className="sticky top-6 overflow-hidden shadow-none">
                  <div className="border-b p-4">
                    <p className="studio-label">Your flight plan</p>
                    <p className="mt-2 font-mono text-base font-medium text-primary">
                      {originAirport || "ORIG"}
                      <RouteArrow />
                      {destinationAirport || "DEST"}
                    </p>
                    {flightSummary}
                  </div>

                  <PanelSection label="Preview">
                    <Button
                      onClick={() => setShowMapPreview(true)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={waypoints.length === 0 || isLoading}
                    >
                      <Map />
                      Flight plan map
                    </Button>
                  </PanelSection>

                  {optionsContent}

                  {exportOptions(false)}

                  <div className="p-4">{exportButtons}</div>
                </Card>
              </aside>
            )}
          </div>
        )}

        {showShareDialog && savedPlanId && (
          <ShareDialog
            open
            onOpenChange={setShowShareDialog}
            planId={savedPlanId}
            origin={originAirport || "ORIG"}
            destination={destinationAirport || "DEST"}
            shareToken={planShareToken}
            onShareChange={setPlanShareToken}
          />
        )}

        {/* Map Preview Dialog */}
        <Dialog
          open={showMapPreview}
          onOpenChange={(open) => {
            if (!isEditingMap) {
              setShowMapPreview(open)
            }
          }}
        >
          <DialogContent
            className="max-w-6xl w-[95vw] sm:w-full p-4 sm:p-6 flex flex-col"
            onEscapeKeyDown={(e) => isEditingMap && e.preventDefault()}
            onPointerDownOutside={(e) => isEditingMap && e.preventDefault()}
          >
            <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
              <div>
                <DialogTitle>Flight Plan Preview</DialogTitle>
                <DialogDescription>
                  <span className="hidden lg:inline">Visualize your flight plan with {waypoints.length} waypoints</span>
                  <span className="lg:hidden">{waypoints.length} waypoints</span>
                </DialogDescription>
              </div>
              {waypoints.length > 0 && (
                <div className="flex items-center gap-2 ml-auto mr-8">
                  {isEditingMap && selectMode && waypoints.some((wp) => wp.selected) && (
                    <Button onClick={deleteSelectedWaypoints} variant="destructive" size="sm">
                      <Trash2 />
                      <span className="hidden sm:inline">Delete waypoint(s)</span>
                      <span className="sm:hidden">Delete</span>
                    </Button>
                  )}
                  {isEditingMap && (
                    <Button onClick={toggleSelectMode} variant={selectMode ? "default" : "outline"} size="sm">
                      <LassoSelect />
                      <span className="hidden sm:inline">{selectMode ? "Done Selecting" : "Select Points"}</span>
                      <span className="sm:hidden">{selectMode ? "Done" : "Select"}</span>
                    </Button>
                  )}
                  {/* Hidden while selecting - the only way out of select mode is "Done Selecting" */}
                  {!selectMode && (
                    <Button onClick={toggleMapEditing} variant={isEditingMap ? "default" : "outline"} size="sm">
                      <Pencil />
                      <span className="hidden sm:inline">{isEditingMap ? "Done Editing" : "Edit Waypoints"}</span>
                      <span className="sm:hidden">{isEditingMap ? "Done" : "Edit"}</span>
                    </Button>
                  )}
                </div>
              )}
            </DialogHeader>
            <div className="h-[70dvh] max-h-[500px] min-h-[280px] w-full relative">
              <MapPreview
                waypoints={waypoints}
                isEditing={isEditingMap}
                onWaypointDragEnd={handleWaypointDragEnd}
                onWaypointInsert={handleWaypointInsert}
                selectMode={selectMode}
                onToggleWaypointSelect={toggleWaypointSelection}
                onWaypointsMarqueeSelect={handleMarqueeSelect}
                onClearSelection={handleClearMapSelection}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setShowMapPreview(false)} disabled={isEditingMap}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    </TooltipProvider>
  )
}

// A titled block of the options panel (desktop side panel and mobile options list).
function PanelSection({
  label,
  help,
  className,
  children,
}: {
  label: string
  help?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2.5 border-b p-4", className)}>
      <div className="flex items-center gap-1.5">
        <h4 className="studio-label">{label}</h4>
        {help && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{help}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  )
}
