"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, Download, Eye, MoreHorizontal, Pencil, PencilRuler, Share2, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { ShareDialog } from "@/components/share-dialog"
import { getBrowserSupabase } from "@/lib/supabase/client"
import {
  FLIGHT_PLAN_SUMMARY_COLUMNS,
  HISTORY_PAGE_SIZE,
  flightPlanEditPath,
  formatFlightTime,
  sourceLabel,
  type FlightPlanSummary,
} from "@/lib/flight-plans"

interface FlightsListProps {
  initialPlans: FlightPlanSummary[]
  total: number
}

const routeOf = (plan: FlightPlanSummary) => `${plan.origin_airport} → ${plan.destination_airport}`

// The signed-in user's flight plans, drafts and exported ones in one list, newest first (no tabs,
// no sorting or filtering). Drafts can be viewed, edited and deleted; exported plans are locked and
// can be viewed, downloaded, shared, duplicated (into a new draft) and deleted.
export function FlightsList({ initialPlans, total: initialTotal }: FlightsListProps) {
  const [plans, setPlans] = useState(initialPlans)
  const [total, setTotal] = useState(initialTotal)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sharing, setSharing] = useState<FlightPlanSummary | null>(null)
  const [deleting, setDeleting] = useState<FlightPlanSummary | null>(null)
  const [viewing, setViewing] = useState<FlightPlanSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

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

  // Rows come back newest first; `from` is how many are already on screen.
  async function fetchPlans(from: number, count: number) {
    const supabase = getBrowserSupabase()
    if (!supabase) return null
    const { data, count: nextTotal, error } = await supabase
      .from("flight_plans")
      .select(FLIGHT_PLAN_SUMMARY_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + count - 1)
    if (error) {
      console.error("Loading flight plans failed:", error.message)
      return null
    }
    return { rows: (data ?? []) as unknown as FlightPlanSummary[], total: nextTotal ?? 0 }
  }

  async function loadMore() {
    setLoadingMore(true)
    const result = await fetchPlans(plans.length, HISTORY_PAGE_SIZE)
    setLoadingMore(false)
    if (!result) return toast({ title: "Couldn't load more", variant: "destructive" })
    setPlans((current) => [...current, ...result.rows.filter((row) => !current.some((plan) => plan.id === row.id))])
    setTotal(result.total)
  }

  async function duplicate(plan: FlightPlanSummary) {
    const response = await fetch(`/api/flight-plans/${plan.id}/duplicate`, { method: "POST" })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return toast({ title: "Couldn't duplicate", description: body?.error, variant: "destructive" })
    }
    // Reload what's on screen so the copy appears at the top.
    const result = await fetchPlans(0, Math.max(plans.length + 1, HISTORY_PAGE_SIZE))
    if (result) {
      setPlans(result.rows)
      setTotal(result.total)
    }
    toast({ title: "Draft created", description: `${routeOf(plan)}: a copy you can edit, not shared.` })
  }

  async function confirmDelete() {
    const supabase = getBrowserSupabase()
    if (!supabase || !deleting) return
    setBusy(true)
    const { error } = await supabase.from("flight_plans").delete().eq("id", deleting.id)
    setBusy(false)
    if (error) {
      console.error("Deleting a flight plan failed:", error.message)
      return toast({ title: "Couldn't delete", variant: "destructive" })
    }
    setPlans((current) => current.filter((plan) => plan.id !== deleting.id))
    setTotal((current) => Math.max(0, current - 1))
    setDeleting(null)
    toast({ title: "Flight plan deleted", description: routeOf(deleting) })
  }

  if (plans.length === 0) {
    return (
      <div className="flex max-w-xl flex-col items-start rounded-lg border bg-card px-6 py-8">
        <h2 className="text-sm font-medium">No flight plans yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          While you edit in Convert or Sketch, your flight plan is saved here as a draft. Once you export it, it is
          kept here too, ready to share or duplicate.
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

  const columns = "md:grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_11rem]"

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className={cn("studio-label hidden items-center gap-4 border-b bg-muted/40 px-4 py-2.5 md:grid", columns)}>
          <span>Route</span>
          <span>Flight</span>
          <span>Flight time</span>
          <span>Date</span>
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
                  <p className="flex flex-wrap items-center gap-x-2 font-mono text-sm font-medium">
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
                  </p>
                  {(names[0] || names[1]) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {names[0] ?? plan.origin_airport}
                      <RouteArrow className="mx-1" />
                      {names[1] ?? plan.destination_airport}
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

                {/* Actions by status. Draft: view, edit, delete. Exported (locked): view, download, share, duplicate, delete. */}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSharing(plan)}
                        title={plan.share_token ? "Shared: manage link" : "Share"}
                        aria-label={plan.share_token ? "Manage share link" : "Share"}
                        className="relative"
                      >
                        <Share2 />
                        {plan.share_token && (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                        )}
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

        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {plans.length} of {total} flight plan{total === 1 ? "" : "s"}
          </span>
          {plans.length < total && (
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      </div>

      {viewing && <PlanViewDialog planId={viewing.id} onClose={() => setViewing(null)} />}

      {sharing && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setSharing(null)}
          planId={sharing.id}
          origin={sharing.origin_airport}
          destination={sharing.destination_airport}
          shareToken={plans.find((plan) => plan.id === sharing.id)?.share_token ?? null}
          onShareChange={(token) => patchPlan(sharing.id, { share_token: token })}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this {deleting?.status === "draft" ? "draft" : "flight plan"}?</DialogTitle>
            <DialogDescription>
              {deleting && <span className="font-mono">{routeOf(deleting)}</span>} will be removed from your dashboard.
              {deleting?.share_token && " Its share link stops working."} This can&apos;t be undone.
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
