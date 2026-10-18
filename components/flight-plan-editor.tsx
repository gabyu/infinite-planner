"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Pencil,
  ChevronLeft,
  ChevronDown,
  HelpCircle,
  LassoSelect,
  AlertCircle,
  Info,
  RotateCcw,
} from "lucide-react"
import { parseKML } from "@/lib/kml-parser"
import { generateFPL, fplFileName } from "@/lib/fpl-generator"
import { parseFlightFilename, saveFlightData } from "@/lib/flight-stats-service"
import {
  AUTOSAVE_INTERVAL_MS,
  BRAND_NAMES,
  BRANDING_MIN_WAYPOINTS,
  PRIVATE_SHARE,
  isTrackerDerived,
  type FlightPlanSource,
  type FlightPlanStatus,
  type PlanShare,
  type PlanVisibility,
  type StoredWaypoint,
} from "@/lib/flight-plans"
import { VisibilitySwitch } from "@/components/visibility-switch"
import { RouteArrow } from "@/components/route-arrow"
import { IcaoInput } from "@/components/ds/icao-input"
import { StartLayout } from "@/components/convert/start-layouts"
import { AirportInput } from "@/components/ds/airport-input"
import { PageShell } from "@/components/ds/page-shell"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { Toaster } from "@/components/ui/toaster"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { copy, legalCopy, trimPreviewText, trimRemovedText } from "@/lib/copy"
import { distanceNm, formatAltitude, formatDistanceNm } from "@/lib/route-render"
import { EditorWorkspace } from "@/components/editor/workspace"
import { WaypointList } from "@/components/editor/waypoint-list"
import { AltitudeStrip } from "@/components/editor/altitude-strip"
import { SourceMark } from "@/components/editor/source-mark"
import { FlightNumbersField } from "@/components/editor/flight-numbers-field"
import { GroundMovements, GroundTrimBar } from "@/components/editor/ground-movements"
import { planTrim, type TrimAirport, type TrimEnd } from "@/lib/ground-trim"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapPreview = dynamic(() => import("@/components/map-preview-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      {copy.editor.mapLoading}
    </div>
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
  // Share link of the plan this session saved, if it is being shared (null = not shared).
  const [planShare, setPlanShare] = useState<PlanShare>(PRIVATE_SHARE)
  const [planFeatured, setPlanFeatured] = useState(false)
  // Whether "Public" is offered when sharing: the library is launched, or the user is an admin (asked once signed in).
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)
  const [importSource, setImportSource] = useState<FlightPlanSource | null>(null)
  // Every source a reopened draft comes from (flight_plans.origin_sources): a copy keeps the origin of the plan it was made from.
  const [originSources, setOriginSources] = useState<string[]>([])
  // The dashboard row this editing session saves to: the draft autosaves update it instead of piling up
  // near-identical entries. Cleared when a new plan is started.
  const savedPlanIdRef = useRef<string | null>(null)
  // Lifecycle of the row above. A draft is autosaved and editable; once exported it is locked
  // for good, so whatever is saved next (after further edits) is a NEW draft.
  const savedStatusRef = useRef<FlightPlanStatus | null>(null)
  const [savedStatus, setSavedStatus] = useState<FlightPlanStatus | null>(null)
  // What the saved row contains (see currentFingerprint): the page is "dirty" when it differs.
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  // Autosave only starts once the plan has been generated and the user closed the map (Convert),
  // or the sketch is complete enough to save (Sketch).
  const [draftArmed, setDraftArmed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const savingRef = useRef(false)
  // Reopening a draft from the dashboard: /convert?draft=<id> or /sketch?draft=<id>.
  const [resume, setResume] = useState<{ state: "idle" | "loading" | "error"; message?: string }>({ state: "idle" })
  const draftLoadedRef = useRef(false)
  const skipNamingRef = useRef(false)
  const [flightNumberOverride, setFlightNumberOverride] = useState<string | null>(null)
  // What the person typed in the Flight number field (a codeshare, a callsign of their own...). undefined = untouched:
  // the number read from the file name (or saved with the draft) stands.
  const [flightNumberEdit, setFlightNumberEdit] = useState<string | undefined>(undefined)
  // The other numbers of the flight (codeshares), next to the main one above. Saved with the plan.
  const [extraFlightNumbers, setExtraFlightNumbers] = useState<string[]>([])
  const { user: authUser, ready: authReady, available: authAvailable } = useAuthUser()
  const [isEditingMap, setIsEditingMap] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [icaoValidation, setIcaoValidation] = useState({
    origin: false,
    destination: false,
  })
  const [hasImported, setHasImported] = useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  // The waypoint under the pointer in the list, on the map or in the altitude strip (all three highlight it).
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // A map point was clicked: the list scrolls to its row.
  const [scrollTarget, setScrollTarget] = useState<{ id: string; nonce: number } | null>(null)
  const handleMapPointClick = useCallback(
    (id: string) => setScrollTarget((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 })),
    [],
  )

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
    // Opening a saved draft from the dashboard: that one wins over the browser's local draft.
    if (new URLSearchParams(window.location.search).has("draft")) return
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
    // Don't overwrite the local draft with an empty board while a saved draft is still loading.
    if (new URLSearchParams(window.location.search).has("draft") && !draftLoadedRef.current) return
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
      // Loading a saved draft sets the airports and the names together: keep its names.
      if (skipNamingRef.current) {
        skipNamingRef.current = false
        return
      }
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
        resetSavedPlan()
        setFlightNumberOverride(null)
        setFlightNumberEdit(undefined)
        setExtraFlightNumbers([])
        setImportSource(
          result.source === "FlightAware" || result.source === "FlightRadar24" || result.source === "Imported" ? result.source : null,
        )
        setSimplificationInfo({
          originalCount: result.originalCount,
          simplifiedCount: result.simplifiedCount,
          reason: result.simplificationReason,
          source: result.source === "Imported" ? undefined : result.source,
        })

        // Set hasImported to true to reveal the rest of the UI (the workspace: map first, panel beside it)
        setHasImported(true)
        // The draft starts saving right away: there is no map to close any more.
        setDraftArmed(true)

        setSuccessMessage(
          `Successfully imported ${renamedWaypoints.length} waypoints from ${result.source && result.source !== "Imported" ? result.source : "KML file"}`,
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
  // strict patterns, so a looser guess never counts. Shown on the page and saved with the plan. A reopened
  // draft has no file name any more: it uses the flight number that was saved with it.
  const fileFlightNumber = (() => {
    if (mode !== "import") return null
    if (importedFileName) {
      const parsed = parseFlightFilename(importedFileName)
      return parsed.source ? (parsed.flight_number?.toUpperCase() ?? null) : null
    }
    return flightNumberOverride
  })()
  // The flight number the plan carries: what was typed in the field when there is something, else the file's. It can be
  // changed until the plan is exported (a flight often has codeshare numbers), and cleared.
  const detectedFlightNumber = flightNumberEdit !== undefined ? flightNumberEdit || null : fileFlightNumber
  const allFlightNumbers = [detectedFlightNumber, ...extraFlightNumbers].filter((n): n is string => !!n)
  // The chips field edits the whole list: its first number is the main one, the rest are the extras.
  const setAllFlightNumbers = (numbers: string[]) => {
    setFlightNumberEdit(numbers[0] ?? "")
    setExtraFlightNumbers(numbers.slice(1))
  }

  const planSource: FlightPlanSource | null = mode === "draw" ? "Sketch" : importSource
  // Publishing is only offered for a plan designed here; the server refuses anything else anyway.
  const trackerDerived = isTrackerDerived([...originSources, ...(planSource ? [planSource] : [])])
  const icaoReady = /^[A-Z]{4}$/.test(originAirport) && /^[A-Z]{4}$/.test(destinationAirport)
  const effectiveBranding = includeBranding && waypoints.length >= BRANDING_MIN_WAYPOINTS

  // Everything a save would store, as a string: compared with what the saved row holds, it tells
  // whether there is anything new to save (autosave) and whether the page still shows the exported plan (Share).
  const currentFingerprint = useMemo(
    () =>
      JSON.stringify([
        planSource,
        detectedFlightNumber,
        extraFlightNumbers,
        originAirport,
        destinationAirport,
        applyBrandingOverlay(waypoints, includeBranding).map(({ name, lat, lng, altitude }) => [
          name,
          lat,
          lng,
          Math.round(altitude),
        ]),
        effectiveBranding,
        flightTimeMinutes,
      ]),
    [planSource, detectedFlightNumber, extraFlightNumbers, originAirport, destinationAirport, waypoints, includeBranding, effectiveBranding, flightTimeMinutes],
  )
  const isDirty = savedFingerprint !== currentFingerprint

  // Going back to the Convert start screen throws the plan away. That is only safe when what is on the page has been
  // saved (draft or export) or downloaded: otherwise the person is asked first.
  const [exportedFingerprint, setExportedFingerprint] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const leavingRef = useRef(false)
  const hasUnsavedWork =
    mode === "import" && hasImported && waypoints.length > 0 && savedFingerprint !== currentFingerprint && exportedFingerprint !== currentFingerprint
  const unsavedRef = useRef(hasUnsavedWork)
  unsavedRef.current = hasUnsavedWork

  const startOver = () => {
    leavingRef.current = true
    window.location.href = `${window.location.pathname}?reset=${Date.now()}`
  }

  // The Convert link in the header (we are already on /convert) goes back to the first screen; closing or reloading
  // the tab with unsaved work asks the browser's own question.
  useEffect(() => {
    if (mode !== "import" || !hasImported) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a[href="/convert"]')
      if (!link) return
      e.preventDefault()
      e.stopPropagation()
      if (unsavedRef.current) setConfirmLeave(true)
      else startOver()
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current || leavingRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    document.addEventListener("click", onClick, true)
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasImported])

  // Forgets the row this session saved to (a new import, a cleared sketch): what comes next is a new plan.
  const resetSavedPlan = () => {
    savedPlanIdRef.current = null
    savedStatusRef.current = null
    setSavedPlanId(null)
    setSavedStatus(null)
    setSavedFingerprint(null)
    setLastSavedAt(null)
    setPlanShare(PRIVATE_SHARE)
    setFlightNumberEdit(undefined)
    setDraftArmed(false)
    setAutosaveError(null)
  }

  // Saves the plan for the signed-in user as a draft (autosave) or as exported (the export, which locks
  // it). The first save creates the row, later ones update it. An exported row is locked, so a save after
  // one always creates a new row. Returns an error message, or null.
  const savePlan = async (
    status: FlightPlanStatus,
    finalWaypoints: Waypoint[],
    fingerprint: string,
  ): Promise<string | null> => {
    if (!planSource) return "This plan's source couldn't be determined."

    if (savedStatusRef.current === "exported") {
      savedPlanIdRef.current = null
      savedStatusRef.current = null
      setSavedPlanId(null)
      setSavedStatus(null)
      setPlanShare(PRIVATE_SHARE)
    }

    const body = JSON.stringify({
      source: planSource,
      status,
      flightNumber: detectedFlightNumber,
      extraFlightNumbers,
      origin: originAirport,
      destination: destinationAirport,
      waypoints: finalWaypoints.map(({ name, lat, lng, altitude }) => ({ name, lat, lng, altitude })),
      includesBranding: effectiveBranding,
      flightTimeMinutes,
    })

    const send = (url: string, method: "POST" | "PUT") =>
      fetch(url, { method, headers: { "Content-Type": "application/json" }, body })
    const startNewRow = () => {
      savedPlanIdRef.current = null
      setPlanShare(PRIVATE_SHARE)
      return send("/api/flight-plans", "POST")
    }

    try {
      let response = savedPlanIdRef.current
        ? await send(`/api/flight-plans/${savedPlanIdRef.current}`, "PUT")
        : await send("/api/flight-plans", "POST")
      // The row was deleted from the dashboard in the meantime, or exported from another tab: save as a new one.
      if ((response.status === 404 || response.status === 409) && savedPlanIdRef.current) {
        response = await startNewRow()
      }
      const result = await response.json().catch(() => null)
      if (!response.ok) return result?.error ?? "Couldn't save the flight plan."
      savedPlanIdRef.current = result.id
      savedStatusRef.current = result.status
      setSavedPlanId(result.id)
      setSavedStatus(result.status)
      setSavedFingerprint(fingerprint)
      setLastSavedAt(new Date())
      return null
    } catch (saveError) {
      console.error("Error saving flight plan:", saveError)
      return "Couldn't reach the server."
    }
  }

  // The periodic draft save. Does nothing unless there is something new to save.
  const autosaveDraft = async () => {
    if (!authUser || !draftArmed || savingRef.current) return
    if (!planSource || waypoints.length < 2 || !icaoReady) return
    if (savedFingerprint === currentFingerprint) return

    savingRef.current = true
    setIsSaving(true)
    const saveError = await savePlan("draft", applyBrandingOverlay(waypoints, includeBranding), currentFingerprint)
    savingRef.current = false
    setIsSaving(false)
    setAutosaveError(saveError)
  }
  // The interval below must always run the latest closure, not the one from when it started.
  const autosaveRef = useRef(autosaveDraft)
  autosaveRef.current = autosaveDraft

  // First save as soon as autosave is armed, then once a minute (a plain interval, not on every change).
  useEffect(() => {
    if (!authUser || !draftArmed) return
    autosaveRef.current()
    const timer = setInterval(() => autosaveRef.current(), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [authUser, draftArmed])

  // Sketch has no map to close: the draft starts once there is a route and both airports are filled in.
  useEffect(() => {
    if (mode === "draw" && authUser && waypoints.length >= 2 && icaoReady) setDraftArmed(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, authUser, waypoints.length >= 2, icaoReady])

  // Keep the address in sync so a refresh reopens the saved draft: ?draft=<id> while it is a draft,
  // nothing once it is exported (an exported plan can't be reopened for editing).
  useEffect(() => {
    if (!savedPlanId || savedStatus === null) return
    const url = new URL(window.location.href)
    if (savedStatus === "draft") url.searchParams.set("draft", savedPlanId)
    else url.searchParams.delete("draft")
    window.history.replaceState(null, "", url.pathname + url.search)
  }, [savedPlanId, savedStatus])

  // Opens the draft named in the address (from the dashboard's Edit action).
  useEffect(() => {
    if (!authReady) return
    const id = new URLSearchParams(window.location.search).get("draft")
    if (!id || draftLoadedRef.current) return

    if (!authUser) {
      setResume({ state: "error", message: "Sign in with Discord to open your drafts." })
      return
    }
    setResume({ state: "loading" })
    fetch(`/api/flight-plans/${id}`)
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) }))
      .then(({ ok, body }) => {
        if (!ok || !body) {
          setResume({ state: "error", message: body?.error ?? "This draft couldn't be opened." })
          return
        }
        if (body.status !== "draft") {
          setResume({
            state: "error",
            message: "This flight plan was exported, so it is locked. Duplicate it from your dashboard to change it.",
          })
          return
        }
        // Sketch drafts belong in Sketch, imported ones in Convert.
        // A copy of someone else's plan (an import from the library) always opens in Convert's map view, whatever
        // its source: it is edited as waypoints, not on the Sketch board.
        const rightMode = body.source === "Sketch" && !body.is_fork ? "draw" : "import"
        if (rightMode !== mode) {
          window.location.replace(`${rightMode === "draw" ? "/sketch" : "/convert"}?draft=${id}${body.is_fork ? "&fork=1" : ""}`)
          return
        }

        const stored = body.waypoints as StoredWaypoint[]
        const branded = !!body.includes_branding
        const restored: Waypoint[] = stored.map((wp, index) => {
          const base: Waypoint = {
            id: `draft-${index}`,
            name: wp.name,
            lat: wp.lat,
            lng: wp.lng,
            altitude: wp.altitude,
            selected: false,
          }
          if (index === 0 || index === stored.length - 1) return { ...base, locked: true }
          // The branding block is remembered as such, so unticking the checkbox still restores the numbers.
          if (branded && isBrandingSlot(index, stored.length)) {
            return { ...base, locked: true, branded: true, unbrandedName: String(index).padStart(3, "0") }
          }
          return base
        })

        draftLoadedRef.current = true
        skipNamingRef.current = true
        setOriginAirport(body.origin_airport)
        setDestinationToAirport(body.destination_airport)
        setIcaoValidation({ origin: true, destination: true })
        setIncludeBranding(branded)
        setFlightTimeMinutes(body.flight_time_minutes ?? null)
        setWaypoints(restored)
        setOriginSources(Array.isArray(body.origin_sources) ? body.origin_sources : [])
        if (mode === "import") {
          setHasImported(true)
          setImportSource(
            body.source === "FlightAware" || body.source === "FlightRadar24" || body.source === "Imported" ? body.source : null,
          )
          setFlightNumberOverride(body.flight_number ?? null)
          setExtraFlightNumbers(Array.isArray(body.extra_flight_numbers) ? body.extra_flight_numbers : [])
        }
        savedPlanIdRef.current = body.id
        savedStatusRef.current = "draft"
        setSavedPlanId(body.id)
        setSavedStatus("draft")
        setPlanShare(PRIVATE_SHARE)
        setLastSavedAt(new Date(body.created_at))
        setDraftArmed(true)
        setResume({ state: "idle" })
      })
      .catch(() => setResume({ state: "error", message: "Couldn't reach the server." }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, authUser])

  // Downloads the FPL and, when signed in, saves the plan as exported (which locks it).
  const performExport = async () => {
    setError(null)
    setSuccessMessage(null)

    // Whatever the checkbox says is what gets exported AND stored, applied to the waypoints
    // as they are right now (this also repairs a branding block that edits had shifted).
    const finalWaypoints = applyBrandingOverlay(waypoints, includeBranding)
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
      setExportedFingerprint(currentFingerprint)

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

      // Exporting the very plan that is already saved as exported again: nothing new to save.
      if (savedStatusRef.current === "exported" && savedFingerprint === currentFingerprint) {
        setSuccessMessage(`Flight plan exported again as ${fileName}.`)
        return
      }

      savingRef.current = true
      setIsSaving(true)
      const saveError = await savePlan("exported", finalWaypoints, currentFingerprint)
      savingRef.current = false
      setIsSaving(false)
      if (saveError) {
        setError(`Exported as ${fileName}, but it wasn't saved to your dashboard: ${saveError}`)
      } else {
        setAutosaveError(null)
        setSuccessMessage(`Flight plan exported as ${fileName} and saved to your dashboard. It is now locked.`)
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
    resetSavedPlan()
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

  useEffect(() => {
    if (!authUser) return setLibraryOpen(false)
    fetch("/api/library/access", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setLibraryOpen(body?.open === true))
      .catch(() => setLibraryOpen(false))
  }, [authUser])

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


  // --- Ground trimming (Convert, Options): preview what a trim would remove, then apply it as one undoable step.
  const { toast } = useToast()
  const [trimPreview, setTrimPreview] = useState<{ end: TrimEnd; ids: string[]; approximate: boolean } | null>(null)
  const [trimBusy, setTrimBusy] = useState<TrimEnd | null>(null)
  const [trimmed, setTrimmed] = useState<Record<TrimEnd, boolean>>({ departure: false, arrival: false })
  const runwayCache = useRef(new Map<string, TrimAirport | null>())
  // What each trim took away, so switching the toggle back on can put it back.
  const [mapFocus, setMapFocus] = useState<{ ids: string[]; nonce: number } | null>(null)
  const trimRemoved = useRef<Partial<Record<TrimEnd, Waypoint[]>>>({})
  const [panelTab, setPanelTab] = useState<"waypoints" | "options">("waypoints")
  const ghostIds = useMemo(() => (trimPreview ? new Set(trimPreview.ids) : undefined), [trimPreview])

  const loadAirport = async (icao: string): Promise<TrimAirport | null> => {
    if (runwayCache.current.has(icao)) return runwayCache.current.get(icao) ?? null
    try {
      const response = await fetch(`/api/airports/${icao}/runways`)
      const data = response.ok ? ((await response.json()) as TrimAirport) : null
      runwayCache.current.set(icao, data)
      return data
    } catch {
      return null
    }
  }

  // The toggles are "on" while the ground movements are in the plan. Turning one off previews what goes (Apply
  // removes it); turning a trimmed one back on puts the removed waypoints back.
  const toggleTrimPreview = async (end: TrimEnd) => {
    if (trimPreview?.end === end) {
      setTrimPreview(null)
      return
    }
    if (trimmed[end]) {
      const back = trimRemoved.current[end] ?? []
      delete trimRemoved.current[end]
      setTrimmed((current) => ({ ...current, [end]: false }))
      if (back.length > 0) {
        const merged = end === "departure" ? [...back, ...waypoints] : [...waypoints, ...back]
        setWaypoints(applyWaypointNamingRules(merged, originAirport, destinationAirport, includeBranding))
      }
      return
    }
    setTrimPreview(null)
    setTrimBusy(end)
    const icao = end === "departure" ? originAirport : destinationAirport
    const known = await loadAirport(icao)
    setTrimBusy(null)
    // An airport without runway data still gets the fallback, around the plan's own end point.
    const endPoint = end === "departure" ? waypoints[0] : waypoints[waypoints.length - 1]
    const airport: TrimAirport = known ?? { elevationFt: null, lat: endPoint.lat, lng: endPoint.lng, runways: [] }
    const result = planTrim(waypoints, airport, end)
    if (result.remove.length === 0) {
      toast({ title: copy.editor.trimNone })
      return
    }
    setPanelTab("waypoints")
    const ids = result.remove.map((index) => waypoints[index].id)
    setTrimPreview({ end, ids, approximate: result.approximate })
    // Straight to the waypoints that would go; the view stays there after Apply.
    setMapFocus((current) => ({ ids, nonce: (current?.nonce ?? 0) + 1 }))
  }

  const applyTrim = () => {
    if (!trimPreview) return
    const { end, ids } = trimPreview
    const remove = new Set(ids)
    const kept = waypoints.filter((wp) => !remove.has(wp.id))
    if (kept.length < 2) return
    trimRemoved.current[end] = waypoints.filter((wp) => remove.has(wp.id))
    const brandingDropped = includeBranding && waypoints.length >= BRANDING_MIN_WAYPOINTS && kept.length < BRANDING_MIN_WAYPOINTS
    // One setWaypoints call = one undo step. The naming rules renumber what is left.
    setWaypoints(applyWaypointNamingRules(kept.map((wp) => ({ ...wp, selected: false })), originAirport, destinationAirport, includeBranding))
    setTrimmed((current) => ({ ...current, [end]: true }))
    setTrimPreview(null)
    toast({
      title: trimRemovedText(ids.length),
      description: brandingDropped ? copy.editor.trimBrandingNote : undefined,
      action: (
        <ToastAction
          altText={copy.editor.trimUndo}
          onClick={() => {
            waypointsHistory.undo()
            delete trimRemoved.current[end]
            setTrimmed((current) => ({ ...current, [end]: false }))
          }}
        >
          {copy.editor.trimUndo}
        </ToastAction>
      ),
    })
  }

  // Edits made while previewing can change what a trim would do: drop the preview.
  useEffect(() => {
    if (trimPreview && trimPreview.ids.some((id) => !waypoints.some((wp) => wp.id === id))) setTrimPreview(null)
  }, [waypoints, trimPreview])

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
  const brandingSection = (inGrid: boolean) => (
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
  )

  const flightNumberSection = (inGrid: boolean, always = false) =>
    (canSave || always) && (
        <PanelSection
          label={copy.editor.flightNumbersLabel}
          className={inGrid ? exportSectionClass : undefined}
          help={copy.editor.flightNumbersHelp}
        >
          <FlightNumbersField id="flight-number" value={allFlightNumbers} onChange={setAllFlightNumbers} />
        </PanelSection>
    )

  const flightTimeSection = (inGrid: boolean, always = false) =>
    (canSave || always) && (
        <PanelSection
          label="Flight time"
          className={inGrid ? exportSectionClass : undefined}
          help="Optional. How long the flight takes: saved with the plan in your dashboard."
        >
          <FlightTimeField idPrefix="flight-time" value={flightTimeMinutes} onChange={setFlightTimeMinutes} fill />
        </PanelSection>
    )

  const exportOptions = (inGrid: boolean) => (
    <>
      {brandingSection(inGrid)}
      {flightNumberSection(inGrid)}
      {flightTimeSection(inGrid)}
    </>
  )

  // Where the plan came from and the flight number its filename carried (Convert only).
  const flightSummary =
    mode === "import" && importSource ? (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {detectedFlightNumber ? (
          <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-foreground">
            {detectedFlightNumber}
          </span>
        ) : (
          <span>No flight number in the file name{canSave ? ": you can add one below" : ""}</span>
        )}
        <SourceMark source={importSource} />
      </div>
    ) : null

  // Share needs an exported plan, and the page must still show that exact plan.
  const canSetVisibility = canSave && !!savedPlanId && savedStatus === "exported" && !isDirty

  // Where the plan stands: draft autosave, or exported (locked).
  const saveStatusLine = (() => {
    if (!canSave) {
      return authAvailable && authReady ? "Sign in with Discord (top right) to save drafts, keep a dashboard and share plans." : ""
    }
    if (savedStatus === "exported" && !isDirty) {
      return (
        <>
          Exported and saved: this plan is locked. Duplicate it from your{" "}
          <Link href="/dashboard" className="link hover:text-foreground">
            dashboard
          </Link>{" "}
          to change it.
        </>
      )
    }
    if (!draftArmed) {
      return mode === "import"
        ? "Your draft starts saving as soon as the plan is imported."
        : "Your draft starts saving once the route has two points and both airports are set."
    }
    if (isSaving) return "Saving..."
    if (autosaveError) return `Draft not saved: ${autosaveError}`
    if (isDirty) {
      return savedStatus === "exported"
        ? "Unsaved changes. The exported plan is locked, so they are saved as a new draft."
        : "Unsaved changes. Your draft autosaves every minute."
    }
    return lastSavedAt
      ? `Draft saved at ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
      : "Draft saved."
  })()

  const exportButtons = (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={handleExportFPL} className="flex-1" disabled={waypoints.length === 0 || isLoading}>
          <Download />
          Export FPL
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{legalCopy.simulationOnly}</p>
      {libraryOpen && (
        <div>
          <VisibilitySwitch
            planId={savedPlanId ?? ""}
            origin={originAirport || "ORIG"}
            destination={destinationAirport || "DEST"}
            flightNumber={detectedFlightNumber}
            share={planShare}
            onShareChange={setPlanShare}
            disabled={!canSetVisibility || !savedPlanId || savedStatus !== "exported" || isDirty || trackerDerived}
            disabledReason={
              trackerDerived
                ? legalCopy.publishOnlyOwnDesigns
                : !canSave
                  ? "Sign in with Discord to publish a flight plan"
                  : "Export the flight plan first to make it public"
            }
          />
        </div>
      )}
      <p className={cn("text-xs text-muted-foreground", autosaveError && canSave && "text-destructive")}>
        {saveStatusLine}
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
        <p className="mt-3 max-w-lg text-balance text-xs text-muted-foreground">
          <span>
            Signed in: your plans are saved as drafts while you edit, and kept in your{" "}
            <Link href="/dashboard" className="link hover:text-foreground">
              dashboard
            </Link>
            .
          </span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Not signed in: plans you export aren&apos;t saved. Sign in with Discord (top right) first to save drafts, keep
          a dashboard and share plans. Signing in reloads the page.
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

  // Shown instead of the editor while a draft is being opened, or when it can't be.
  const resumeNotice =
    resume.state === "idle" ? null : (
      <div>
        <div className="flex max-w-xl flex-col items-start rounded-lg border bg-card px-6 py-8">
          {resume.state === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading your draft...</p>
          ) : (
            <>
              <h2 className="text-sm font-medium">This draft can&apos;t be opened</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{resume.message}</p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/dashboard" className="no-underline">
                  Go to your dashboard
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    )

  const pageTitle = mode === "draw" ? "Route Sketch" : "Convert a flight"
  const pageDescription =
    mode === "draw"
      ? "Draw a route on the map, then export it as an Infinite Flight flight plan."
      : "Turn a KML file from FlightRadar24 or FlightAware into an Infinite Flight flight plan."
  const resetAction =
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
  // Before the import Convert is a short form: keep it narrow, but left-aligned like every other page.
  const narrowPage = false

  // Convert after an import (and a plan opened from the library): the workspace. A full-height map with the
  // panel floating over its left side (a bottom sheet on a phone); no page title, no pop-up map.
  if (mode === "import" && hasImported) {
    const selectedAny = waypoints.some((wp) => wp.selected)
    const totalNm = waypoints.reduce((sum, wp, i) => (i === 0 ? 0 : sum + distanceNm(waypoints[i - 1], wp)), 0)
    const maxAltitude = Math.max(0, ...waypoints.map((wp) => wp.altitude))
    const stats: { label: string; value: string }[] = [
      { label: copy.editor.statsDistance, value: formatDistanceNm(totalNm) },
      { label: copy.editor.statsWaypoints, value: String(waypoints.length) },
      { label: copy.editor.statsMaxAltitude, value: maxAltitude > 0 ? formatAltitude(maxAltitude) : "-" },
    ]
    if (flightTimeMinutes) {
      stats.push({
        label: copy.editor.statsFlightTime,
        value: `${Math.floor(flightTimeMinutes / 60)}h ${String(flightTimeMinutes % 60).padStart(2, "0")}`,
      })
    }

    // Same look as the zoom group under it: a card with a hairline border, h-9, primary when active.
    const toolbarButton = (active: boolean, destructive = false) =>
      cn(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-medium shadow-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4",
        destructive
          ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
          : active
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-card text-foreground hover:bg-accent",
      )

    const toolbar = waypoints.length > 0 && (
      <div className="flex flex-wrap justify-end gap-2">
        {isEditingMap && selectMode && selectedAny && (
          <button type="button" onClick={deleteSelectedWaypoints} className={toolbarButton(false, true)}>
            <Trash2 />
            {copy.editor.deleteWaypoints}
          </button>
        )}
        {isEditingMap && (
          <button type="button" onClick={toggleSelectMode} className={toolbarButton(selectMode)}>
            <LassoSelect />
            {selectMode ? copy.editor.doneSelecting : copy.editor.selectPoints}
          </button>
        )}
        {/* Hidden while selecting - the only way out of select mode is "Done selecting" */}
        {!selectMode && (
          <button type="button" onClick={toggleMapEditing} className={toolbarButton(isEditingMap)}>
            <Pencil />
            {isEditingMap ? copy.editor.doneEditing : copy.editor.editWaypoints}
          </button>
        )}
      </div>
    )

    const hasAlerts = !!error || !!successMessage || !!simplificationInfo

    return (
      <TooltipProvider>
        <EditorWorkspace
          isMobile={isMobile}
          map={
            <MapPreview
              waypoints={waypoints}
              isEditing={isEditingMap}
              onWaypointDragEnd={handleWaypointDragEnd}
              onWaypointInsert={handleWaypointInsert}
              selectMode={selectMode}
              onToggleWaypointSelect={toggleWaypointSelection}
              onWaypointsMarqueeSelect={handleMarqueeSelect}
              onClearSelection={handleClearMapSelection}
              hoveredId={hoveredId}
              ghostIds={ghostIds}
              focus={mapFocus}
              onHoverWaypoint={setHoveredId}
              onWaypointClick={handleMapPointClick}
              toolbarLeading={toolbar}
            />
          }
          strip={<AltitudeStrip waypoints={waypoints} hoveredId={hoveredId} onHover={setHoveredId} stats={stats} />}
          header={
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-mono text-xl font-semibold text-primary">
                    {originAirport || "ORIG"}
                    <RouteArrow />
                    {destinationAirport || "DEST"}
                  </p>
                  {flightSummary}
                </div>
              </div>
              {/* On a phone there is no bar under the map, so the figures stay here */}
              {isMobile && (
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <dt className="studio-label">{stat.label}</dt>
                      <dd className="font-mono text-sm">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          }
          body={
            <>
              {/* One view at a time, so the middle of the panel scrolls once: the route's waypoints, or the options */}
              <div className="shrink-0 px-4 pb-2 pt-2.5">
                <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["waypoints", `${copy.editor.tabWaypoints} · ${waypoints.length}`],
                      ["options", copy.editor.optionsHeading],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={panelTab === tab}
                      onClick={() => setPanelTab(tab)}
                      className={cn(
                        "h-7 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        panelTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {panelTab === "waypoints" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {hasAlerts && (
                    <div className="shrink-0 space-y-1.5 px-4 pb-2">
                      {error && (
                        <p className="flex items-start gap-1.5 text-xs text-destructive">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {error}
                        </p>
                      )}
                      {successMessage && (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          {successMessage}
                        </p>
                      )}
                      {simplificationInfo && (
                        <details className="rounded-lg border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground">
                            <Info className="h-3.5 w-3.5 text-primary" />
                            Waypoint simplification applied
                            <span className="ml-auto font-mono font-normal text-muted-foreground">
                              {simplificationInfo.originalCount} → {simplificationInfo.simplifiedCount}
                            </span>
                          </summary>
                          <div className="mt-2 space-y-0.5">
                            <p>
                              Imported file: <strong className="font-medium text-foreground">{importedFileName || "Unknown"}.kml</strong>
                              {simplificationInfo.source && (
                                <>
                                  {" "}
                                  from <strong className="font-medium text-foreground">{simplificationInfo.source}</strong>
                                </>
                              )}
                            </p>
                            <p>{simplificationInfo.reason}</p>
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {trimPreview && (
                    <div className="shrink-0">
                      <GroundTrimBar
                        text={trimPreviewText(trimPreview.ids.length, trimPreview.end)}
                        approximate={trimPreview.approximate}
                        onApply={applyTrim}
                        onCancel={() => setTrimPreview(null)}
                      />
                    </div>
                  )}

                  <WaypointList
                    waypoints={waypoints}
                    isLoading={isLoading}
                    hoveredId={hoveredId}
                    onHover={setHoveredId}
                    scrollTarget={scrollTarget}
                    onRowClick={handleRowClick}
                    onUpdateWaypoint={updateWaypoint}
                    onTabKeyNavigation={handleTabKeyNavigation}
                    onInputFocus={handleInputFocus}
                    onToggleSelectAll={toggleSelectAll}
                    onDeleteSelected={deleteSelectedWaypoints}
                    onClearAltitudes={clearSelectedAltitudes}
                    ghostIds={ghostIds}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t">
                  {/* Flight numbers and time are saved with a plan: only offered when signed in */}
                  {flightNumberSection(false)}
                  {flightTimeSection(false)}
                  <GroundMovements
                    previewing={trimPreview?.end ?? null}
                    busy={trimBusy}
                    trimmed={trimmed}
                    disabled={waypoints.length < 3 || !icaoValidation.origin || !icaoValidation.destination}
                    onToggle={toggleTrimPreview}
                  />
                  {optionsContent}
                  {brandingSection(false)}
                </div>
              )}
            </>
          }
          footer={<div className="px-4 py-3">{exportButtons}</div>}
        />
        <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{copy.editor.leaveTitle}</DialogTitle>
              <DialogDescription>{copy.editor.leaveBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmLeave(false)}>
                {copy.editor.leaveStay}
              </Button>
              <Button variant="destructive" onClick={startOver}>
                {copy.editor.leaveConfirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Toaster />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <PageShell title={pageTitle} description={pageDescription} actions={resetAction} width={narrowPage ? "narrow" : "full"}>
        {resumeNotice}

        {mode === "draw" && resume.state === "idle" && (
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

                <div
                  className={cn(
                    "mt-4 grid overflow-hidden rounded-md border",
                    canSave ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]",
                  )}
                >
                  {exportOptions(true)}
                  <div className="p-4 sm:w-72">{exportButtons}</div>
                </div>
              </CardContent>
            </Card>
            {accountHint}
          </>
        )}

        {mode === "import" && !hasImported && resume.state === "idle" && (
          <div>
            {error && alerts}
            <StartLayout
              from={
                <AirportInput
                  id="origin"
                  label="From"
                  value={originAirport}
                  valid={icaoValidation.origin}
                  onChange={(value) => handleICAOChange("origin", value)}
                  placeholder="Paris or LFPG"
                />
              }
              to={
                <AirportInput
                  id="destination"
                  label="To"
                  value={destinationAirport}
                  valid={icaoValidation.destination}
                  onChange={(value) => handleICAOChange("destination", value)}
                  placeholder="San Francisco or KSFO"
                />
              }
              importButton={
                <>
                  <Button
                    size="lg"
                    className="h-14 w-full text-base"
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
                  <input ref={fileInputRef} type="file" accept=".kml" onChange={handleFileImport} className="hidden" />
                </>
              }
              hint={accountHint}
            />
          </div>
        )}

        <Toaster />
      </PageShell>
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
