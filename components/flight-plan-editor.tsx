"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Download, Upload, Trash2, Plus, Info, Map, AlertTriangle, Plane } from "lucide-react"
import { parseKML } from "@/lib/kml-parser"
import { generateFPL } from "@/lib/fpl-generator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme } = useTheme()

  // Validate the flight plan when waypoints change
  useEffect(() => {
    if (waypoints.length > 2) {
      validateFlightPlan(waypoints)
    } else {
      setWarning(null)
    }
  }, [waypoints])

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

  // Handle KML file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setWarning(null)

    try {
      const text = await file.text()
      console.log("KML file loaded, parsing...")

      const result = parseKML(text)
      console.log(`Parsing complete: ${result.waypoints.length} waypoints`)

      if (result.waypoints.length === 0) {
        setError("No valid waypoints found in the KML file. Please check the file format.")
      } else {
        // Apply sequential numbering (001, 002, 003...)
        const renamedWaypoints = result.waypoints.map((wp, index) => ({
          ...wp,
          name: String(index + 1).padStart(3, "0"),
        }))

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
      }
    } catch (error) {
      console.error("Error importing KML file:", error)
      setError(`Error importing KML file: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsLoading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Generate and download FPL file
  const handleExportFPL = () => {
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
      a.download = "flightplan.fpl"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting FPL file:", error)
      setError(`Error exporting FPL file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Add a new waypoint
  const addWaypoint = () => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      name: String(waypoints.length + 1).padStart(3, "0"),
      lat: 0,
      lng: 0,
      altitude: 0,
    }
    setWaypoints([...waypoints, newWaypoint])
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
    const newWaypoints = waypoints.filter((wp) => !wp.selected)

    // Renumber waypoints after deletion
    const renamedWaypoints = newWaypoints.map((wp, index) => ({
      ...wp,
      name: String(index + 1).padStart(3, "0"),
    }))

    setWaypoints(renamedWaypoints)
  }

  // Select/deselect all waypoints
  const toggleSelectAll = (checked: boolean) => {
    setWaypoints(waypoints.map((wp) => ({ ...wp, selected: checked })))
  }

  return (
    <div className="container mx-auto py-8 px-4 bg-white dark:bg-slate-900">
      <Card className="bg-background shadow-sm border-border">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-primary rounded-md">
                <Plane className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-foreground">Infinite Planner</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Turn real-world flights into Infinite Flight custom flight plans!
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                disabled={isLoading}
              >
                <Upload size={14} />
                {isLoading ? "Importing..." : "Import KML"}
              </Button>
              <input ref={fileInputRef} type="file" accept=".kml" onChange={handleFileImport} className="hidden" />

              <Button
                onClick={() => setShowMapPreview(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                disabled={waypoints.length === 0 || isLoading}
              >
                <Map size={14} />
                Preview
              </Button>

              <Button
                onClick={handleExportFPL}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                disabled={waypoints.length === 0 || isLoading}
              >
                <Download size={14} />
                Export FPL
              </Button>
            </div>
          </div>
        </CardHeader>
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

          {simplificationInfo && (
            <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <AlertTitle className="text-blue-700 dark:text-blue-400">Waypoint Simplification Applied</AlertTitle>
              <AlertDescription className="text-blue-600 dark:text-blue-300">
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

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="selectAll" onCheckedChange={(checked) => toggleSelectAll(!!checked)} />
              <Label htmlFor="selectAll" className="text-sm font-medium">
                Select All
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedWaypoints}
                disabled={!waypoints.some((wp) => wp.selected) || isLoading}
                className="flex items-center gap-1 h-8"
              >
                <Trash2 size={14} />
                Delete Selected
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={addWaypoint}
                className="flex items-center gap-1 h-8"
                disabled={isLoading}
              >
                <Plus size={14} />
                Add Waypoint
              </Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead>Altitude (ft)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading waypoints...
                    </TableCell>
                  </TableRow>
                ) : waypoints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No waypoints added. Import a KML file or add waypoints manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  waypoints.map((waypoint) => (
                    <TableRow key={waypoint.id} className="hover:bg-muted/50">
                      <TableCell className="w-12">
                        <Checkbox
                          id={`wp-${waypoint.id}`}
                          checked={waypoint.selected}
                          onCheckedChange={() => toggleWaypointSelection(waypoint.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={waypoint.name}
                          onChange={(e) => updateWaypoint(waypoint.id, "name", e.target.value)}
                          className="h-8 border-input"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.0001"
                          value={waypoint.lat}
                          onChange={(e) => updateWaypoint(waypoint.id, "lat", Number.parseFloat(e.target.value) || 0)}
                          className="h-8 border-input"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.0001"
                          value={waypoint.lng}
                          onChange={(e) => updateWaypoint(waypoint.id, "lng", Number.parseFloat(e.target.value) || 0)}
                          className="h-8 border-input"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={waypoint.altitude}
                          onChange={(e) =>
                            updateWaypoint(waypoint.id, "altitude", Number.parseInt(e.target.value) || 0)
                          }
                          className="h-8 border-input"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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

      {/* Map Preview Dialog */}
      <Dialog open={showMapPreview} onOpenChange={setShowMapPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Flight Plan Preview</DialogTitle>
            <DialogDescription>Visualize your flight plan with {waypoints.length} waypoints</DialogDescription>
          </DialogHeader>
          <div className="h-[500px] w-full">
            <MapPreview waypoints={waypoints} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-muted-foreground border-t pt-4">
        <p>Infinite Planner is not affiliated with FlightRadar24, FlightAware, or Infinite Flight.</p>
      </footer>
    </div>
  )
}
