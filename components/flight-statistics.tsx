"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  getPopularAirports,
  getPopularFlights,
  getTotalStats,
  type AirportStats,
  type FlightStats,
} from "@/lib/flight-stats-service"

export function FlightStatistics() {
  const [popularAirports, setPopularAirports] = useState<AirportStats[]>([])
  const [popularFlights, setPopularFlights] = useState<FlightStats[]>([])
  const [totalStats, setTotalStats] = useState({ totalFlights: 0, totalAirports: 0 })
  const [airportNames, setAirportNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)

        // Fetch all statistics in parallel - changed from 5 to 10
        const [airports, flights, totals] = await Promise.all([
          getPopularAirports(10),
          getPopularFlights(10),
          getTotalStats(),
        ])

        setPopularAirports(airports)
        // Names are looked up on the server (the airport dataset never ships to the browser).
        fetch(`/api/airports?codes=${airports.map((a) => a.airport_code).join(",")}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => data?.names && setAirportNames(data.names))
          .catch(() => {})
        setPopularFlights(flights)
        setTotalStats(totals)
      } catch (error) {
        console.error("Error fetching flight statistics:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Don't render if no data and not loading
  if (!isLoading && totalStats.totalFlights === 0) {
    return null
  }

  return (
    <section className="border-t">
      <div className="container mx-auto px-4 py-20 md:py-28">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl md:text-5xl">
          Infinite Planner Statistics
        </h2>
        <p className="mt-4 text-lg font-light text-muted-foreground md:text-xl">
          Real flight data from our community of virtual pilots
        </p>

        {/* Totals */}
        <dl className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-muted/60 p-7 md:p-8">
            <dt className="text-sm text-muted-foreground">Total flights analyzed</dt>
            <dd className="mt-3 font-mono text-5xl font-medium tabular-nums tracking-tight md:text-6xl">
              {isLoading ? "…" : totalStats.totalFlights.toLocaleString("en-US")}
            </dd>
            <p className="mt-3 text-sm font-light text-muted-foreground">From FlightRadar24 and FlightAware</p>
          </div>
          <div className="rounded-3xl bg-muted/60 p-7 md:p-8">
            <dt className="text-sm text-muted-foreground">Unique airports</dt>
            <dd className="mt-3 font-mono text-5xl font-medium tabular-nums tracking-tight md:text-6xl">
              {isLoading ? "…" : totalStats.totalAirports.toLocaleString("en-US")}
            </dd>
            <p className="mt-3 text-sm font-light text-muted-foreground">Origins and destinations</p>
          </div>
        </dl>

        {/* Rankings */}
        <div className="mt-12 grid gap-x-16 gap-y-12 md:grid-cols-2">
          <RankList
            title="Popular airports"
            empty="No airport data available yet"
            isLoading={isLoading}
            rows={popularAirports.map((a) => ({
              key: a.airport_code,
              label: airportNames[a.airport_code] ?? a.airport_code,
              title: a.airport_code,
              value: `${a.count} flights`,
            }))}
          />
          <RankList
            title="Popular flights"
            empty="No flight data available yet"
            isLoading={isLoading}
            rows={popularFlights.map((f) => ({ key: f.flight_number, label: f.flight_number, value: `${f.count} times` }))}
          />
        </div>
      </div>
    </section>
  )
}

function RankList({
  title,
  empty,
  isLoading,
  rows,
}: {
  title: string
  empty: string
  isLoading: boolean
  rows: { key: string; label: string; title?: string; value: string }[]
}) {
  return (
    <div>
      <h3 className="font-display text-2xl font-semibold tracking-tight">{title}</h3>
      {isLoading ? (
        <div className="mt-4 divide-y border-y">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : rows.length > 0 ? (
        <ol className="mt-4 divide-y border-y">
          {rows.map((row, index) => (
            <li key={row.key} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 py-3">
              <span className="font-mono text-sm tabular-nums text-muted-foreground">{index + 1}</span>
              <span title={row.title} className={cn("min-w-0 truncate", row.title ? "font-medium" : "font-mono font-medium tabular-nums")}>
                {row.label}
              </span>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">{row.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}
