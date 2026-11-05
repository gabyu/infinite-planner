import Link from "next/link"
import { notFound } from "next/navigation"
import { AirportSearch } from "@/components/dev/airport-search"
import { CoveragePanel } from "@/components/dev/coverage-panel"
import { ProceduresView } from "@/components/dev/procedures-view"
import { getAirportInfo } from "@/lib/airports"
import { airportFor, groupFlights } from "@/lib/procedure-analysis"
import { buildCoverage } from "@/lib/procedure-coverage"
import { loadFlights, loadNotNeeded, procedureRoot } from "@/lib/procedure-store"

// Local preview of the airport procedures editor. It reads the KMLs of a folder on this machine (PROCEDURES_DIR in
// .env.local) and answers 404 anywhere else: in production builds, on staging, and whenever the folder is not set.
export const dynamic = "force-dynamic"

export default function ProceduresPreview({ searchParams }: { searchParams: { airport?: string } }) {
  const root = procedureRoot()
  if (!root) notFound()

  const { byAirport, unplaced } = loadFlights(root)
  const withData = Array.from(byAirport.entries())
    .map(([code, list]) => ({ code, list, percent: airportFor(code) ? buildCoverage(airportFor(code)!, list, loadNotNeeded(root, code)).percent : 0 }))
    .sort((a, b) => b.list.length - a.list.length || a.code.localeCompare(b.code))

  const wanted = (searchParams.airport ?? "").toUpperCase()
  const icao = /^[A-Z]{4}$/.test(wanted) ? wanted : withData[0]?.code
  if (!icao) notFound()
  const airport = airportFor(icao)
  const info = getAirportInfo(icao)
  const flights = byAirport.get(icao) ?? []
  const named = airport ? airport.runways.some((r) => r[6]) : false

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">Local preview · nothing is stored</div>
      <h1 className="mb-3 text-2xl font-semibold">Airport procedures</h1>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <AirportSearch current={icao} />
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Airports with flights">
          {withData.map(({ code, list, percent }) => (
            <Link key={code} href={`/dev/procedures?airport=${code}`} className={`rounded border px-2 py-1 ${code === icao ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {code} <span className="opacity-70">{percent}% · {list.length} flights</span>
            </Link>
          ))}
        </nav>
      </div>
      {unplaced.length > 0 && <p className="mb-3 text-sm text-amber-600">No known airport at either end: {unplaced.join(", ")}</p>}

      {!airport || !named ? (
        <p className="rounded border p-4 text-sm">
          {info ? `${icao} ${info.name}` : icao}: the airport data has no named runways for it, so its approaches and departures cannot be placed yet.
        </p>
      ) : (
        <>
          <CoveragePanel icao={icao} airportName={info ? `${info.name}, ${info.city}` : ""} coverage={buildCoverage(airport, flights, loadNotNeeded(root, icao))} />
          <ProceduresView
            key={icao}
            icao={icao}
            center={[airport.lat, airport.lng]}
            runways={airport.runways.map((r) => ({ name: `${r[6] ?? ""}/${r[7] ?? ""}`, from: [r[0], r[1]] as [number, number], to: [r[2], r[3]] as [number, number] }))}
            flights={flights}
            arrivalGroups={groupFlights(flights, "arrival")}
            departureGroups={groupFlights(flights, "departure")}
          />
        </>
      )}
    </main>
  )
}
