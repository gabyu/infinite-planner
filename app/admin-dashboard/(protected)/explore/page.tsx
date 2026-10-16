import Link from "next/link"
import { ArrowDown, ArrowUp } from "lucide-react"
import { LibraryActionButton } from "@/components/admin/library-actions"
import { PageHeader } from "@/components/admin/page-header"
import { PickNote } from "@/components/admin/pick-note"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSessionContext, requireAdmin } from "@/lib/admin/auth"
import { planPath } from "@/lib/plan-slug"

export const dynamic = "force-dynamic"

const MAX_PICKS = 6

interface PickRow {
  id: string
  plan_id: string
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  pick_position: number
  note: string | null
  live: boolean
  author_name: string
}

interface PlanRow {
  id: string
  public_id: string
  origin_airport: string
  destination_airport: string
  flight_number: string | null
  published_at: string | null
  author_name: string
  moderation_status: "ok" | "hidden"
}

export default async function ExploreEditorPage() {
  await requireAdmin()
  const ctx = await getSessionContext()
  if (!ctx) return null

  const [picksResult, plansResult] = await Promise.all([
    ctx.supabase.rpc("admin_list_picks"),
    ctx.supabase.rpc("admin_list_library_plans"),
  ])
  const picks = (picksResult.data ?? []) as PickRow[]
  const plans = ((plansResult.data ?? []) as PlanRow[]).filter((plan) => plan.moderation_status === "ok")
  const pinned = new Set(picks.map((pick) => pick.plan_id))
  const full = picks.length >= MAX_PICKS

  return (
    <>
      <PageHeader
        title="Explore"
        description="The top of the Explore page: the plans you pin come first, in this order; the most popular ones fill in the rest."
      />

      <section aria-labelledby="front" className="mb-10">
        <h2 id="front" className="mb-3 text-sm font-semibold">
          On the front{" "}
          <Badge variant="secondary">
            {picks.length} / {MAX_PICKS}
          </Badge>
        </h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Editor&apos;s note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {picks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nothing pinned: the front shows the most popular plans. Pin up to {MAX_PICKS} below.
                  </TableCell>
                </TableRow>
              )}
              {picks.map((pick, index) => (
                <TableRow key={pick.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell>
                    <Link
                      href={planPath({
                        origin: pick.origin_airport,
                        destination: pick.destination_airport,
                        flightNumber: pick.flight_number,
                        publicId: pick.public_id,
                      })}
                      className="font-mono text-sm"
                    >
                      {pick.origin_airport} → {pick.destination_airport}
                      {pick.flight_number ? ` ${pick.flight_number}` : ""}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      by {pick.author_name}
                      {!pick.live && <span className="ml-2 text-destructive">No longer public: it is skipped on the page.</span>}
                    </p>
                  </TableCell>
                  <TableCell>
                    <PickNote pickId={pick.id} initial={pick.note} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex gap-1">
                      <LibraryActionButton variant="ghost" action={{ action: "move", pickId: pick.id, direction: -1 }}>
                        <ArrowUp className="h-4 w-4" aria-label="Move up" />
                      </LibraryActionButton>
                      <LibraryActionButton variant="ghost" action={{ action: "move", pickId: pick.id, direction: 1 }}>
                        <ArrowDown className="h-4 w-4" aria-label="Move down" />
                      </LibraryActionButton>
                      <LibraryActionButton variant="outline" action={{ action: "unpin", pickId: pick.id }}>
                        Unpin
                      </LibraryActionButton>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="public">
        <h2 id="public" className="mb-3 text-sm font-semibold">
          Public plans
        </h2>
        {full && <p className="mb-3 text-sm text-muted-foreground">The front holds {MAX_PICKS} plans. Unpin one to pin another.</p>}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead className="w-24">Flight</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nothing is public yet.
                  </TableCell>
                </TableRow>
              )}
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-mono text-sm">
                    {plan.origin_airport} → {plan.destination_airport}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{plan.flight_number ?? "—"}</TableCell>
                  <TableCell>{plan.author_name}</TableCell>
                  <TableCell className="text-right">
                    {pinned.has(plan.id) ? (
                      <Badge variant="outline">Pinned</Badge>
                    ) : (
                      <LibraryActionButton action={{ action: "pin", planId: plan.id }} variant="outline">
                        {full ? "Front is full" : "Pin to the front"}
                      </LibraryActionButton>
                    )}
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
