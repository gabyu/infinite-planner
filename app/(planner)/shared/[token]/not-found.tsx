import Link from "next/link"
import { Button } from "@/components/ui/button"

// A token that doesn't exist and one whose owner stopped sharing look the same on purpose.
export default function SharedPlanNotFound() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-16 text-center">
        <h1 className="text-sm font-medium">This link isn&apos;t available</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          It may have been mistyped, or its owner stopped sharing the flight plan.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/" className="no-underline">
            Go to Infinite Planner
          </Link>
        </Button>
      </div>
    </div>
  )
}
