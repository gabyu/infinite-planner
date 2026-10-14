import Link from "next/link"
import { Button } from "@/components/ui/button"

// An unknown plan, a private one, an unpublished one and a moderated one all look the same.
export default function PlanNotFound() {
  return (
    <div className="container mx-auto max-w-xl px-4 py-24">
      <h1 className="font-display text-3xl font-semibold tracking-tight">This flight plan isn&apos;t available</h1>
      <p className="mt-3 text-muted-foreground">
        The link may have been mistyped, or its author made the flight plan private.
      </p>
      <Button asChild variant="outline" className="mt-6 rounded-full">
        <Link href="/" className="no-underline">
          Go to Infinite Planner
        </Link>
      </Button>
    </div>
  )
}
