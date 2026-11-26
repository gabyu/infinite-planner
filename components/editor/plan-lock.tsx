"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { copy } from "@/lib/copy"

/** Shown on an exported plan: why it can no longer be changed, and where to duplicate it. */
export function PlanLock() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={copy.editor.planLockedLabel}
          title={copy.editor.planLockedLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p>{copy.editor.planLocked}</p>
        <Link href="/dashboard" prefetch={false} className="link">
          {copy.editor.dashboard}
        </Link>
      </PopoverContent>
    </Popover>
  )
}
