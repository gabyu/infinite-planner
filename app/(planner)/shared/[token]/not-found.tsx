import Link from "next/link"
import { PageShell } from "@/components/ds/page-shell"
import { Button } from "@/components/ui/button"

// A token that doesn't exist and one whose owner stopped sharing look the same on purpose.
export default function SharedPlanNotFound() {
  return (
    <PageShell title="Shared flight plan" description="This link isn't available." noBack>
      <div className="flex max-w-xl flex-col items-start rounded-lg border bg-card px-6 py-8">
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been mistyped, or its owner stopped sharing the flight plan.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/" className="no-underline">
            Go to Infinite Planner
          </Link>
        </Button>
      </div>
    </PageShell>
  )
}
