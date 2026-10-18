import Link from "next/link"
import { Search } from "lucide-react"
import { LibraryActionButton } from "@/components/admin/library-actions"
import { LocalDate } from "@/components/admin/local-date"
import { PageHeader } from "@/components/admin/page-header"
import { RouteArrow } from "@/components/route-arrow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSessionContext, requireAdmin, ADMIN_BASE } from "@/lib/admin/auth"
import { LIBRARY_NAME } from "@/lib/brand"
import { FLIGHT_PLAN_SOURCES, sourceLabel } from "@/lib/flight-plans"
import { planPath } from "@/lib/plan-slug"

export const dynamic = "force-dynamic"

interface PlanRow {
  id: string
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  source: string
  published_at: string | null
  like_count: number
  import_count: number
  download_count: number
  moderation_status: "ok" | "hidden"
  author_id: string
  author_name: string
  author_blocked: boolean
  open_reports: number
}

interface ReportRow {
  id: string
  created_at: string
  reason: string
  details: string | null
  reporter_name: string
  plan_id: string
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  moderation_status: "ok" | "hidden"
  author_id: string
  author_name: string
  page_url: string | null
}

interface DeclarationRow {
  id: string
  declared_at: string
  wording_key: string
  origin_sources: string[]
  user_name: string
  public_id: string | null
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  total: number
}

interface Coverage {
  public_plans: number
  distinct_routes: number
  top_departures: { icao: string; n: number }[]
  top_arrivals: { icao: string; n: number }[]
}

const REASONS: Record<string, string> = {
  inappropriate: "Inappropriate",
  copyright: "Copyright",
  wrong_data: "Wrong data",
  spam: "Spam",
  other: "Other",
}

type Search = Record<string, string | string[] | undefined>
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 60) || ""

export default async function RoutesAdminPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin()
  const ctx = await getSessionContext()
  if (!ctx) return null
  const timezone = ctx.profile?.timezone ?? null

  const route = one(searchParams.route)
  const flight = one(searchParams.flight)
  const source = one(searchParams.source)
  const author = one(searchParams.author)

  const [plansResult, reportsResult, coverageResult, settings, declarationsResult] = await Promise.all([
    ctx.supabase.rpc("admin_list_library_plans", {
      p_route: route || null,
      p_flight: flight || null,
      p_source: source || null,
      p_author: author || null,
    }),
    ctx.supabase.rpc("admin_list_reports"),
    ctx.supabase.rpc("admin_library_coverage"),
    ctx.supabase.rpc("library_state"),
    ctx.supabase.rpc("admin_list_declarations", { p_limit: 100 }),
  ])
  const plans = (plansResult.data ?? []) as PlanRow[]
  const reports = (reportsResult.data ?? []) as ReportRow[]
  const declarations = (declarationsResult.data ?? []) as DeclarationRow[]
  const coverage = coverageResult.data as Coverage | null
  const launched = settings.data === true
  const filtered = !!(route || flight || source || author)

  return (
    <>
      <PageHeader
        title={LIBRARY_NAME}
        description="The public flight plan library: what is published, what was reported, who can publish."
      />

      <section aria-label="Overview" className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="studio-label">Public plans</p>
          <p className="mt-1.5 font-mono text-2xl">{coverage?.public_plans ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">{launched ? "Library launched" : "Pre-launch: visible to admins and contributors only"}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="studio-label">Distinct routes</p>
          <p className="mt-1.5 font-mono text-2xl">{coverage?.distinct_routes ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 text-sm">
          <p className="studio-label">Coverage</p>
          <p className="mt-1.5 text-muted-foreground">
            <span className="text-foreground">From:</span>{" "}
            {coverage?.top_departures.length ? coverage.top_departures.map((a) => `${a.icao} (${a.n})`).join(", ") : "—"}
          </p>
          <p className="mt-1 text-muted-foreground">
            <span className="text-foreground">To:</span>{" "}
            {coverage?.top_arrivals.length ? coverage.top_arrivals.map((a) => `${a.icao} (${a.n})`).join(", ") : "—"}
          </p>
        </div>
      </section>

      <section aria-labelledby="reports" className="mb-8">
        <h2 id="reports" className="mb-3 text-sm font-semibold">
          Open reports {reports.length > 0 && <Badge variant="secondary">{reports.length}</Badge>}
        </h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reported by</TableHead>
                <TableHead className="w-28">When</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No open reports.
                  </TableCell>
                </TableRow>
              )}
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <Link
                      href={planPath({
                        origin: report.origin_airport,
                        destination: report.destination_airport,
                        flightNumber: report.flight_number,
                        publicId: report.public_id,
                      })}
                      className="font-mono text-sm"
                    >
                      {report.origin_airport}
                      <RouteArrow />
                      {report.destination_airport}
                      {report.flight_number ? ` ${report.flight_number}` : ""}
                    </Link>
                    <p className="text-xs text-muted-foreground">by {report.author_name}</p>
                  </TableCell>
                  <TableCell>
                    <p>{REASONS[report.reason] ?? report.reason}</p>
                    {report.details && <p className="max-w-xs text-xs text-muted-foreground">{report.details}</p>}
                    {report.page_url && <p className="max-w-xs break-all text-xs text-muted-foreground">{report.page_url}</p>}
                  </TableCell>
                  <TableCell>{report.reporter_name}</TableCell>
                  <TableCell>
                    <LocalDate iso={report.created_at} timezone={timezone} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex gap-2">
                      <LibraryActionButton action={{ action: "resolve", reportId: report.id, hide: false }}>Resolve</LibraryActionButton>
                      <LibraryActionButton
                        variant="destructive"
                        action={{ action: "resolve", reportId: report.id, hide: true }}
                        confirm="Hide this flight plan? Its page stops working for everyone and all its reports are closed."
                      >
                        Hide plan
                      </LibraryActionButton>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="declarations" className="mb-8">
        <h2 id="declarations" className="mb-3 text-sm font-semibold">
          Publish declarations{" "}
          <Badge variant="secondary">{declarations[0]?.total ?? 0}</Badge>
        </h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Declared by</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Wording</TableHead>
                <TableHead className="w-28">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {declarations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No declarations yet.
                  </TableCell>
                </TableRow>
              )}
              {declarations.map((declaration) => (
                <TableRow key={declaration.id}>
                  <TableCell className="font-medium">
                    {declaration.origin_airport} → {declaration.destination_airport}
                    {declaration.flight_number ? ` ${declaration.flight_number}` : ""}
                  </TableCell>
                  <TableCell>{declaration.user_name}</TableCell>
                  <TableCell>{declaration.origin_sources.join(", ")}</TableCell>
                  <TableCell className="font-mono text-xs">{declaration.wording_key}</TableCell>
                  <TableCell>
                    <LocalDate iso={declaration.declared_at} timezone={timezone} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="plans" className="space-y-3">
        <h2 id="plans" className="text-sm font-semibold">
          Public plans
        </h2>
        <form action={`${ADMIN_BASE}/routes`} method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="route" defaultValue={route} placeholder="Route (LFPG-KLAX)" aria-label="Route" className="w-48 pl-9" maxLength={20} />
          </div>
          <Input name="flight" defaultValue={flight} placeholder="Flight number" aria-label="Flight number" className="w-36" maxLength={12} />
          <select name="source" defaultValue={source} aria-label="Source" className="h-[var(--control-h,2.5rem)] rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Any source</option>
            {FLIGHT_PLAN_SOURCES.map((value) => (
              <option key={value} value={value}>
                {sourceLabel(value)}
              </option>
            ))}
          </select>
          <Input name="author" defaultValue={author} placeholder="Author" aria-label="Author" className="w-40" maxLength={40} />
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href={`${ADMIN_BASE}/routes`}>Clear</Link>
            </Button>
          )}
        </form>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead className="w-24">Flight</TableHead>
                <TableHead className="w-28">Source</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="w-28">Published</TableHead>
                <TableHead className="w-40">Imports / downloads / likes</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    {filtered ? "No public plan matches." : "Nothing is published yet."}
                  </TableCell>
                </TableRow>
              )}
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <Link
                      href={planPath({
                        origin: plan.origin_airport,
                        destination: plan.destination_airport,
                        flightNumber: plan.flight_number,
                        publicId: plan.public_id,
                      })}
                      className="font-mono text-sm"
                    >
                      {plan.origin_airport}
                      <RouteArrow />
                      {plan.destination_airport}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{plan.flight_number ?? "—"}</TableCell>
                  <TableCell>{sourceLabel(plan.source as never)}</TableCell>
                  <TableCell>
                    {plan.author_name}
                    {plan.author_blocked && (
                      <Badge variant="destructive" className="ml-2">
                        Blocked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{plan.published_at ? <LocalDate iso={plan.published_at} timezone={timezone} /> : "—"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {plan.import_count} / {plan.download_count} / {plan.like_count}
                  </TableCell>
                  <TableCell>
                    {plan.moderation_status === "hidden" ? (
                      <Badge variant="destructive">Hidden</Badge>
                    ) : plan.open_reports > 0 ? (
                      <Badge variant="secondary">{plan.open_reports} report{plan.open_reports === 1 ? "" : "s"}</Badge>
                    ) : (
                      <Badge variant="outline">Live</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex gap-2">
                      {plan.moderation_status === "hidden" ? (
                        <LibraryActionButton action={{ action: "moderate", planId: plan.id, status: "ok" }}>Unhide</LibraryActionButton>
                      ) : (
                        <LibraryActionButton
                          action={{ action: "moderate", planId: plan.id, status: "hidden" }}
                          confirm="Hide this flight plan? Its page stops working for everyone."
                        >
                          Hide
                        </LibraryActionButton>
                      )}
                      <LibraryActionButton
                        variant={plan.author_blocked ? "outline" : "ghost"}
                        action={{ action: "block", userId: plan.author_id, blocked: !plan.author_blocked }}
                        confirm={plan.author_blocked ? undefined : `Stop ${plan.author_name} from publishing flight plans?`}
                      >
                        {plan.author_blocked ? "Allow publishing" : "Block author"}
                      </LibraryActionButton>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  )
}
