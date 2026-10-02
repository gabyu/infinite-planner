import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { HistoryList } from "@/components/history/history-list"
import { SignInPrompt } from "@/components/history/sign-in-prompt"
import { FLIGHT_PLAN_SUMMARY_COLUMNS, HISTORY_PAGE_SIZE, type FlightPlanSummary } from "@/lib/flight-plans"
import { getServerSupabase } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Flight history - Infinite Planner",
  robots: { index: false, follow: false },
}

// Per-user and cookie-dependent: never cached.
export const dynamic = "force-dynamic"

export default async function HistoryPage() {
  const supabase = getServerSupabase()
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } }

  // Only a signed-in user gets to the query, and RLS limits it to their own rows anyway.
  const history =
    supabase && user
      ? await supabase
          .from("flight_plans")
          .select(FLIGHT_PLAN_SUMMARY_COLUMNS, { count: "exact" })
          .order("created_at", { ascending: false })
          .range(0, HISTORY_PAGE_SIZE - 1)
      : null
  if (history?.error) console.error("Loading the flight history failed:", history.error.message)

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <PageHeader title="Flight history" description="Every flight plan you export while signed in, newest first." />

      {!supabase ? (
        <p className="text-sm text-muted-foreground">Accounts aren&apos;t available right now.</p>
      ) : !user ? (
        <SignInPrompt message="Your saved flight plans are tied to your Discord account. Sign in to see them." />
      ) : history?.error ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your flight plans right now.</p>
      ) : (
        <HistoryList
          initialPlans={(history?.data ?? []) as unknown as FlightPlanSummary[]}
          total={history?.count ?? 0}
        />
      )}
    </div>
  )
}
