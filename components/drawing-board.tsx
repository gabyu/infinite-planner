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
import { cn } from "@/lib/utils"
import { MousePointer2, Slash, PenTool, Undo2, Redo2, Trash2, Eraser, Monitor } from "lucide-react"

const DrawMap = dynamic(() => import("@/components/draw-map-wrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
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

  const icaoClass = (value: string, valid: boolean) =>
    cn(
      "w-24 text-center font-mono uppercase tracking-widest",
      value && !valid
        ? "border-destructive focus-visible:ring-destructive"
        : valid
          ? "border-emerald-500/70 focus-visible:ring-emerald-500"
          : "",
    )

  if (isTouchPrimary) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border bg-muted/30 px-6 py-16 text-center">
        <Monitor className="mb-4 h-8 w-8 text-muted-foreground" />
        <h3 className="mb-1.5 text-base font-medium">Desktop only, for now</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Flight plan drawing is currently available on desktop only. Open this page on a computer to draw a route.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ICAO metadata row */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center gap-2.5">
          <Label htmlFor="draw-origin" className="studio-label">
            Departure
          </Label>
          <Input
            id="draw-origin"
            value={originAirport}
            onChange={(e) => onICAOChange("origin", e.target.value)}
            placeholder="EHAM"
            autoComplete="off"
            maxLength={4}
            className={icaoClass(originAirport, icaoValidation.origin)}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <Label htmlFor="draw-destination" className="studio-label">
            Arrival
          </Label>
          <Input
            id="draw-destination"
            value={destinationAirport}
            onChange={(e) => onICAOChange("destination", e.target.value)}
            placeholder="KSFO"
            autoComplete="off"
            maxLength={4}
            className={icaoClass(destinationAirport, icaoValidation.destination)}
          />
        </div>
        <p className="text-xs text-muted-foreground">Optional while drawing, required to export.</p>
      </div>

      {/* Drawing canvas with floating toolbar */}
      <div className="relative h-[75vh] min-h-[500px] max-h-[900px] w-full overflow-hidden rounded-md border">
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
        <div className="absolute left-2 top-2 z-[1000] flex items-center gap-1 rounded-md border bg-card/95 p-1 shadow-md backdrop-blur-sm">
          <Button
            variant={activeTool === "select" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("select")}
            title="Selection tool"
          >
            <MousePointer2 size={16} />
          </Button>
          <Button
            variant={activeTool === "line" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("line")}
            title="Line tool"
          >
            <Slash size={16} />
          </Button>
          <Button
            variant={activeTool === "pen" ? "default" : "outline"}
            size="icon"
            onClick={() => setActiveTool("pen")}
            title="Pen tool"
          >
            <PenTool size={16} />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 size={16} />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <Button
            variant="outline"
            size="icon"
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            title="Delete selected waypoint"
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowClearConfirm(true)}
            disabled={waypoints.length === 0}
            title="Clear drawing"
          >
            <Eraser size={16} />
          </Button>
        </div>

        {/* Empty state guidance */}
        {waypoints.length === 0 && activeTool === "select" && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
            <div className="flex items-center gap-2 rounded-full border bg-card/90 px-3.5 py-1.5 text-xs text-muted-foreground shadow-md">
              <MousePointer2 className="h-3.5 w-3.5" />
              Choose the Line or Pen tool and start drawing
            </div>
          </div>
        )}

        {activeTool === "pen" && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
            <div className="rounded-full border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md">
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
