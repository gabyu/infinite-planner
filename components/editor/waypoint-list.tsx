"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { Mountain, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

interface ListWaypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
  locked?: boolean
}

interface WaypointListProps {
  /** The waypoints to show: one part of the route. */
  waypoints: ListWaypoint[]
  /** Where the first of them sits in the whole plan, so numbers and range selection stay global. */
  offset: number
  isLoading: boolean
  hoveredId: string | null
  onHover: (id: string | null) => void
  /** Set when a map point was clicked: the list scrolls to that row. `nonce` makes a repeat click count. */
  scrollTarget: { id: string; nonce: number } | null
  onRowClick: (e: React.MouseEvent, id: string, index: number) => void
  onUpdateWaypoint: (id: string, field: "name" | "lat" | "lng" | "altitude", value: string | number) => void
  onTabKeyNavigation: (e: React.KeyboardEvent<HTMLInputElement>, waypointId: string, fieldName: "name") => void
  onInputFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onToggleSelectAll: (checked: boolean) => void
  onDeleteSelected: () => void
  onClearAltitudes: () => void
  /** Waypoints a ground trim would remove (preview): their rows are dimmed. */
  ghostIds?: Set<string>
}

// Quiet inputs: they look like text until hovered or focused, so a row stays compact.
const quietInput =
  "border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background"

// The compact waypoint list of the editor panel: index, name, altitude, coordinates as a second line. Same
// editing as the old table (row click selects, shift-click ranges, every field editable). Hovering a row
// highlights its point on the map; clicking a point on the map scrolls the list to its row.
export function WaypointList({
  waypoints,
  offset,
  isLoading,
  hoveredId,
  onHover,
  scrollTarget,
  onRowClick,
  onUpdateWaypoint,
  onTabKeyNavigation,
  onInputFocus,
  onToggleSelectAll,
  onDeleteSelected,
  onClearAltitudes,
  ghostIds,
}: WaypointListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const anySelected = waypoints.some((wp) => wp.selected)

  useEffect(() => {
    if (!scrollTarget) return
    const row = listRef.current?.querySelector<HTMLElement>(`[data-wp-row="${CSS.escape(scrollTarget.id)}"]`)
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [scrollTarget])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id="selectAll"
            aria-label={copy.editor.selectAll}
            checked={waypoints.length > 0 && waypoints.every((wp) => wp.selected)}
            onCheckedChange={(checked) => onToggleSelectAll(!!checked)}
          />
          <h3 className="text-xs text-muted-foreground">
            {copy.editor.waypointsHeading} · {waypoints.length}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteSelected}
            disabled={!anySelected || isLoading}
            title={copy.editor.deleteSelected}
            aria-label={copy.editor.deleteSelected}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClearAltitudes}
            disabled={!anySelected || isLoading}
            title={copy.editor.clearAltitudes}
            aria-label={copy.editor.clearAltitudes}
          >
            <Mountain className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {waypoints.map((waypoint, index) => (
          <div
            key={waypoint.id}
            data-wp-row={waypoint.id}
            data-state={waypoint.selected ? "selected" : undefined}
            onClick={(e) => onRowClick(e, waypoint.id, offset + index)}
            onMouseEnter={() => onHover(waypoint.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "grid cursor-pointer grid-cols-[1.75rem_1fr_5.5rem] items-center gap-x-1 border-b border-border/60 px-3 py-1.5",
              "[content-visibility:auto] [contain-intrinsic-size:auto_52px]",
              hoveredId === waypoint.id && "bg-accent/60",
              waypoint.selected && "bg-accent",
              ghostIds?.has(waypoint.id) && "opacity-40",
            )}
          >
            <span className="text-right font-mono text-[11px] text-muted-foreground">{offset + index + 1}</span>
            <Input
              id={`name-${waypoint.id}`}
              aria-label={copy.editor.waypointName}
              value={waypoint.name}
              onChange={(e) => onUpdateWaypoint(waypoint.id, "name", e.target.value)}
              onKeyDown={(e) => onTabKeyNavigation(e, waypoint.id, "name")}
              onFocus={onInputFocus}
              maxLength={12}
              disabled={waypoint.locked}
              readOnly={waypoint.locked}
              className={cn("h-7 px-2 font-mono text-xs", quietInput, waypoint.locked && "text-muted-foreground")}
            />
            <Input
              type="number"
              aria-label={copy.editor.waypointAltitude}
              value={waypoint.altitude}
              onChange={(e) => onUpdateWaypoint(waypoint.id, "altitude", Number.parseInt(e.target.value) || 0)}
              onFocus={onInputFocus}
              className={cn("h-7 px-2 text-right font-mono text-xs", quietInput)}
            />
            <span />
            <div className="col-span-2 flex items-center gap-1">
              <Input
                type="number"
                step="0.0001"
                aria-label={copy.editor.waypointLatitude}
                value={waypoint.lat}
                onChange={(e) => onUpdateWaypoint(waypoint.id, "lat", Number.parseFloat(e.target.value) || 0)}
                onFocus={onInputFocus}
                className={cn("h-5 w-[6.25rem] px-2 font-mono text-[11px] text-muted-foreground", quietInput)}
              />
              <Input
                type="number"
                step="0.0001"
                aria-label={copy.editor.waypointLongitude}
                value={waypoint.lng}
                onChange={(e) => onUpdateWaypoint(waypoint.id, "lng", Number.parseFloat(e.target.value) || 0)}
                onFocus={onInputFocus}
                className={cn("h-5 w-[6.25rem] px-2 font-mono text-[11px] text-muted-foreground", quietInput)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
