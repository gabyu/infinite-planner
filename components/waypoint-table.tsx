"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Trash2, Mountain, Map } from "lucide-react"

interface Waypoint {
  id: string
  name: string
  lat: number
  lng: number
  altitude: number
  selected?: boolean
  locked?: boolean
}

interface WaypointTableProps {
  waypoints: Waypoint[]
  isMobile: boolean
  isLoading: boolean
  onRowClick: (e: React.MouseEvent, id: string, index: number) => void
  onUpdateWaypoint: (id: string, field: keyof Waypoint, value: string | number) => void
  onTabKeyNavigation: (e: React.KeyboardEvent<HTMLInputElement>, waypointId: string, fieldName: keyof Waypoint) => void
  onInputFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  onToggleSelectAll: (checked: boolean) => void
  onDeleteSelected: () => void
  onClearAltitudes: () => void
  onExport: () => void
  exportDisabled: boolean
  /** Extra buttons rendered before the Map/Export buttons, e.g. an import-only "Options" toggle. */
  leftActions?: React.ReactNode
  onShowMap?: () => void
  emptyStateMessage?: string
}

export function WaypointTable({
  waypoints,
  isMobile,
  isLoading,
  onRowClick,
  onUpdateWaypoint,
  onTabKeyNavigation,
  onInputFocus,
  onToggleSelectAll,
  onDeleteSelected,
  onClearAltitudes,
  onExport,
  exportDisabled,
  leftActions,
  onShowMap,
  emptyStateMessage = "No waypoints yet.",
}: WaypointTableProps) {
  return (
    <>
      {/* Table Action Bar */}
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 border-b bg-card pb-3">
        <div className="flex items-center pl-3">
          <Checkbox
            id="selectAll"
            aria-label="Select all waypoints"
            onCheckedChange={(checked) => onToggleSelectAll(!!checked)}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={onDeleteSelected}
            disabled={!waypoints.some((wp) => wp.selected) || isLoading}
            className="hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            title="Delete selected waypoints"
          >
            <Trash2 />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onClearAltitudes}
            disabled={!waypoints.some((wp) => wp.selected) || isLoading}
            title="Clear altitudes of selected waypoints"
          >
            <Mountain />
          </Button>

          {leftActions}

          {onShowMap && (
            <Button
              onClick={onShowMap}
              variant="outline"
              size="icon"
              disabled={waypoints.length === 0 || isLoading}
              title="View flight plan on map"
            >
              <Map />
            </Button>
          )}

          <Button onClick={onExport} disabled={exportDisabled || isLoading} title="Export flight plan">
            <Download />
            Export
          </Button>
        </div>
      </div>

      {/* Waypoint Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="h-8 w-12"></TableHead>
              <TableHead className="studio-label h-8 w-32">Name</TableHead>
              <TableHead className="studio-label hidden h-8 w-40 md:table-cell">Latitude</TableHead>
              <TableHead className="studio-label hidden h-8 w-40 md:table-cell">Longitude</TableHead>
              <TableHead className="studio-label h-8 w-20">Alt ft.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 3 : 5} className="py-8 text-center text-sm text-muted-foreground">
                  Loading waypoints...
                </TableCell>
              </TableRow>
            ) : waypoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 3 : 5} className="py-8 text-center text-sm text-muted-foreground">
                  {emptyStateMessage}
                </TableCell>
              </TableRow>
            ) : (
              waypoints.map((waypoint, index) => (
                <TableRow
                  key={waypoint.id}
                  data-state={waypoint.selected ? "selected" : undefined}
                  className="cursor-pointer hover:bg-accent/60 data-[state=selected]:bg-accent"
                  onClick={(e) => onRowClick(e, waypoint.id, index)}
                >
                  <TableCell className="w-12 py-1 pl-3 pr-2">
                    <Checkbox
                      id={`wp-${waypoint.id}`}
                      checked={waypoint.selected}
                      onCheckedChange={() => {}}
                      className="pointer-events-none flex-shrink-0"
                    />
                  </TableCell>
                  <TableCell className="py-1">
                    <Input
                      id={`name-${waypoint.id}`}
                      value={waypoint.name}
                      onChange={(e) => onUpdateWaypoint(waypoint.id, "name", e.target.value)}
                      onKeyDown={(e) => onTabKeyNavigation(e, waypoint.id, "name")}
                      onFocus={onInputFocus}
                      className={`h-7 w-full max-w-[12ch] font-mono text-xs ${
                        waypoint.locked ? "cursor-not-allowed bg-muted text-muted-foreground" : ""
                      }`}
                      disabled={waypoint.locked}
                      readOnly={waypoint.locked}
                      maxLength={12}
                    />
                  </TableCell>
                  <TableCell className="hidden w-40 py-1 md:table-cell">
                    <Input
                      type="number"
                      step="0.0001"
                      value={waypoint.lat}
                      onChange={(e) => onUpdateWaypoint(waypoint.id, "lat", Number.parseFloat(e.target.value) || 0)}
                      onFocus={onInputFocus}
                      className="h-7 w-full font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell className="hidden w-40 py-1 md:table-cell">
                    <Input
                      type="number"
                      step="0.0001"
                      value={waypoint.lng}
                      onChange={(e) => onUpdateWaypoint(waypoint.id, "lng", Number.parseFloat(e.target.value) || 0)}
                      onFocus={onInputFocus}
                      className="h-7 w-full font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell className="w-20 py-1">
                    <Input
                      type="number"
                      value={waypoint.altitude}
                      onChange={(e) =>
                        onUpdateWaypoint(waypoint.id, "altitude", Number.parseInt(e.target.value) || 0)
                      }
                      onFocus={onInputFocus}
                      className="h-7 w-full min-w-[80px] font-mono text-xs"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {waypoints.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>
            Total waypoints: {waypoints.length} {waypoints.length > 250 && "(Warning: Exceeds 250 limit)"}
          </p>
          <p className="break-words font-mono">Route: {waypoints.map((wp) => wp.name).join(" → ")}</p>
        </div>
      )}
    </>
  )
}
