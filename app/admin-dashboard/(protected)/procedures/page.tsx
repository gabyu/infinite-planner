import { AirportList } from "@/components/admin/procedures/airport-list"
import { AirportPicker } from "@/components/admin/procedures/airport-picker"
import { CoveragePanel } from "@/components/admin/procedures/coverage-panel"
import { MemberGuides } from "@/components/admin/procedures/member-guides"
import { ProceduresMap } from "@/components/admin/procedures/procedures-map"
import { SyncCard } from "@/components/admin/procedures/sync-card"
import { PageHeader } from "@/components/admin/page-header"
import { getSessionContext, requireAdmin } from "@/lib/admin/auth"
import { getAirportInfo } from "@/lib/airports"
import { airportFor } from "@/lib/procedure-analysis"
import { buildCoverage } from "@/lib/procedure-coverage"
import { guidesAsFlights, loadAirport, loadMemberGuides, loadSummaries, loadSyncState } from "@/lib/procedures-db"

export const dynamic = "force-dynamic"

// The airport procedures database: for each airport, how real flights arrive and leave, what is still missing, and the
// progress. Admins only. Flights are added here by dropping flight files; production is the source, staging copies it.
export default async function ProceduresPage({ searchParams }: { searchParams: { airport?: string } }) {
  await requireAdmin()
  const ctx = await getSessionContext()
  if (!ctx) return null

  const isStaging = process.env.NEXT_PUBLIC_ENV === "staging"
  const memberGuides = await loadMemberGuides(ctx.supabase)
  const [summaries, sync] = await Promise.all([loadSummaries(ctx.supabase, memberGuides), isStaging ? loadSyncState(ctx.supabase) : null])

  const wanted = (searchParams.airport ?? "").toUpperCase()
  const icao = /^[A-Z]{4}$/.test(wanted) ? wanted : (summaries[0]?.code ?? null)
  const airport = icao ? airportFor(icao) : null
  const info = icao ? getAirportInfo(icao) : null
  const hasNamedRunways = airport ? airport.runways.some((runway) => runway[6]) : false
  const detail = icao && airport && hasNamedRunways ? await loadAirport(ctx.supabase, icao) : null

  return (
    <>
      <PageHeader
        title="Procedures"
        description="How real flights arrive at and leave each airport, what is still missing, and the progress. Visible to admins only."
      />

      {sync && <SyncCard copyAllowed={sync.copyAllowed} lastSyncedAt={sync.lastSyncedAt} flightsCount={sync.flightsCount} timezone={ctx.profile?.timezone ?? null} />}

      <div className="mb-4">
        <AirportPicker current={icao} />
      </div>

      <section aria-labelledby="airports" className="mb-8">
        <h2 id="airports" className="mb-2 text-sm font-semibold">
          Airports with flights
        </h2>
        <AirportList
          current={icao}
          rows={summaries.map((s) => ({
            code: s.code,
            name: getAirportInfo(s.code)?.name ?? "",
            flights: s.flights,
            arrivalPercent: s.arrivalPercent,
            departurePercent: s.departurePercent,
            percent: s.percent,
          }))}
        />
      </section>

      {icao && !detail && (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {info ? `${icao} ${info.name}` : icao}: the airport data has no named runways for it, so its arrivals and departures cannot be placed yet.
        </p>
      )}

      {icao && airport && detail && (
        <>
          <CoveragePanel icao={icao} airportName={info ? `${info.name}, ${info.city}` : ""} coverage={buildCoverage(airport, [...detail.flights, ...guidesAsFlights(memberGuides, icao)], detail.notNeeded)} />
          <ProceduresMap
            key={icao}
            icao={icao}
            center={[airport.lat, airport.lng]}
            runways={airport.runways.map((r) => ({ name: `${r[6] ?? ""}/${r[7] ?? ""}`, from: [r[0], r[1]] as [number, number], to: [r[2], r[3]] as [number, number] }))}
            flights={detail.flights}
            arrivalGroups={detail.arrivalGroups}
            departureGroups={detail.departureGroups}
          />
        </>
      )}

      <MemberGuides guides={memberGuides} airport={icao} />
    </>
  )
}
