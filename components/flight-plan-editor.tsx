"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Download,
  Upload,
  Trash2,
  Map,
  CheckCircle2,
  Layers,
  Pencil,
  ChevronRight,
  HelpCircle,
  Mountain,
} from "lucide-react"
import { parseKML } from "@/lib/kml-parser"
import { generateFPL } from "@/lib/fpl-generator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { Toaster } from "@/components/ui/toaster"
import Image from "next/image"

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapPreview = dynamic(() => import("@/components/map-preview-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">Loading map...</div>
  ),
})

// Type for waypoints
interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
  locked?: boolean
}

interface SimplificationInfo {
  originalCount: number
  simplifiedCount: number
  reason: string
  source?: string
}

export function FlightPlanEditor() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
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
  const [useMadeWithInfinitePlanner, setUseMadeWithInfinitePlanner] = useState(false)
  const [isEditingMap, setIsEditingMap] = useState(false)
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

  // Apply "Made with Infinite Planner" when checkbox changes
  useEffect(() => {
    if (waypoints.length >= 6) {
      const updatedWaypoints = applyWaypointNamingRules(
        waypoints,
        originAirport,
        destinationAirport,
        useMadeWithInfinitePlanner,
      )
      setWaypoints(updatedWaypoints)
    }
  }, [useMadeWithInfinitePlanner, originAirport, destinationAirport])

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
        const renamedWaypoints = applyWaypointNamingRules(
          result.waypoints,
          origin,
          destination,
          useMadeWithInfinitePlanner,
        )
        setWaypoints(renamedWaypoints)
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
        if (i < lines.length && !updatedWaypoints[i].locked) {
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

  // Generate and download FPL file
  const handleExportFPL = async () => {
    if (waypoints.length === 0) {
      setError("No waypoints to export")
      return
    }

    try {
      const fplContent = generateFPL(waypoints)
      const blob = new Blob([fplContent], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      const fileName = importedFileName ? `${importedFileName}.fpl` : "flightplan.fpl"
      a.download = fileName

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      try {
        await fetch("/api/counter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        })
      } catch (counterError) {
        console.error("Error incrementing counter:", counterError)
      }

      setSuccessMessage(`Flight plan exported as ${fileName}!`)
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

    const newWaypoints = waypoints.filter((wp) => !wp.selected)

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
      if (wp.locked) return wp

      return {
        ...wp,
        name: `${waypointPrefix}${String(index).padStart(3, "0")}`,
      }
    })

    setWaypoints(renamedWaypoints)
    setSuccessMessage(`Prefix "${waypointPrefix}" applied to unlocked waypoints!`)
  }

  // Callback for when a waypoint is dragged on the map
  const handleWaypointDragEnd = useCallback((id: string, newLat: number, newLng: number) => {
    setWaypoints((prevWaypoints) => {
      const updated = prevWaypoints.map((wp) =>
        wp.id === id
          ? {
              ...wp,
              lat: newLat,
              lng: newLng,
              altitude: 0,
            }
          : wp,
      )
      setSuccessMessage(`Waypoint ${updated.find((wp) => wp.id === id)?.name} updated on map. Altitude cleared.`)
      return updated
    })
  }, [])

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

  // Toggle map editing mode
  const toggleMapEditing = () => {
    setIsEditingMap((prev) => {
      const newEditingState = !prev

      if (newEditingState) {
        setSuccessMessage(
          "Map editing mode enabled. Drag waypoints to adjust their position or hover over the route to add new waypoints.",
        )
      } else {
        const updatedWaypoints = applyWaypointNamingRules(
          waypoints,
          originAirport,
          destinationAirport,
          useMadeWithInfinitePlanner,
        )
        setWaypoints(updatedWaypoints)
        setSuccessMessage("Map editing mode disabled. Waypoint names updated according to rules.")
      }

      return newEditingState
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

  // Add helper function to apply waypoint naming rules
  const applyWaypointNamingRules = (
    waypoints: Waypoint[],
    origin: string,
    destination: string,
    useMadeWith = false,
  ) => {
    if (waypoints.length === 0) return waypoints

    const updatedWaypoints = waypoints.map((wp, index) => {
      const isFirst = index === 0
      const isLast = index === waypoints.length - 1

      if (isFirst) {
        return { ...wp, name: origin || "ORIG", locked: true }
      }

      if (isLast) {
        return { ...wp, name: destination || "DEST", locked: true }
      }

      if (useMadeWith && waypoints.length >= 6) {
        const madeWithNames = ["MADE", "WITH", "INFINITE", "PLANNER"]
        const isInMadeWithRange = index >= waypoints.length - 5 && index <= waypoints.length - 2

        if (isInMadeWithRange) {
          const madeWithIndex = index - (waypoints.length - 5)
          return { ...wp, name: madeWithNames[madeWithIndex], locked: true }
        }
      }

      return { ...wp, name: String(index).padStart(3, "0"), locked: false }
    })

    return updatedWaypoints
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-8 px-4">
        <div className={`${!isMobile && hasImported ? "flex gap-6" : ""}`}>
          {/* Main Content Area */}
          <div className={`${!isMobile && hasImported ? "flex-1" : "w-full"}`}>
            <Card className="bg-background shadow-sm border-border">
              {/* Header - Conditional rendering based on hasImported */}
              {!hasImported ? (
                /* Pre-import state - Large centered form */
                <div className="p-12">
                  <div className="text-center max-w-2xl mx-auto">
                    {/* Logo - hidden on mobile */}
                    <div className="hidden sm:flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center p-3">
                        <Image
                          src="/ip_logo.svg"
                          alt="Infinite Planner Logo"
                          width={48}
                          height={48}
                          className="w-full h-full"
                        />
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl font-normal text-gray-900 dark:text-gray-100 mb-4">Flight Information</h2>

                    {/* Description */}
                    <p className="text-gray-600 dark:text-gray-300 mb-10 text-lg">
                      Enter your flight's origin and destination airport codes, then upload your KML file from
                      FlightRadar24 or FlightAware.
                    </p>

                    {/* Form */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-8">
                      <div className="flex flex-col gap-6">
                        {/* ICAO inputs row */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                          <div className="flex items-center gap-3">
                            <Label htmlFor="origin" className="text-sm font-medium whitespace-nowrap w-24 text-right">
                              Origin
                            </Label>
                            <Input
                              id="origin"
                              value={originAirport}
                              onChange={(e) => handleICAOChange("origin", e.target.value)}
                              placeholder="EHAM"
                              className={`h-12 w-28 text-center font-mono text-lg ${
                                originAirport && !icaoValidation.origin
                                  ? "border-red-500 focus:border-red-500"
                                  : icaoValidation.origin
                                    ? "border-green-500 focus:border-green-500"
                                    : ""
                              }`}
                              maxLength={4}
                            />
                          </div>

                          {/* Chevron - hidden on mobile and tablet */}
                          <ChevronRight className="hidden lg:block text-gray-400" size={24} />

                          <div className="flex items-center gap-3">
                            <Label
                              htmlFor="destination"
                              className="text-sm font-medium whitespace-nowrap w-24 text-right"
                            >
                              Destination
                            </Label>
                            <Input
                              id="destination"
                              value={destinationAirport}
                              onChange={(e) => handleICAOChange("destination", e.target.value)}
                              placeholder="KSFO"
                              className={`h-12 w-28 text-center font-mono text-lg ${
                                destinationAirport && !icaoValidation.destination
                                  ? "border-red-500 focus:border-red-500"
                                  : icaoValidation.destination
                                    ? "border-green-500 focus:border-green-500"
                                    : ""
                              }`}
                              maxLength={4}
                            />
                          </div>
                        </div>

                        {/* Import button */}
                        <div className="flex justify-center">
                          <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="default"
                            size="lg"
                            className="h-12 px-8 text-base"
                            disabled={isLoading || !icaoValidation.origin || !icaoValidation.destination}
                            title={
                              !icaoValidation.origin || !icaoValidation.destination
                                ? "Enter valid departure and arrival ICAO codes to enable import"
                                : undefined
                            }
                          >
                            <Upload size={18} className="mr-2" />
                            <span>{isLoading ? "Importing..." : "Import KML File"}</span>
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".kml"
                            onChange={handleFileImport}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Post-import state - Content without header */
                <CardContent className="pt-6">
                  {/* Error Alert */}
                  {error && (
                    <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                      <Mountain className="h-4 w-4 text-red-500 dark:text-red-400" /> {/* Updated icon */}
                      <AlertTitle className="text-red-700 dark:text-red-400">Error</AlertTitle>
                      <AlertDescription className="text-red-600 dark:text-red-300">{error}</AlertDescription>
                    </Alert>
                  )}

                  {successMessage && (
                    <Alert className="mb-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                      <AlertTitle className="text-green-700 dark:text-green-400">Success</AlertTitle>
                      <AlertDescription className="text-green-600 dark:text-green-300">
                        {successMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Simplification Info Alert */}
                  {simplificationInfo && (
                    <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <Mountain className="h-4 w-4 text-blue-500 dark:text-blue-400" /> {/* Updated icon */}
                      <AlertTitle className="text-blue-700 dark:text-blue-400">
                        Waypoint Simplification Applied
                      </AlertTitle>
                      <AlertDescription className="text-blue-600 dark:text-blue-300">
                        <p>
                          Imported filename: <strong>{importedFileName || "Unknown"}.kml</strong>
                        </p>
                        <p>Original waypoints: {simplificationInfo.originalCount}</p>
                        <p>After simplification: {simplificationInfo.simplifiedCount}</p>
                        {simplificationInfo.source && (
                          <p>
                            Source: <strong>{simplificationInfo.source}</strong>
                          </p>
                        )}
                        <p className="text-xs mt-1">{simplificationInfo.reason}</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Table Action Bar */}
                  <div
                    className="sticky z-10 bg-background pb-4 pt-2 border-b mb-4 flex items-center justify-between gap-2"
                    style={{ top: "0px" }}
                  >
                    {/* Left side - Checkbox only */}
                    <div className="flex items-center">
                      <Checkbox id="selectAll" onCheckedChange={(checked) => toggleSelectAll(!!checked)} />
                    </div>

                    {/* Right side - Delete, Clear Alt, Options, Map and Export */}
                    <div className="flex gap-2">
                      {/* Delete Button */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedWaypoints}
                        disabled={!waypoints.some((wp) => wp.selected) || isLoading}
                        className="h-9 w-9 p-0"
                        title="Delete selected waypoints"
                      >
                        <Trash2 size={16} />
                      </Button>

                      {/* Clear Alt Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelectedAltitudes}
                        disabled={!waypoints.some((wp) => wp.selected) || isLoading}
                        className="h-9 w-9 p-0"
                        title="Clear altitudes of selected waypoints"
                      >
                        <Mountain size={16} />
                      </Button>

                      {/* Options Button - Mobile/Tablet only */}
                      <Button
                        onClick={() => {
                          setShowOptions(!showOptions)
                          // Scroll to options section
                          setTimeout(() => {
                            document
                              .getElementById("options-section")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" })
                          }, 100)
                        }}
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 lg:hidden"
                        title="Show options"
                      >
                        <Layers size={16} />
                      </Button>

                      {/* Map Button */}
                      <Button
                        onClick={() => setShowMapPreview(true)}
                        variant="outline"
                        size="sm"
                        disabled={waypoints.length === 0 || isLoading}
                        className="h-9 w-9 p-0"
                        title="View flight plan on map"
                      >
                        <Map size={16} />
                      </Button>

                      {/* Export Button */}
                      <Button
                        onClick={handleExportFPL}
                        size="sm"
                        disabled={waypoints.length === 0 || isLoading}
                        className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                        title="Export flight plan"
                      >
                        <Download size={16} />
                        <span className="text-sm">Export</span>
                      </Button>
                    </div>
                  </div>

                  {/* Waypoint Table */}
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="w-32">Name</TableHead>
                          <TableHead className="hidden md:table-cell w-40">Latitude</TableHead>
                          <TableHead className="hidden md:table-cell w-40">Longitude</TableHead>
                          <TableHead className="w-20">Alt ft.</TableHead> {/* Updated to show on mobile */}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={isMobile ? 3 : 5} className="text-center py-8 text-muted-foreground">
                              {" "}
                              {/* Adjusted colSpan */}
                              Loading waypoints...
                            </TableCell>
                          </TableRow>
                        ) : waypoints.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isMobile ? 3 : 5} className="text-center py-8 text-muted-foreground">
                              {" "}
                              {/* Adjusted colSpan */}
                              No waypoints added. Import a KML file to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          waypoints.map((waypoint, index) => (
                            <TableRow
                              key={waypoint.id}
                              className="bg-card hover:bg-muted/50 h-12 cursor-pointer"
                              onClick={(e) => handleRowClick(e, waypoint.id, index)}
                            >
                              <TableCell className="w-12 py-2 pl-4 pr-2">
                                <Checkbox
                                  id={`wp-${waypoint.id}`}
                                  checked={waypoint.selected}
                                  onCheckedChange={() => {}}
                                  className="flex-shrink-0 pointer-events-none"
                                />
                              </TableCell>
                              <TableCell className="py-2">
                                <Input
                                  id={`name-${waypoint.id}`}
                                  value={waypoint.name}
                                  onChange={(e) => updateWaypoint(waypoint.id, "name", e.target.value)}
                                  onKeyDown={(e) => handleTabKeyNavigation(e, waypoint.id, "name")}
                                  onFocus={handleInputFocus}
                                  className={`h-8 border-input font-[var(--font-ibm-plex-mono)] w-full max-w-[12ch] ${
                                    waypoint.locked ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed" : ""
                                  }`}
                                  style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                                  disabled={waypoint.locked}
                                  readOnly={waypoint.locked}
                                  maxLength={12}
                                />
                              </TableCell>
                              <TableCell className="hidden md:table-cell py-2 w-40">
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={waypoint.lat}
                                  onChange={(e) =>
                                    updateWaypoint(waypoint.id, "lat", Number.parseFloat(e.target.value) || 0)
                                  }
                                  onFocus={handleInputFocus}
                                  className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full"
                                  style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                                />
                              </TableCell>
                              <TableCell className="hidden md:table-cell py-2 w-40">
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={waypoint.lng}
                                  onChange={(e) =>
                                    updateWaypoint(waypoint.id, "lng", Number.parseFloat(e.target.value) || 0)
                                  }
                                  onFocus={handleInputFocus}
                                  className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full"
                                  style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                                />
                              </TableCell>
                              <TableCell className="py-2 w-20">
                                {" "}
                                {/* Updated to show on mobile */}
                                <Input
                                  type="number"
                                  value={waypoint.altitude}
                                  onChange={(e) =>
                                    updateWaypoint(waypoint.id, "altitude", Number.parseInt(e.target.value) || 0)
                                  }
                                  onFocus={handleInputFocus}
                                  className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full min-w-[80px]"
                                  style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Options Section - Below table on mobile/tablet */}
                  {showOptions && waypoints.length > 0 && (
                    <div id="options-section" className="mt-6 border-t pt-6 lg:hidden">
                      <div className="flex items-center gap-2 mb-4">
                        <Layers className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium">Options</h3>
                      </div>
                      <div className="space-y-6">
                        {/* Import TXT to Waypoints */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-medium">Import TXT to Waypoints</h4>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p>Import a text file to populate waypoint names.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Button
                            onClick={() => txtFileInputRef.current?.click()}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 h-9 w-full"
                            disabled={waypoints.length === 0}
                          >
                            <Upload size={14} />
                            <span>Import TXT File</span>
                          </Button>
                          <input
                            ref={txtFileInputRef}
                            type="file"
                            accept=".txt"
                            onChange={handleTxtImport}
                            className="hidden"
                          />
                        </div>

                        <Separator />

                        {/* Waypoint Prefix */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-medium">Waypoint Prefix</h4>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p>Add a prefix to all waypoint names (e.g., "WP").</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="space-y-2">
                            <Input
                              id="waypointPrefix"
                              value={waypointPrefix}
                              onChange={(e) => setWaypointPrefix(e.target.value)}
                              placeholder="Enter prefix (e.g., WP)"
                              onFocus={handleInputFocus}
                              className="h-9 font-[var(--font-ibm-plex-mono)]"
                              style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                            />
                            <Button
                              onClick={applyWaypointPrefix}
                              variant="outline"
                              size="sm"
                              className="w-full h-9 bg-transparent"
                              disabled={isLoading || waypoints.length === 0}
                            >
                              Apply Prefix
                            </Button>
                          </div>
                        </div>

                        <Separator />

                        {/* Made with Infinite Planner */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-medium">Made with Infinite Planner</h4>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p>Replace the last 4 waypoint names to share the love!</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="madeWithInfinitePlannerMobile"
                              checked={useMadeWithInfinitePlanner}
                              onCheckedChange={(checked) => setUseMadeWithInfinitePlanner(!!checked)}
                              disabled={waypoints.length < 6}
                            />
                            <Label htmlFor="madeWithInfinitePlannerMobile" className="text-sm">
                              Use "Made with Infinite Planner"
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {waypoints.length > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>
                        Total waypoints: {waypoints.length} {waypoints.length > 250 && "(Warning: Exceeds 250 limit)"}
                      </p>
                      <p className="mt-1">Route: {waypoints.map((wp) => wp.name).join(" → ")}</p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          {/* Options Panel - Desktop only, right side */}
          {!isMobile && hasImported && waypoints.length > 0 && (
            <div className="w-80 flex-shrink-0">
              <Card className="sticky bg-background shadow-sm border-border" style={{ top: "2rem" }}>
                <CardHeader className="pb-4 border-b">
                  <div className="text-center">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Your Flight Plan:</h3>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {originAirport || "ORIG"} → {destinationAirport || "DEST"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Flight Plan Map Button - First item */}
                    <div>
                      <Button
                        onClick={() => setShowMapPreview(true)}
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2 h-10"
                        disabled={waypoints.length === 0 || isLoading}
                      >
                        <Map size={16} />
                        <span>Flight Plan Map</span>
                      </Button>
                    </div>

                    <Separator className="my-4" />

                    {/* Import TXT to Waypoints */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-medium text-sm">Import TXT to Waypoints</h4>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>Import a text file to populate waypoint names.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Button
                        onClick={() => txtFileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center gap-1 h-9"
                        disabled={waypoints.length === 0}
                      >
                        <Upload size={14} />
                        <span>Import TXT File</span>
                      </Button>
                      <input
                        ref={txtFileInputRef}
                        type="file"
                        accept=".txt"
                        onChange={handleTxtImport}
                        className="hidden"
                      />
                    </div>

                    <Separator className="my-4" />

                    {/* Waypoint Prefix */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-medium text-sm">Waypoint Prefix</h4>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>Add a prefix to all waypoint names (e.g., "WP").</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="space-y-2">
                        <Input
                          id="waypointPrefix"
                          value={waypointPrefix}
                          onChange={(e) => setWaypointPrefix(e.target.value)}
                          placeholder="Enter prefix"
                          onFocus={handleInputFocus}
                          className="h-9 font-[var(--font-ibm-plex-mono)]"
                          style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                        />
                        <Button
                          onClick={applyWaypointPrefix}
                          variant="outline"
                          size="sm"
                          className="w-full h-9 bg-transparent"
                          disabled={isLoading || waypoints.length === 0}
                        >
                          Apply Prefix
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Made with Infinite Planner */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-medium text-sm">Made with Infinite Planner</h4>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>Replace the last 4 waypoint names to share the love!</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="madeWithInfinitePlanner"
                          checked={useMadeWithInfinitePlanner}
                          onCheckedChange={(checked) => setUseMadeWithInfinitePlanner(!!checked)}
                          disabled={waypoints.length < 6}
                        />
                        <Label htmlFor="madeWithInfinitePlanner" className="text-sm">
                          Use "Made with Infinite Planner"
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Export button at the bottom */}
                <CardContent className="pt-0 pb-6">
                  <Separator className="mb-4" />
                  <Button
                    onClick={handleExportFPL}
                    size="lg"
                    className="w-full flex items-center justify-center gap-2 h-12 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={waypoints.length === 0 || isLoading}
                  >
                    <Download size={16} />
                    <span>Export FPL</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

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
            className="max-w-6xl"
            onEscapeKeyDown={(e) => isEditingMap && e.preventDefault()}
            onPointerDownOutside={(e) => isEditingMap && e.preventDefault()}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <DialogTitle>Flight Plan Preview</DialogTitle>
                <DialogDescription>
                  <span className="hidden lg:inline">Visualize your flight plan with {waypoints.length} waypoints</span>
                  <span className="lg:hidden">{waypoints.length} waypoints</span> {/* Responsive description */}
                </DialogDescription>
              </div>
              {waypoints.length > 0 && (
                <Button
                  onClick={toggleMapEditing}
                  variant={isEditingMap ? "default" : "outline"}
                  className="flex items-center gap-2 ml-auto mr-4"
                >
                  <Pencil size={16} />
                  <span className="hidden sm:inline">{isEditingMap ? "Done Editing" : "Edit Waypoints"}</span>{" "}
                  {/* Responsive button text */}
                  <span className="sm:hidden">{isEditingMap ? "Done" : "Edit"}</span> {/* Responsive button text */}
                </Button>
              )}
            </DialogHeader>
            <div className="h-[500px] w-full relative">
              <MapPreview
                waypoints={waypoints}
                isEditing={isEditingMap}
                onWaypointDragEnd={handleWaypointDragEnd}
                onWaypointInsert={handleWaypointInsert}
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
