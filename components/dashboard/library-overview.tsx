import Link from "next/link"
import { Compass, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LIBRARY_NAME, LIBRARY_PATH } from "@/lib/brand"

export interface LibraryTotals {
  published: number
  downloads: number
  likes: number
  imports: number
}

// What the community did with the user's plans, in four small numbers, and the way into the library and
// the user's own profile. Only shown once the library is open to them.
export function LibraryOverview({ totals, profilePublicId }: { totals: LibraryTotals; profilePublicId: string | null }) {
  const cards = [
    { label: "Published", value: totals.published },
    { label: "Downloads received", value: totals.downloads },
    { label: "Likes received", value: totals.likes },
    { label: "Imports received", value: totals.imports },
  ]
  return (
    <section className="mt-6" aria-label="Your plans in the library">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">In the library</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={LIBRARY_PATH} className="no-underline">
              <Compass /> Explore {LIBRARY_NAME}
            </Link>
          </Button>
          {profilePublicId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/pilots/${profilePublicId}`} className="no-underline">
                <UserRound /> View my profile
              </Link>
            </Button>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card px-4 py-3">
            <dt className="studio-label">{label}</dt>
            <dd className="mt-1.5 font-mono text-lg">{value.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
