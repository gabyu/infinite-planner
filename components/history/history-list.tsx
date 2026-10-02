"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, Download, MoreHorizontal, PencilRuler, Share2, Timer, Trash2, Upload } from "lucide-react"
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
import { FlightTimeField } from "@/components/flight-time-field"
import { LocalTime } from "@/components/local-time"
import { ShareDialog } from "@/components/share-dialog"
import { getBrowserSupabase } from "@/lib/supabase/client"
import {
  FLIGHT_PLAN_SUMMARY_COLUMNS,
  HISTORY_PAGE_SIZE,
  formatFlightTime,
  sourceLabel,
  type FlightPlanSummary,
} from "@/lib/flight-plans"

interface HistoryListProps {
  initialPlans: FlightPlanSummary[]
  total: number
}

const routeOf = (plan: FlightPlanSummary) => `${plan.origin_airport} → ${plan.destination_airport}`

// The signed-in user's saved flight plans, newest first. No sorting or filtering.
export function HistoryList({ initialPlans, total: initialTotal }: HistoryListProps) {
  const [plans, setPlans] = useState(initialPlans)
  const [total, setTotal] = useState(initialTotal)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sharing, setSharing] = useState<FlightPlanSummary | null>(null)
  const [deleting, setDeleting] = useState<FlightPlanSummary | null>(null)
  const [editingTime, setEditingTime] = useState<FlightPlanSummary | null>(null)
  const [timeDraft, setTimeDraft] = useState<number | null>(null)
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
    toast({ title: "Flight plan duplicated", description: routeOf(plan) })
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

  async function saveFlightTime() {
    const supabase = getBrowserSupabase()
    if (!supabase || !editingTime) return
    setBusy(true)
    const { error } = await supabase
      .from("flight_plans")
      .update({ flight_time_minutes: timeDraft })
      .eq("id", editingTime.id)
    setBusy(false)
    if (error) {
      console.error("Updating the flight time failed:", error.message)
      return toast({ title: "Couldn't save the flight time", variant: "destructive" })
    }
    patchPlan(editingTime.id, { flight_time_minutes: timeDraft })
    setEditingTime(null)
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-16 text-center">
        <h2 className="text-sm font-medium">No saved flight plans yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Every flight plan you export while signed in is saved here, so you can download it again, share it or copy it.
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

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="studio-label hidden grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_8.5rem] items-center gap-4 border-b bg-muted/40 px-4 py-2.5 md:grid">
          <span>Route</span>
          <span>Flight</span>
          <span>Flight time</span>
          <span>Saved</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y">
          {plans.map((plan) => {
            const names = [plan.origin_airport_name, plan.destination_airport_name]
            const flightTime = formatFlightTime(plan.flight_time_minutes)
            return (
              <li
                key={plan.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/50 md:grid-cols-[minmax(0,1fr)_9rem_6rem_10rem_8.5rem]"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{routeOf(plan)}</p>
                  {(names[0] || names[1]) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {names[0] ?? plan.origin_airport} → {names[1] ?? plan.destination_airport}
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

                <div className="flex items-center justify-end gap-1">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="More actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={() => duplicate(plan)}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setTimeDraft(plan.flight_time_minutes)
                          setEditingTime(plan)
                        }}
                      >
                        <Timer /> Edit flight time
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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

      {sharing && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setSharing(null)}
          planId={sharing.id}
          route={routeOf(sharing)}
          shareToken={plans.find((plan) => plan.id === sharing.id)?.share_token ?? null}
          onShareChange={(token) => patchPlan(sharing.id, { share_token: token })}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this flight plan?</DialogTitle>
            <DialogDescription>
              {deleting && <span className="font-mono">{routeOf(deleting)}</span>} will be removed from your history.
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

      <Dialog open={!!editingTime} onOpenChange={(open) => !open && setEditingTime(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Flight time</DialogTitle>
            <DialogDescription>
              {editingTime && <span className="font-mono">{routeOf(editingTime)}</span>} · optional, entered by hand.
            </DialogDescription>
          </DialogHeader>
          <FlightTimeField
            idPrefix="edit-flight-time"
            value={timeDraft}
            onChange={setTimeDraft}
            resetKey={editingTime?.id}
          />
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setEditingTime(null)}>
              Cancel
            </Button>
            <Button onClick={saveFlightTime} disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  )
}
