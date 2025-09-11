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
  Plus,
  Info,
  Map,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Settings,
  Pencil,
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
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { Toaster } from "@/components/ui/toaster"

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapPreview = dynamic(() => import("@/components/map-preview"), {
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
}

interface SimplificationInfo {
  originalCount: number
  simplifiedCount: number
  reason: string
  source?: string // Added to track the source of the KML file
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
  const [isEditingMap, setIsEditingMap] = useState(false) // New state for map editing mode

  // New states for airport code prompt dialog
  const [showAirportPrompt, setShowAirportPrompt] = useState(false)
  const [promptOriginAirport, setPromptOriginAirport] = useState("")
  const [promptDestinationAirport, setPromptDestinationAirport] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Refs for sticky header height calculation
  const cardHeaderRef = useRef<HTMLDivElement>(null)
  const [tableBarTopPosition, setTableBarTopPosition] = useState(0)

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  // Calculate sticky table bar top position
  useEffect(() => {
    const calculateTopPosition = () => {
      if (cardHeaderRef.current) {
        // Get the height of the card header (which is sticky at top-0)
        const headerHeight = cardHeaderRef.current.offsetHeight
        // Set the top position to 81px as requested
        setTableBarTopPosition(81)
      }
    }

    // Recalculate on mount and resize
    calculateTopPosition()
    window.addEventListener("resize", calculateTopPosition)

    return () => {
      window.removeEventListener("resize", calculateTopPosition)
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

  // Validate the flight plan when waypoints change
  useEffect(() => {
    if (waypoints.length > 2) {
      validateFlightPlan(waypoints)
    } else {
      setWarning(null)
    }
  }, [waypoints])

  // Apply "Made with Infinite Planner" when checkbox changes
  useEffect(() => {
    if (waypoints.length >= 5 && useMadeWithInfinitePlanner) {
      // Changed from 4 to 5
      applyMadeWithInfinitePlanner()
    } else if (waypoints.length >= 5 && !useMadeWithInfinitePlanner) {
      // Changed from 4 to 5
      // Restore original numbering when unchecked
      const renamedWaypoints = waypoints.map((wp, index) => ({
        ...wp,
        name: String(index + 1).padStart(3, "0"),
      }))
      setWaypoints(renamedWaypoints)
    }
  }, [useMadeWithInfinitePlanner])

  // Handle focus event to select all text in the input field
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all text when the input is focused
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

      // Find the current waypoint index
      const currentIndex = waypoints.findIndex((wp) => wp.id === waypointId)

      // If there's a next waypoint, focus its name input
      if (currentIndex < waypoints.length - 1) {
        const nextWaypointId = waypoints[currentIndex + 1].id
        const nextInput = document.getElementById(`name-${nextWaypointId}`)
        if (nextInput) {
          nextInput.focus()
          // The focus event will trigger the selection of all text
        }
      }
    }
  }

  // Validate the flight plan for potential issues
  const validateFlightPlan = (waypoints: Waypoint[]) => {
    // Check for large jumps in the route (potential duplicate segments)
    let maxDistance = 0
    let avgDistance = 0
    let totalDistance = 0

    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1]
      const curr = waypoints[i]

      const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng)
      totalDistance += distance

      if (distance > maxDistance) {
        maxDistance = distance
      }
    }

    avgDistance = totalDistance / (waypoints.length - 1)

    // If the max distance is significantly larger than the average, there might be a jump
    if (maxDistance > avgDistance * 5 && waypoints.length > 10) {
      setWarning(
        `Possible route discontinuity detected. The flight plan may have gaps or jumps. Consider reviewing the route in the map preview.`,
      )
    } else {
      setWarning(null)
    }
  }

  // Calculate distance between two points in kilometers (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Radius of the earth in km
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

  // Handle KML file import - now shows airport prompt first
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Store the file and show airport prompt dialog
    setPendingFile(file)
    setPromptOriginAirport("")
    setPromptDestinationAirport("")
    setShowAirportPrompt(true)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle airport prompt confirmation
  const handleAirportPromptConfirm = async () => {
    if (!pendingFile) return

    const file = pendingFile
    const fileName = file.name.replace(/\.[^/.]+$/, "")

    // Update the UI fields with the entered airport codes
    setOriginAirport(promptOriginAirport.trim().toUpperCase())
    setDestinationToAirport(promptDestinationAirport.trim().toUpperCase())

    // Close the dialog
    setShowAirportPrompt(false)
    setPendingFile(null)

    // Start the import process
    setIsLoading(true)
    setError(null)
    setWarning(null)
    setSuccessMessage(null)
    setImportedFileName(fileName)

    // Process the KML file with the entered airport codes
    await processKMLFile(
      file,
      fileName,
      promptOriginAirport.trim().toUpperCase(),
      promptDestinationAirport.trim().toUpperCase(),
    )
  }

  // Handle airport prompt cancellation
  const handleAirportPromptCancel = () => {
    setShowAirportPrompt(false)
    setPendingFile(null)
    setPromptOriginAirport("")
    setPromptDestinationAirport("")
  }

  // Separate function to process the KML file
  const processKMLFile = async (file: File, fileName: string, origin: string, destination: string) => {
    try {
      const text = await file.text()

      const result = parseKML(text, file.name, origin, destination)

      if (result.waypoints.length === 0) {
        setError("No valid waypoints found in the KML file. Please check the file format.")
      } else {
        // Apply sequential numbering (001, 002, 003...)
        const renamedWaypoints = result.waypoints.map((wp, index) => ({
          ...wp,
          name: String(index + 1).padStart(3, "0"),
        }))

        // Rename first and last waypoints with airport codes if provided
        if (origin && renamedWaypoints.length > 0) {
          renamedWaypoints[0] = {
            ...renamedWaypoints[0],
            name: origin,
          }
        }

        if (destination && renamedWaypoints.length > 1) {
          renamedWaypoints[renamedWaypoints.length - 1] = {
            ...renamedWaypoints[renamedWaypoints.length - 1],
            name: destination,
          }
        }

        setWaypoints(renamedWaypoints)
        setSimplificationInfo({
          originalCount: result.originalCount,
          simplifiedCount: result.simplifiedCount,
          reason: result.simplificationReason,
          source: result.source,
        })

        // Automatically open map preview if we have waypoints
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

      // Split the text file by lines and filter out empty lines
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")

      // Create a copy of the waypoints
      const updatedWaypoints = [...waypoints]

      // Update waypoint names with the lines from the text file
      for (let i = 0; i < updatedWaypoints.length; i++) {
        if (i < lines.length) {
          // If we have a line for this waypoint, use it as the name
          updatedWaypoints[i] = {
            ...updatedWaypoints[i],
            name: lines[i].trim(),
          }
        } else {
          // If we don't have a line for this waypoint, clear the name
          updatedWaypoints[i] = {
            ...updatedWaypoints[i],
            name: "",
          }
        }
      }

      // Update the waypoints
      setWaypoints(updatedWaypoints)

      // Show a warning if there are more lines than waypoints
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

    // Reset file input
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

      // Use the imported file name if available, otherwise use default
      const fileName = importedFileName ? `${importedFileName}.fpl` : "flightplan.fpl"
      a.download = fileName

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Increment the counter using the API endpoint
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

  // Insert a new waypoint after each selected waypoint
  const insertWaypoint = () => {
    const selectedWaypoints = waypoints.filter((wp) => wp.selected)
    if (selectedWaypoints.length === 0) {
      setError("Please select at least one waypoint to insert after.")
      return
    }

    const newWaypoints: Waypoint[] = []
    let insertedCount = 0

    waypoints.forEach((wp) => {
      newWaypoints.push(wp)
      if (wp.selected) {
        const newWaypoint: Waypoint = {
          id: Date.now().toString() + insertedCount, // Ensure unique ID
          name: "New Waypoint", // Name new waypoints as "New Waypoint"
          lat: wp.lat, // Inherit lat/lng from the selected waypoint
          lng: wp.lng,
          altitude: wp.altitude, // Inherit altitude
          selected: false,
        }
        newWaypoints.push(newWaypoint)
        insertedCount++
      }
    })

    // Do NOT renumber existing waypoints
    setWaypoints(newWaypoints)
    setSuccessMessage(
      `Inserted ${insertedCount} new waypoint${insertedCount !== 1 ? "s" : ""} after selected waypoints!`,
    )
  }

  // Update waypoint field
  const updateWaypoint = (id: string, field: keyof Waypoint, value: string | number) => {
    setWaypoints(
      waypoints.map((wp) =>
        wp.id === id ? { ...wp, [field]: typeof value === "string" ? value : Number(value) } : wp,
      ),
    )
  }

  // Toggle waypoint selection
  const toggleWaypointSelection = (id: string) => {
    setWaypoints(waypoints.map((wp) => (wp.id === id ? { ...wp, selected: !wp.selected } : wp)))
  }

  // Delete selected waypoints
  const deleteSelectedWaypoints = () => {
    const selectedCount = waypoints.filter((wp) => wp.selected).length

    if (selectedCount === 0) {
      setError("No waypoints selected for deletion")
      return
    }

    const newWaypoints = waypoints.filter((wp) => !wp.selected)

    // Do NOT renumber existing waypoints
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

    const renamedWaypoints = waypoints.map((wp, index) => ({
      ...wp,
      name: `${waypointPrefix}${String(index + 1).padStart(3, "0")}`,
    }))

    setWaypoints(renamedWaypoints)
    setSuccessMessage(`Prefix "${waypointPrefix}" applied to all waypoints!`)
  }

  // Apply "Made with Infinite Planner" to waypoints excluding the very last one
  const applyMadeWithInfinitePlanner = () => {
    if (waypoints.length < 5) {
      // Changed from 4 to 5 since we need at least 5 waypoints (4 for "MADE WITH INFINITE PLANNER" + 1 for destination)
      setError("Need at least 5 waypoints to apply 'Made with Infinite Planner' (preserving destination airport)")
      return
    }

    const madeWithNames = ["MADE", "WITH", "INFINITE", "PLANNER"]
    const updatedWaypoints = waypoints.map((wp, index) => {
      // Apply to positions: length-5, length-4, length-3, length-2 (skipping length-1 which is the last waypoint)
      const isTargetPosition = index >= waypoints.length - 5 && index < waypoints.length - 1
      if (isTargetPosition && useMadeWithInfinitePlanner) {
        const nameIndex = index - (waypoints.length - 5)
        return { ...wp, name: madeWithNames[nameIndex] }
      }
      return wp
    })

    setWaypoints(updatedWaypoints)
    setSuccessMessage("Applied 'Made with Infinite Planner' to waypoints (preserving destination airport)!")
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
              altitude: 0, // Clear altitude when position is manually edited
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
        name: "", // Empty name as requested
        lat,
        lng,
        altitude: 0, // Empty altitude as requested
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
    setIsEditingMap((prev) => !prev)
    if (!isEditingMap) {
      setSuccessMessage(
        "Map editing mode enabled. Drag waypoints to adjust their position or hover over the route to add new waypoints.",
      )
    } else {
      setSuccessMessage("Map editing mode disabled. Waypoints updated in table.")
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="bg-background shadow-sm border-border">
        {/* Make the header sticky */}
        <div ref={cardHeaderRef} className="sticky top-0 z-10">
          <CardHeader className="pb-4 border-b bg-background shadow-sm">
            <div className="flex flex-col gap-4">
              {/* Action Buttons and Airport Fields */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 h-10 px-3 sm:px-4"
                    disabled={isLoading}
                  >
                    <Upload size={14} />
                    <span className="hidden sm:inline">{isLoading ? "Importing..." : "Import KML"}</span>
                    <span className="sm:hidden">Import</span>
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".kml" onChange={handleFileImport} className="hidden" />

                  <Button
                    onClick={() => setShowMapPreview(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 h-10 px-3 sm:px-4"
                    disabled={waypoints.length === 0 || isLoading}
                  >
                    <Map size={14} />
                    <span className="hidden sm:inline">Flight Map</span> {/* Renamed from Preview */}
                  </Button>

                  <Button
                    onClick={handleExportFPL}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 h-10 px-3 sm:px-4 bg-transparent"
                    disabled={waypoints.length === 0 || isLoading}
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Export FPL</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </div>

                {/* Airport Fields on the right */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="origin" className="text-sm font-medium whitespace-nowrap">
                      Origin
                    </Label>
                    <Input
                      id="origin"
                      value={originAirport}
                      onChange={(e) => setOriginAirport(e.target.value.toUpperCase())}
                      placeholder="EHAM"
                      className="h-8 w-20 text-center font-mono"
                      maxLength={4}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="destination" className="text-sm font-medium whitespace-nowrap">
                      Dest
                    </Label>
                    <Input
                      id="destination"
                      value={destinationAirport}
                      onChange={(e) => setDestinationToAirport(e.target.value.toUpperCase())}
                      placeholder="KSFO"
                      className="h-8 w-20 text-center font-mono"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </div>
        <CardContent className="pt-6">
          {error && (
            <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <Info className="h-4 w-4 text-red-500 dark:text-red-400" />
              <AlertTitle className="text-red-700 dark:text-red-400">Error</AlertTitle>
              <AlertDescription className="text-red-600 dark:text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          {warning && (
            <Alert className="mb-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <AlertTitle className="text-amber-700 dark:text-amber-400">Warning</AlertTitle>
              <AlertDescription className="text-amber-600 dark:text-amber-300">{warning}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
              <AlertTitle className="text-green-700 dark:text-green-400">Success</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-300">{successMessage}</AlertDescription>
            </Alert>
          )}

          {simplificationInfo && (
            <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <AlertTitle className="text-blue-700 dark:text-blue-400">Waypoint Simplification Applied</AlertTitle>
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

          {/* Table Action Bar (Select All, Delete, Clear Altitudes, Insert Waypoint, FPL Options) */}
          <div
            className="sticky z-10 bg-background pb-4 pt-2 border-b mb-4 flex flex-wrap items-center justify-between gap-4"
            style={{ top: `${tableBarTopPosition}px` }}
          >
            <div className="flex items-center space-x-2">
              <Checkbox id="selectAll" onCheckedChange={(checked) => toggleSelectAll(!!checked)} />
              <Label htmlFor="selectAll" className="text-sm font-medium">
                Select All
              </Label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedWaypoints}
                disabled={!waypoints.some((wp) => wp.selected) || isLoading}
                className="flex items-center gap-1 h-10"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Delete</span>
                <span className="sm:hidden">Delete</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={clearSelectedAltitudes}
                disabled={!waypoints.some((wp) => wp.selected) || isLoading}
                className="flex items-center gap-1 h-10"
              >
                <Info size={14} />
                <span className="hidden sm:inline">Clear Alt</span>
                <span className="sm:hidden">Clear Alt</span>
              </Button>

              {/* Insert Waypoint button */}
              <Button
                variant="default"
                size="sm"
                onClick={insertWaypoint}
                className="flex items-center gap-1 h-10"
                disabled={isLoading || waypoints.filter((wp) => wp.selected).length === 0} // Disabled if no selection
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Insert Waypoint</span>
                <span className="sm:hidden">Insert</span>
              </Button>

              {/* FPL Options Button - Changed from Batch Renaming */}
              <Button
                onClick={() => document.getElementById("fpl-options-section")?.scrollIntoView({ behavior: "smooth" })}
                variant="outline"
                size="sm"
                className="flex items-center gap-1 h-10 px-3 sm:px-4"
                disabled={waypoints.length === 0 || isLoading}
              >
                <Settings size={14} />
                <span className="hidden sm:inline">FPL Options...</span>
                <span className="sm:hidden">Options</span>
              </Button>
            </div>
          </div>

          {/* Waypoint Table */}
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Latitude</TableHead>
                  <TableHead className="hidden md:table-cell">Longitude</TableHead>
                  <TableHead className="hidden md:table-cell">Altitude (ft)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 2 : 5} className="text-center py-8 text-muted-foreground">
                      Loading waypoints...
                    </TableCell>
                  </TableRow>
                ) : waypoints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 2 : 5} className="text-center py-8 text-muted-foreground">
                      No waypoints added. Import a KML file or add waypoints manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  waypoints.map((waypoint) => (
                    <TableRow
                      key={waypoint.id}
                      className="bg-card hover:bg-muted/50 h-12" // Removed drag-related classes
                    >
                      <TableCell className="w-12 py-2 pl-4 pr-2">
                        {" "}
                        {/* Reverted to default padding, removed flex for vertical alignment */}
                        <Checkbox
                          id={`wp-${waypoint.id}`}
                          checked={waypoint.selected}
                          onCheckedChange={() => toggleWaypointSelection(waypoint.id)}
                          className="flex-shrink-0"
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        {" "}
                        {/* Reverted to default padding */}
                        <Input
                          id={`name-${waypoint.id}`}
                          value={waypoint.name}
                          onChange={(e) => updateWaypoint(waypoint.id, "name", e.target.value)}
                          onKeyDown={(e) => handleTabKeyNavigation(e, waypoint.id, "name")}
                          onFocus={handleInputFocus}
                          className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full" // Added w-full to input
                          style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2">
                        {" "}
                        {/* Reverted to default padding */}
                        <Input
                          type="number"
                          step="0.0001"
                          value={waypoint.lat}
                          onChange={(e) => updateWaypoint(waypoint.id, "lat", Number.parseFloat(e.target.value) || 0)}
                          onFocus={handleInputFocus}
                          className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full" // Added w-full to input
                          style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2">
                        {" "}
                        {/* Reverted to default padding */}
                        <Input
                          type="number"
                          step="0.0001"
                          value={waypoint.lng}
                          onChange={(e) => updateWaypoint(waypoint.id, "lng", Number.parseFloat(e.target.value) || 0)}
                          onFocus={handleInputFocus}
                          className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full" // Added w-full to input
                          style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2">
                        {" "}
                        {/* Reverted to default padding */}
                        <Input
                          type="number"
                          value={waypoint.altitude}
                          onChange={(e) =>
                            updateWaypoint(waypoint.id, "altitude", Number.parseInt(e.target.value) || 0)
                          }
                          onFocus={handleInputFocus}
                          className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full" // Added w-full to input
                          style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* FPL Options Section - Renamed from Waypoints Batch Section */}
          {waypoints.length > 0 && (
            <div id="fpl-options-section" className="mb-6 border-t pt-6 mt-6">
              {" "}
              {/* Added mt-6 for spacing */}
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-medium">FPL Options</h3>
              </div>
              <div className="space-y-6">
                {/* Import TXT to Waypoints */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Import TXT to Waypoints</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Import a text file to populate waypoint names. Each line in the file will be used as a waypoint
                    name.
                  </p>
                  <Button
                    onClick={() => txtFileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 h-9"
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

                {/* Waypoint Prefix */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Waypoint Prefix</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add a prefix to all waypoint names (e.g., "WP" will result in "WP001", "WP002", etc.).
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-grow max-w-xs">
                      <Input
                        id="waypointPrefix"
                        value={waypointPrefix}
                        onChange={(e) => setWaypointPrefix(e.target.value)}
                        placeholder="Enter prefix (e.g., WP)"
                        onFocus={handleInputFocus}
                        className="h-9 font-[var(--font-ibm-plex-mono)]"
                        style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                      />
                    </div>
                    <Button
                      onClick={applyWaypointPrefix}
                      size="sm"
                      className="h-9"
                      disabled={isLoading || waypoints.length === 0}
                    >
                      Apply Prefix
                    </Button>
                  </div>
                </div>

                {/* Made with Infinite Planner */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Made with Infinite Planner</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Replace waypoints with "MADE", "WITH", "INFINITE", "PLANNER" (preserving the destination airport as
                    the last waypoint)
                  </p>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="madeWithInfinitePlanner"
                      checked={useMadeWithInfinitePlanner}
                      onCheckedChange={(checked) => setUseMadeWithInfinitePlanner(!!checked)}
                      disabled={waypoints.length < 5} // Changed from 4 to 5
                    />
                    <Label htmlFor="madeWithInfinitePlanner" className="text-sm">
                      Use "Made with Infinite Planner" (preserving destination airport)
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
      </Card>

      {/* Airport Code Prompt Dialog */}
      <Dialog open={showAirportPrompt} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Airport Codes</DialogTitle>
            <DialogDescription>
              Please enter the origin and destination airport ICAO codes for this flight plan. These will be used for
              statistics and to name the first and last waypoints.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="promptOrigin">Origin Airport (ICAO)</Label>
              <Input
                id="promptOrigin"
                value={promptOriginAirport}
                onChange={(e) => setPromptOriginAirport(e.target.value.toUpperCase())}
                placeholder="e.g., EHAM"
                className="font-mono text-center"
                maxLength={4}
                onFocus={handleInputFocus}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promptDestination">Destination Airport (ICAO)</Label>
              <Input
                id="promptDestination"
                value={promptDestinationAirport}
                onChange={(e) => setPromptDestinationAirport(e.target.value.toUpperCase())}
                placeholder="e.g., KSFO"
                className="font-mono text-center"
                maxLength={4}
                onFocus={handleInputFocus}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleAirportPromptCancel}>
              Cancel
            </Button>
            <Button onClick={handleAirportPromptConfirm}>Continue Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map Preview Dialog */}
      <Dialog
        open={showMapPreview}
        onOpenChange={(open) => {
          // Prevent closing if editing is active
          if (!isEditingMap) {
            setShowMapPreview(open)
          }
        }}
      >
        <DialogContent
          className="max-w-[95vw] w-full h-[90vh] p-0" // Remove flex flex-col
          onEscapeKeyDown={(e) => isEditingMap && e.preventDefault()}
          onPointerDownOutside={(e) => isEditingMap && e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-6">
            <div>
              <DialogTitle>Flight Plan Preview</DialogTitle>
              <DialogDescription>Visualize your flight plan with {waypoints.length} waypoints</DialogDescription>
            </div>
            {waypoints.length > 0 && (
              <Button
                onClick={toggleMapEditing}
                variant={isEditingMap ? "default" : "outline"}
                className="flex items-center gap-2 ml-4" // Add ml-4 for spacing from close button
              >
                <Pencil size={16} />
                {isEditingMap ? "Done Editing" : "Edit Waypoints"}
              </Button>
            )}
          </DialogHeader>

          {/* Map container - takes remaining space */}
          <div className="flex-1 w-full relative px-6">
            <div className="h-[calc(90vh-120px)] w-full">
              {" "}
              {/* Back to calculated height */}
              <MapPreview
                waypoints={waypoints}
                isEditing={isEditingMap}
                onWaypointDragEnd={handleWaypointDragEnd}
                onWaypointInsert={handleWaypointInsert}
              />
            </div>
          </div>

          {/* Footer with Close button - always at bottom */}
          <div className="flex-shrink-0 px-6 pb-6">
            <div className="flex justify-end">
              <Button
                onClick={() => setShowMapPreview(false)}
                disabled={isEditingMap}
                variant="outline"
                className="min-w-[80px]"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}
