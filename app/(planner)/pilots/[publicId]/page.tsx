import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PlanGrid } from "@/components/explore/plan-card"
import { PrelaunchBanner } from "@/components/explore/prelaunch-banner"
import { PageShell } from "@/components/ds/page-shell"
import { SignInPrompt } from "@/components/dashboard/sign-in-prompt"
import { Button } from "@/components/ui/button"
import { getAirportInfo } from "@/lib/airports"
import { BRAND_NAME } from "@/lib/brand"
import { requireLibraryAccess } from "@/lib/library-access"
import { decodeCursor, encodeCursor, listPlans } from "@/lib/library-listing"
import { isPublicId } from "@/lib/plan-slug"
import { formatDistanceNm } from "@/lib/route-render"
import { getServerSupabase } from "@/lib/supabase/server"

// A pilot's profile: for signed-in users only and never indexed. What it shows comes from get_pilot_profile
// (fixed public facts and aggregates; the favorite airport and flight numbers are counted over all the
// pilot's exported plans, private ones included, but only the result is shown) and from the public listing.
export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: `Pilot profile | ${BRAND_NAME}`,
  robots: { index: false, follow: false },
}

interface Profile {
  public_id: string
  name: string
  avatar_url: string | null
  member_since: string
  is_self: boolean
  plans_created: number
  plans_published: number
  total_distance_nm: number
  downloads_received: number
  likes_received: number
  favorite_airport: string | null
  top_flights: string[]
}

export default async function PilotPage({
  params,
  searchParams,
}: {
  params: { publicId: string }
  searchParams: { cursor?: string }
}) {
  const { viewer, prelaunch } = await requireLibraryAccess()
  if (!isPublicId(params.publicId)) notFound()

  if (!viewer.userId) {
    return (
      <PageShell title="Pilot profile" description="Profiles are for signed-in pilots.">
        <SignInPrompt message="Sign in with Discord to see pilot profiles." />
      </PageShell>
    )
  }

  const supabase = getServerSupabase()
  const { data } = supabase ? await supabase.rpc("get_pilot_profile", { p_profile_public_id: params.publicId }) : { data: null }
  const profile = data as Profile | null
  if (!profile) notFound()

  const cursor = decodeCursor(searchParams.cursor)
  const [featured, published] = await Promise.all([
    cursor ? Promise.resolve({ plans: [], next: null }) : listPlans({ filters: { authorPublicId: profile.public_id, featuredOnly: true }, limit: 6 }),
    listPlans({ filters: { authorPublicId: profile.public_id }, cursor }),
  ])
  // A featured plan isn't repeated in the list under it.
  const featuredIds = new Set(featured.plans.map((plan) => plan.id))
  const others = published.plans.filter((plan) => !featuredIds.has(plan.id))

  const favorite = profile.favorite_airport ? getAirportInfo(profile.favorite_airport) : null
  const memberSince = new Date(profile.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  const stats = [
    { label: "Plans created", value: profile.plans_created.toLocaleString("en-US") },
    { label: "Published", value: profile.plans_published.toLocaleString("en-US") },
    { label: "Distance", value: formatDistanceNm(profile.total_distance_nm) },
    { label: "Downloads", value: profile.downloads_received.toLocaleString("en-US") },
    { label: "Likes", value: profile.likes_received.toLocaleString("en-US") },
  ]

  return (
    <>
      {prelaunch && <PrelaunchBanner />}
      <div className="container mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-16">
        <header className="flex flex-wrap items-center gap-5">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" width={72} height={72} referrerPolicy="no-referrer" className="h-[72px] w-[72px] rounded-full" />
          ) : null}
          <div>
            <h1 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">{profile.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Member since {memberSince}</p>
          </div>
          {profile.is_self && (
            <Button asChild variant="outline" className="ml-auto rounded-full">
              <Link href="/dashboard" className="no-underline">
                Edit featured
              </Link>
            </Button>
          )}
        </header>

        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-border ring-1 ring-border sm:grid-cols-5">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-card px-5 py-5">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-2 font-mono text-xl font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {(favorite || profile.top_flights.length > 0) && (
          <p className="mt-5 text-sm text-muted-foreground">
            {favorite && (
              <>
                Favorite airport: <span className="text-foreground">{favorite.name} ({favorite.icao})</span>
              </>
            )}
            {favorite && profile.top_flights.length > 0 && " · "}
            {profile.top_flights.length > 0 && (
              <>
                Flies most: <span className="font-mono text-foreground">{profile.top_flights.join(", ")}</span>
              </>
            )}
          </p>
        )}

        {featured.plans.length > 0 && (
          <section className="mt-12" aria-labelledby="featured">
            <h2 id="featured" className="mb-4 font-display text-2xl font-semibold tracking-tight">
              Featured
            </h2>
            <PlanGrid plans={featured.plans} />
          </section>
        )}

        <section className="mt-12" aria-labelledby="published">
          <h2 id="published" className="mb-4 font-display text-2xl font-semibold tracking-tight">
            Published plans
          </h2>
          {others.length > 0 ? (
            <PlanGrid plans={others} />
          ) : (
            featured.plans.length === 0 && (
              <p className="rounded-3xl bg-card px-6 py-10 text-center text-sm text-muted-foreground ring-1 ring-border">
                {profile.is_self ? "You haven't published a flight plan yet." : "No published flight plans yet."}
              </p>
            )
          )}
          {published.next && (
            <div className="mt-10 text-center">
              <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                <Link href={`/pilots/${profile.public_id}?cursor=${encodeCursor(published.next)}`} rel="next" className="no-underline">
                  Show more
                </Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
