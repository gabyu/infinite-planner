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
      <div
        className="sticky z-10 bg-background pb-4 pt-2 border-b mb-4 flex items-center justify-between gap-2"
        style={{ top: "0px" }}
      >
        <div className="flex items-center">
          <Checkbox id="selectAll" onCheckedChange={(checked) => onToggleSelectAll(!!checked)} />
        </div>

        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            disabled={!waypoints.some((wp) => wp.selected) || isLoading}
            className="h-9 w-9 p-0"
            title="Delete selected waypoints"
          >
            <Trash2 size={16} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClearAltitudes}
            disabled={!waypoints.some((wp) => wp.selected) || isLoading}
            className="h-9 w-9 p-0"
            title="Clear altitudes of selected waypoints"
          >
            <Mountain size={16} />
          </Button>

          {leftActions}

          {onShowMap && (
            <Button
              onClick={onShowMap}
              variant="outline"
              size="sm"
              disabled={waypoints.length === 0 || isLoading}
              className="h-9 w-9 p-0"
              title="View flight plan on map"
            >
              <Map size={16} />
            </Button>
          )}

          <Button
            onClick={onExport}
            size="sm"
            disabled={exportDisabled || isLoading}
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
              <TableHead className="w-20">Alt ft.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 3 : 5} className="text-center py-8 text-muted-foreground">
                  Loading waypoints...
                </TableCell>
              </TableRow>
            ) : waypoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 3 : 5} className="text-center py-8 text-muted-foreground">
                  {emptyStateMessage}
                </TableCell>
              </TableRow>
            ) : (
              waypoints.map((waypoint, index) => (
                <TableRow
                  key={waypoint.id}
                  className="bg-card hover:bg-muted/50 h-12 cursor-pointer"
                  onClick={(e) => onRowClick(e, waypoint.id, index)}
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
                      onChange={(e) => onUpdateWaypoint(waypoint.id, "name", e.target.value)}
                      onKeyDown={(e) => onTabKeyNavigation(e, waypoint.id, "name")}
                      onFocus={onInputFocus}
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
                      onChange={(e) => onUpdateWaypoint(waypoint.id, "lat", Number.parseFloat(e.target.value) || 0)}
                      onFocus={onInputFocus}
                      className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full"
                      style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-2 w-40">
                    <Input
                      type="number"
                      step="0.0001"
                      value={waypoint.lng}
                      onChange={(e) => onUpdateWaypoint(waypoint.id, "lng", Number.parseFloat(e.target.value) || 0)}
                      onFocus={onInputFocus}
                      className="h-8 border-input font-[var(--font-ibm-plex-mono)] w-full"
                      style={{ fontFamily: "var(--font-ibm-plex-mono), monospace" }}
                    />
                  </TableCell>
                  <TableCell className="py-2 w-20">
                    <Input
                      type="number"
                      value={waypoint.altitude}
                      onChange={(e) =>
                        onUpdateWaypoint(waypoint.id, "altitude", Number.parseInt(e.target.value) || 0)
                      }
                      onFocus={onInputFocus}
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

      {waypoints.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Total waypoints: {waypoints.length} {waypoints.length > 250 && "(Warning: Exceeds 250 limit)"}
          </p>
          <p className="mt-1">Route: {waypoints.map((wp) => wp.name).join(" → ")}</p>
        </div>
      )}
    </>
  )
}
