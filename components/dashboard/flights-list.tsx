"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Copy, Download, Eye, Info, MoreHorizontal, Pencil, PencilRuler, Search, Star, Trash2, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/hooks/use-toast"
import { LocalTime } from "@/components/local-time"
import { RouteArrow } from "@/components/route-arrow"
import { PlanViewDialog } from "@/components/dashboard/plan-view-dialog"
import { legalCopy } from "@/lib/copy"
import { VisibilitySwitch } from "@/components/visibility-switch"
import { planPath } from "@/lib/plan-slug"
import { getBrowserSupabase } from "@/lib/supabase/client"
import {
  FLIGHT_PLAN_SUMMARY_COLUMNS,
  HISTORY_PAGE_SIZE,
  flightPlanEditPath,
  formatFlightTime,
  isTrackerDerived,
  sourceLabel,
  type FlightPlanSummary,
} from "@/lib/flight-plans"

type Tab = "all" | "draft" | "exported" | "published" | "favorites" | "imported"

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "exported", label: "Exported" },
  { value: "published", label: "Published" },
  { value: "favorites", label: "Favorites" },
  { value: "imported", label: "Imported" },
]

interface FlightsListProps {
  initialPlans: FlightPlanSummary[]
  total: number
  // The library is open to this user: Public sharing, the tabs for Published / Favorites / Imported.
  library?: boolean
}

interface Favorite {
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  author_name: string | null
}

// What the database says about a copy's original (get_plan_lineage): a link back to it, or nothing
// when it is gone, private or hidden (never who wrote it then).
interface Lineage {
  orphan: boolean
  original_public_id: string | null
  original_origin: string | null
  original_destination: string | null
  original_flight_number: string | null
  original_author: string | null
}

const shareOf = (plan: FlightPlanSummary) => ({ visibility: plan.visibility, publicId: plan.public_id })

// Tracker-derived plans can't be published (a public one can still be switched off).
const notPublishable = (plan: FlightPlanSummary) => isTrackerDerived(plan.origin_sources) && plan.visibility !== "public"

// Page numbers to show (0-based): the first, the last and the ones around the current page; null = a gap.
function pageWindow(current: number, count: number): (number | null)[] {
  const keep = [...new Set([0, current - 1, current, current + 1, count - 1])].filter((n) => n >= 0 && n < count).sort((a, b) => a - b)
  return keep.flatMap((n, i) => (i > 0 && n - keep[i - 1] > 1 ? [null, n] : [n]))
}

const routeOf = (plan: FlightPlanSummary) => `${plan.origin_airport} → ${plan.destination_airport}`

// The signed-in user's flight plans, drafts and exported ones in one list, newest first (no tabs,
// no sorting or filtering). Drafts can be viewed, edited and deleted; exported plans are locked and
// can be viewed, downloaded, made public, duplicated (into a new draft) and deleted.
export function FlightsList({ initialPlans, total: initialTotal, library = false }: FlightsListProps) {
  const [plans, setPlans] = useState(initialPlans)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("") // the search once typing pauses
  const [paging, setPaging] = useState(false)
  const latest = useRef(0) // answers to older requests are dropped
  const firstRun = useRef(true)
  const [deleting, setDeleting] = useState<FlightPlanSummary | null>(null)
  const [viewing, setViewing] = useState<FlightPlanSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("all")
  const [tabLoading, setTabLoading] = useState(false)
  const [favorites, setFavorites] = useState<Favorite[] | null>(null)
  const [lineage, setLineage] = useState<Record<string, Lineage>>({})

  // Copies imported from the library: where they come from.
  const forkIds = plans.filter((plan) => plan.is_fork).map((plan) => plan.id).join(",")
  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase || !forkIds) return
    supabase.rpc("get_plan_lineage", { p_plan_ids: forkIds.split(",") }).then(({ data }) => {
      const rows = (data ?? []) as (Lineage & { plan_id: string })[]
      setLineage(Object.fromEntries(rows.map((row) => [row.plan_id, row])))
    })
  }, [forkIds])

  // Signing out from the header menu: re-render on the server so the list doesn't linger.
  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.refresh()
    })
    return () => data.subscription.unsubscribe()
  }, [router])

  const patchPlan = (id: string, patch: Partial<FlightPlanSummary>) =>
    setPlans((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)))

  // Rows come back newest first. The database does the filtering and the paging, never what happens to be loaded.
  async function fetchPlansFor(forTab: Tab, from: number, count: number, text: string) {
    const supabase = getBrowserSupabase()
    if (!supabase) return null
    let request = supabase.from("flight_plans").select(FLIGHT_PLAN_SUMMARY_COLUMNS, { count: "exact" })
    if (forTab === "draft") request = request.eq("status", "draft")
    else if (forTab === "exported") request = request.eq("status", "exported")
    else if (forTab === "published") request = request.eq("visibility", "public")
    else if (forTab === "imported") request = request.eq("is_fork", true)
    // Airport search: ICAO code, airport name or flight number (characters that mean something in a filter are dropped).
    const term = text.replace(/[^\p{L}\p{N} .'-]/gu, "").trim()
    if (term) {
      const like = `%${term}%`
      request = request.or(
        ["origin_airport", "destination_airport", "origin_airport_name", "destination_airport_name", "flight_number"]
          .map((column) => `${column}.ilike.${like}`)
          .join(","),
      )
    }
    const { data, count: nextTotal, error } = await request
      .order("created_at", { ascending: false })
      .range(from, from + count - 1)
    if (error) {
      console.error("Loading flight plans failed:", error.message)
      return null
    }
    return { rows: (data ?? []) as unknown as FlightPlanSummary[], total: nextTotal ?? 0 }
  }

  // Loads one page of the current tab and search.
  async function load(forTab: Tab, forPage: number, text: string) {
    const id = ++latest.current
    setPaging(true)
    const result = await fetchPlansFor(forTab, forPage * HISTORY_PAGE_SIZE, HISTORY_PAGE_SIZE, text)
    if (id !== latest.current) return
    setPaging(false)
    setTabLoading(false)
    if (!result) return toast({ title: "Couldn't load your flight plans", variant: "destructive" })
    // A page left empty (the last plan on it was deleted): step back.
    if (result.rows.length === 0 && forPage > 0) return goTo(Math.max(0, Math.ceil(result.total / HISTORY_PAGE_SIZE) - 1))
    setPlans(result.rows)
    setTotal(result.total)
    setPage(forPage)
  }

  function goTo(next: number) {
    load(tab, next, query)
  }

  async function changeTab(next: Tab) {
    if (next === tab) return
    setTab(next)
    if (next === "favorites") {
      setTabLoading(true)
      const supabase = getBrowserSupabase()
      const { data } = supabase ? await supabase.rpc("get_my_favorites", { p_limit: 100, p_offset: 0 }) : { data: null }
      setFavorites((data as Favorite[] | null) ?? [])
      setTabLoading(false)
      return
    }
    setTabLoading(true)
    load(next, 0, query)
  }

  // Search as the user types, once they pause: back to the first page.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (tab !== "favorites") load(tab, 0, query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function toggleFeatured(plan: FlightPlanSummary) {
    const response = await fetch(`/api/plans/${plan.id}/featured`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !plan.featured }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null)
    if (!response?.ok) return toast({ title: "Couldn't update your profile", description: body?.error, variant: "destructive" })
    patchPlan(plan.id, { featured: !plan.featured })
    toast({ title: plan.featured ? "Removed from your profile" : "Featured on your profile", description: routeOf(plan) })
  }

  async function duplicate(plan: FlightPlanSummary) {
    const response = await fetch(`/api/flight-plans/${plan.id}/duplicate`, { method: "POST" })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return toast({ title: "Couldn't duplicate", description: body?.error, variant: "destructive" })
    }
    // Reload what's on screen so the copy appears at the top.
    await load(tab, 0, query)
    toast({ title: "Draft created", description: `${routeOf(plan)}: a copy you can edit, private.` })
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    // Through the API (not straight to the table) so the cached public page of a public plan is dropped at once.
    const response = await fetch(`/api/flight-plans/${deleting.id}`, { method: "DELETE" })
    setBusy(false)
    if (!response.ok) {
      console.error("Deleting a flight plan failed:", response.status)
      return toast({ title: "Couldn't delete", variant: "destructive" })
    }
    setDeleting(null)
    await load(tab, page, query) // refill the page
    toast({ title: "Flight plan deleted", description: routeOf(deleting) })
  }

  if (plans.length === 0 && tab === "all" && !query && !paging) {
    return (
      <div className="flex max-w-xl flex-col items-start rounded-lg border bg-card px-6 py-8">
        <h2 className="text-sm font-medium">No flight plans yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          While you edit in Convert or Sketch, your flight plan is saved here as a draft. Once you export it, it is
          kept here too, ready to download, make public or duplicate.
        </p>
        <div className="mt-5 flex gap-2">
          <Button asChild>
            <Link href="/convert" className="no-underline">
              <Upload /> Convert a flight
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sketch" className="no-underline">
              <PencilRuler /> Route Sketch
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Route | Flight | Flight time | Date | (Visibility) | Actions. The actions are always three icons wide (view,
  // download or edit, more), so the rows line up.
  const columns = library
    ? "md:grid-cols-[minmax(0,1fr)_8rem_6rem_10rem_8rem_8.5rem]"
    : "md:grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_8.5rem]"

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {library ? (
        <div role="tablist" aria-label="Filter your flight plans" className="flex flex-wrap gap-1">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => changeTab(value)}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === value ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <span />
      )}
      {tab !== "favorites" && (
        <div className="relative w-full sm:w-64">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search airport or flight no."
            aria-label="Search your flight plans by airport or flight number"
            className="h-9 pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setQuery("")
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      </div>

      {tabLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading...</p>
      ) : tab === "favorites" ? (
        favorites && favorites.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {favorites.map((favorite) => (
              <li key={favorite.public_id} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link
                  href={planPath({
                    origin: favorite.origin_airport,
                    destination: favorite.destination_airport,
                    flightNumber: favorite.flight_number,
                    publicId: favorite.public_id,
                  })}
                  className="link-quiet font-mono text-sm font-medium"
                >
                  {favorite.origin_airport}
                  <RouteArrow />
                  {favorite.destination_airport}
                  {favorite.flight_number && <span className="ml-2 text-muted-foreground">{favorite.flight_number}</span>}
                </Link>
                <span className="truncate text-xs text-muted-foreground">by {favorite.author_name ?? "Infinite Planner admin"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-sm text-muted-foreground">
            No favorites yet. Like a flight plan in <Link href="/explore" className="link">Explore</Link> and it shows up here.
          </p>
        )
      ) : plans.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{query ? `No flight plans match "${query}".` : "Nothing here yet."}</p>
      ) : (
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className={cn("studio-label hidden items-center gap-4 border-b bg-muted/40 px-4 py-2.5 md:grid", columns)}>
          <span>Route</span>
          <span>Flight</span>
          <span>Flight time</span>
          <span>Date</span>
          {library && <span>Visibility</span>}
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y">
          {plans.map((plan) => {
            const names = [plan.origin_airport_name, plan.destination_airport_name]
            const flightTime = formatFlightTime(plan.flight_time_minutes)
            const isDraft = plan.status === "draft"
            return (
              <li
                key={plan.id}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/50",
                  columns,
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 font-mono text-sm font-medium">
                    <span>
                      {plan.origin_airport}
                      <RouteArrow />
                      {plan.destination_airport}
                    </span>
                    {isDraft && (
                      <Badge variant="secondary" className="font-sans text-[11px] font-normal">
                        Draft
                      </Badge>
                    )}
                  </div>
                  {(names[0] || names[1]) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {names[0] ?? plan.origin_airport}
                      <RouteArrow className="mx-1" />
                      {names[1] ?? plan.destination_airport}
                    </p>
                  )}
                  {plan.is_fork && lineage[plan.id] && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {lineage[plan.id].orphan || !lineage[plan.id].original_public_id ? (
                        "Original no longer available"
                      ) : (
                        <>
                          Based on{" "}
                          <Link
                            href={planPath({
                              origin: lineage[plan.id].original_origin ?? "",
                              destination: lineage[plan.id].original_destination ?? "",
                              flightNumber: lineage[plan.id].original_flight_number,
                              publicId: lineage[plan.id].original_public_id!,
                            })}
                            className="link"
                          >
                            {lineage[plan.id].original_origin}
                            <RouteArrow className="mx-1" />
                            {lineage[plan.id].original_destination}
                            {lineage[plan.id].original_flight_number ? ` ${lineage[plan.id].original_flight_number}` : ""}
                          </Link>
                          {lineage[plan.id].original_author ? ` by ${lineage[plan.id].original_author}` : ""}
                        </>
                      )}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground md:hidden">
                    <LocalTime iso={plan.created_at} />
                    {flightTime && <> · {flightTime}</>}
                  </p>
                </div>

                <div className="order-last col-span-2 flex flex-wrap items-center gap-1.5 md:order-none md:col-span-1 md:flex-col md:items-start">
                  <span className="font-mono text-sm">{plan.flight_number ?? "—"}</span>
                  <Badge variant="outline" className="px-1.5 text-[10px] font-normal text-muted-foreground">
                    {sourceLabel(plan.source)}
                  </Badge>
                </div>

                <span className="hidden text-sm md:block">{flightTime ?? <span className="text-muted-foreground">—</span>}</span>

                <span className="hidden text-sm text-muted-foreground md:block">
                  <LocalTime iso={plan.created_at} />
                </span>

                {library && (
                  <div className="order-last col-span-2 md:order-none md:col-span-1">
                    {!isDraft && plan.moderation_status === "hidden" && (
                      <span className="text-xs text-muted-foreground">{legalCopy.planNotAvailable}</span>
                    )}
                    {!isDraft && plan.moderation_status !== "hidden" && notPublishable(plan) && (
                      // No switch where publishing isn't possible: an info bubble says why.
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={legalCopy.publishOnlyOwnDesigns}
                              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                            >
                              <Info size={16} aria-hidden /> Private
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[16rem]">{legalCopy.publishOnlyOwnDesigns}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {!isDraft && plan.moderation_status !== "hidden" && !notPublishable(plan) && (
                      <VisibilitySwitch
                        planId={plan.id}
                        origin={plan.origin_airport}
                        destination={plan.destination_airport}
                        flightNumber={plan.flight_number}
                        share={shareOf(plan)}
                        layout="inline"
                        short
                        requiresDeclaration={plan.origin_sources.includes("Imported")}
                        onShareChange={(share) =>
                          patchPlan(plan.id, {
                            visibility: share.visibility,
                            public_id: share.publicId,
                            ...(share.visibility === "public" ? {} : { featured: false }),
                          })
                        }
                        className="flex-nowrap"
                      />
                    )}
                  </div>
                )}

                {/* Actions: view, then download (exported) or edit (draft), then a menu: duplicate, copy link, feature, delete. */}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewing(plan)}
                    title="View"
                    aria-label="View"
                  >
                    <Eye />
                  </Button>

                  {isDraft ? (
                    <Button asChild variant="ghost" size="icon" title="Edit draft" aria-label="Edit draft">
                      <Link href={flightPlanEditPath(plan)}>
                        <Pencil />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="ghost" size="icon" title="Download FPL" aria-label="Download FPL">
                        <a href={`/api/flight-plans/${plan.id}/fpl`} download>
                          <Download />
                        </a>
                      </Button>
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="More actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {!isDraft && (
                        <>
                          <DropdownMenuItem onSelect={() => duplicate(plan)}>
                            <Copy /> Duplicate
                          </DropdownMenuItem>
                          {library && plan.visibility === "public" && plan.public_id && (
                            <>

                              <DropdownMenuItem onSelect={() => toggleFeatured(plan)}>
                                <Star className={cn(plan.featured && "fill-primary text-primary")} />
                                {plan.featured ? "Remove from profile" : "Feature on profile"}
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onSelect={() => setDeleting(plan)}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {page * HISTORY_PAGE_SIZE + 1}–{page * HISTORY_PAGE_SIZE + plans.length} of {total} flight plan{total === 1 ? "" : "s"}
          </span>
          {total > HISTORY_PAGE_SIZE && (
            <nav aria-label="Pages" className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0 || paging} onClick={() => goTo(page - 1)} aria-label="Previous page">
                <ChevronLeft size={16} />
              </Button>
              {pageWindow(page, Math.ceil(total / HISTORY_PAGE_SIZE)).map((entry, i) =>
                entry === null ? (
                  <span key={`gap-${i}`} aria-hidden className="px-1">…</span>
                ) : (
                  <Button
                    key={entry}
                    variant={entry === page ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 min-w-7 px-2 tabular-nums"
                    aria-current={entry === page ? "page" : undefined}
                    disabled={paging}
                    onClick={() => goTo(entry)}
                  >
                    {entry + 1}
                  </Button>
                ),
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={(page + 1) * HISTORY_PAGE_SIZE >= total || paging}
                onClick={() => goTo(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </Button>
            </nav>
          )}
        </div>
      </div>
      )}

      {viewing && <PlanViewDialog planId={viewing.id} onClose={() => setViewing(null)} />}


      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this {deleting?.status === "draft" ? "draft" : "flight plan"}?</DialogTitle>
            <DialogDescription>
              {deleting && <span className="font-mono">{routeOf(deleting)}</span>} will be removed from your dashboard.
              {deleting && deleting.visibility !== "private" && " Its public page and link stop working; copies other people made stay with them."} This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  )
}
