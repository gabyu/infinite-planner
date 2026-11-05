import Link from "next/link"
import { RelativeTime } from "@/components/relative-time"
import type { RecentAirport } from "@/lib/procedures-db"
import { cn } from "@/lib/utils"

// One line at the top of the page: the airports that just received flights or members' procedures. It shows where people are
// working and invites more of the same.
export function RecentAirports({ airports, current }: { airports: RecentAirport[]; current: string | null }) {
  if (airports.length === 0) return null
  return (
    <nav aria-label="Recently updated airports" className="mb-6 flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">Recently updated</span>
      <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {airports.map((airport) => (
          <li key={airport.code} className="shrink-0">
            <Link
              href={`/admin-dashboard/procedures?airport=${airport.code}`}
              className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs no-underline transition-colors hover:bg-accent", airport.code === current && "bg-accent")}
            >
              <span className="font-mono font-medium text-foreground">{airport.code}</span>
              <span className="text-muted-foreground">
                <RelativeTime iso={airport.lastAt} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
