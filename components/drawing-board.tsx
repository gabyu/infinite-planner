"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { MousePointer2, Slash, PenTool, Undo2, Redo2, Trash2, Eraser, Monitor } from "lucide-react"

const DrawMap = dynamic(() => import("@/components/draw-map-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-md">
      Loading map...
    </div>
  ),
})

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

type DrawTool = "select" | "line" | "pen"

interface DrawingBoardProps {
  waypoints: Waypoint[]
  onAddPoints: (points: LatLngPoint[]) => void
  onCommitPenAnchor: (anchor: { lat: number; lng: number; handleOut: LatLngPoint | null; handleIn: LatLngPoint | null }) => void
  onWaypointDragEnd: (id: string, newLat: number, newLng: number) => void
  onHandleDragEnd: (anchorId: string, which: "handleOut" | "handleIn", newPoint: LatLngPoint) => void
  onToggleWaypointSelect: (id: string) => void
  onDeleteSelected: () => void
  onClear: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  originAirport: string
  destinationAirport: string
  icaoValidation: { origin: boolean; destination: boolean }
  onICAOChange: (field: "origin" | "destination", value: string) => void
  isTouchPrimary: boolean
}

export function DrawingBoard({
  waypoints,
  onAddPoints,
  onCommitPenAnchor,
  onWaypointDragEnd,
  onHandleDragEnd,
  onToggleWaypointSelect,
  onDeleteSelected,
  onClear,
  undo,
  redo,
  canUndo,
  canRedo,
  originAirport,
  destinationAirport,
  icaoValidation,
  onICAOChange,
  isTouchPrimary,
}: DrawingBoardProps) {
  const [activeTool, setActiveTool] = useState<DrawTool>("select")
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const hasSelection = waypoints.some((wp) => wp.selected)

  if (isTouchPrimary) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6 border rounded-md bg-muted/30">
        <Monitor className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Desktop only, for now</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Flight plan drawing is currently available on desktop only. Open this page on a computer to draw a route.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ICAO metadata row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="draw-origin" className="text-sm font-medium whitespace-nowrap">
            Departure
          </Label>
          <Input
            id="draw-origin"
            value={originAirport}
            onChange={(e) => onICAOChange("origin", e.target.value)}
            placeholder="EHAM"
            autoComplete="off"
            maxLength={4}
            className={`h-10 w-24 text-center font-mono ${
              originAirport && !icaoValidation.origin
                ? "border-red-500 focus:border-red-500"
                : icaoValidation.origin
                  ? "border-green-500 focus:border-green-500"
                  : ""
            }`}
          />
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="draw-destination" className="text-sm font-medium whitespace-nowrap">
            Arrival
          </Label>
          <Input
            id="draw-destination"
            value={destinationAirport}
            onChange={(e) => onICAOChange("destination", e.target.value)}
            placeholder="KSFO"
            autoComplete="off"
            maxLength={4}
            className={`h-10 w-24 text-center font-mono ${
              destinationAirport && !icaoValidation.destination
                ? "border-red-500 focus:border-red-500"
                : icaoValidation.destination
                  ? "border-green-500 focus:border-green-500"
                  : ""
            }`}
          />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-2">Optional while drawing, required to export.</p>
      </div>

      {/* Drawing canvas with floating toolbar */}
      <div className="relative h-[75vh] min-h-[500px] max-h-[900px] w-full border rounded-md overflow-hidden">
        <DrawMap
          waypoints={waypoints}
          activeTool={activeTool}
          onAddPoints={onAddPoints}
          onCommitPenAnchor={onCommitPenAnchor}
          onWaypointDragEnd={onWaypointDragEnd}
          onHandleDragEnd={onHandleDragEnd}
          onToggleWaypointSelect={onToggleWaypointSelect}
        />

        {/* Toolbar */}
        <div className="absolute top-2 left-2 z-[1000] flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-lg backdrop-blur-sm">
          <Button
            variant={activeTool === "select" ? "default" : "outline"}
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setActiveTool("select")}
            title="Selection tool"
          >
            <MousePointer2 size={16} />
          </Button>
          <Button
            variant={activeTool === "line" ? "default" : "outline"}
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setActiveTool("line")}
            title="Line tool"
          >
            <Slash size={16} />
          </Button>
          <Button
            variant={activeTool === "pen" ? "default" : "outline"}
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setActiveTool("pen")}
            title="Pen tool"
          >
            <PenTool size={16} />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 size={16} />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-0.5" />

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            title="Delete selected waypoint"
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setShowClearConfirm(true)}
            disabled={waypoints.length === 0}
            title="Clear drawing"
          >
            <Eraser size={16} />
          </Button>
        </div>

        {/* Empty state guidance */}
        {waypoints.length === 0 && activeTool === "select" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] pointer-events-none">
            <div className="flex items-center gap-2 rounded-full bg-background/90 border px-4 py-2 text-sm text-muted-foreground shadow-lg">
              <MousePointer2 className="h-4 w-4" />
              Choose the Line or Pen tool and start drawing
            </div>
          </div>
        )}

        {activeTool === "pen" && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
            <div className="rounded-full bg-background/90 border px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
              Click for a corner point &middot; click and drag to pull a curve handle &middot; Esc to cancel
            </div>
          </div>
        )}
      </div>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start over?</DialogTitle>
            <DialogDescription>This clears every waypoint you've drawn. You can undo it afterward.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onClear()
                setShowClearConfirm(false)
              }}
            >
              Yes, clear it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
