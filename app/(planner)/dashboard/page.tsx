import type { Metadata } from "next"
import Link from "next/link"
import { PencilRuler, Upload } from "lucide-react"
import { PageShell } from "@/components/ds/page-shell"
import { Button } from "@/components/ui/button"
import { ActivityOverview } from "@/components/dashboard/activity-overview"
import { FlightsList } from "@/components/dashboard/flights-list"
import { SignInPrompt } from "@/components/dashboard/sign-in-prompt"
import { FLIGHT_PLAN_SUMMARY_COLUMNS, HISTORY_PAGE_SIZE, type FlightPlanSummary } from "@/lib/flight-plans"
import { getServerSupabase } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Dashboard - Infinite Planner",
  robots: { index: false, follow: false },
}

// Per-user and cookie-dependent: never cached.
export const dynamic = "force-dynamic"

// 53 weeks plus a day of slack either way for timezone offsets (same window as the admin heatmap).
const GRAPH_WINDOW_DAYS = 380

// The Discord display name (global name), else the account name.
function displayNameOf(meta: Record<string, any> | undefined) {
  return (
    meta?.custom_claims?.global_name ??
    meta?.full_name ??
    meta?.user_name ??
    (typeof meta?.name === "string" ? meta.name.replace(/#0$/, "") : null) ??
    null
  )
}

export default async function DashboardPage() {
  const supabase = getServerSupabase()
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } }

  if (!supabase) {
    return (
      <PageShell title="Dashboard" description="Your flight plans and your activity.">
        <p className="text-sm text-muted-foreground">Accounts aren&apos;t available right now.</p>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell title="Dashboard" description="Your flight plans and your activity.">
        <SignInPrompt message="Your flight plans are tied to your Discord account. Sign in to see them." />
      </PageShell>
    )
  }

  // Both queries only ever see the signed-in user's own rows (RLS), the same flight_plans table the
  // admin overview reads unfiltered.
  const since = new Date(Date.now() - GRAPH_WINDOW_DAYS * 86_400_000).toISOString()
  const [plans, exported] = await Promise.all([
    supabase
      .from("flight_plans")
      .select(FLIGHT_PLAN_SUMMARY_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, HISTORY_PAGE_SIZE - 1),
    // One timestamp per exported plan: the graph counts flight plans generated (exported), by day.
    supabase
      .from("flight_plans")
      .select("created_at")
      .eq("status", "exported")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
  ])
  if (plans.error) console.error("Loading the dashboard failed:", plans.error.message)
  if (exported.error) console.error("Loading the activity graph failed:", exported.error.message)

  const name = displayNameOf(user.user_metadata)
  const exportTimes = (exported.data ?? []).map((row) => Math.floor(Date.parse(row.created_at as string) / 1000))

  return (
    <PageShell
      title={name ? `Welcome, ${name}` : "Welcome"}
      description="Your flight plans and your activity."
      actions={
        <div className="flex gap-2">
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
      }
    >
      <ActivityOverview exportTimes={exportTimes} />

      <section className="mt-8" aria-labelledby="my-flights-title">
        <h2 id="my-flights-title" className="mb-3 text-sm font-semibold">
          My flights
        </h2>
        {plans.error ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your flight plans right now.</p>
        ) : (
          <FlightsList initialPlans={(plans.data ?? []) as unknown as FlightPlanSummary[]} total={plans.count ?? 0} />
        )}
      </section>
    </PageShell>
  )
}
