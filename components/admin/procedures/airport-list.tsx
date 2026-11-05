import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface AirportListRow {
  code: string
  name: string
  flights: number
  arrivalPercent: number
  departurePercent: number
  percent: number
}

// The airports that already have flights, as a plain list: code, name, progress of arrivals and of departures.
export function AirportList({ rows, current }: { rows: AirportListRow[]; current: string | null }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No airport has flights yet. Pick one above and add flight files.</p>
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Airport</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-24 text-right">Arrivals</TableHead>
            <TableHead className="w-24 text-right">Departures</TableHead>
            <TableHead className="w-24 text-right">Overall</TableHead>
            <TableHead className="w-20 text-right">Flights</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.code} className={cn(row.code === current && "bg-accent/60")}>
              <TableCell className="font-mono font-medium">
                <Link href={`/admin-dashboard/procedures?airport=${row.code}`} className="underline-offset-4 hover:underline">
                  {row.code}
                </Link>
              </TableCell>
              <TableCell className="max-w-0 truncate text-muted-foreground">{row.name}</TableCell>
              <TableCell className="text-right tabular-nums">{row.arrivalPercent}%</TableCell>
              <TableCell className="text-right tabular-nums">{row.departurePercent}%</TableCell>
              <TableCell className="text-right">
                <Badge variant={row.percent >= 100 ? "default" : "secondary"} className="tabular-nums">
                  {row.percent}%
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{row.flights}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
