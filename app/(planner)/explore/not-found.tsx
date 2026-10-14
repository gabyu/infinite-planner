import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LIBRARY_NAME, LIBRARY_PATH } from "@/lib/brand"

export default function ExploreNotFound() {
  return (
    <div className="container mx-auto max-w-xl px-4 py-24">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Nothing here yet</h1>
      <p className="mt-3 text-muted-foreground">There are no published flight plans for this page.</p>
      <Button asChild variant="outline" className="mt-6 rounded-full">
        <Link href={LIBRARY_PATH} className="no-underline">
          Browse {LIBRARY_NAME}
        </Link>
      </Button>
    </div>
  )
}
