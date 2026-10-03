import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type React from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ds/page-header"
import { cn } from "@/lib/utils"

interface PageShellProps {
  title: string
  description?: string
  actions?: React.ReactNode
  /** Hide the "Back" link (it goes to the homepage). */
  noBack?: boolean
  /** Narrow the content column. It stays left-aligned on the logo: content never floats to the centre. */
  width?: "full" | "narrow"
  children: React.ReactNode
}

// The one frame of every tool page (Convert, Sketch, Dashboard, shared plans).
// - Same container as the site header, so the left edge of everything lines up with the logo.
// - Back link, then the title block, always at the same height and left-aligned.
// - Content below; `width="narrow"` limits its width without centring it.
export function PageShell({ title, description, actions, noBack, width = "full", children }: PageShellProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      {!noBack && (
        <div className="mb-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2.5 gap-1 text-muted-foreground">
            <Link href="/">
              <ChevronLeft size={14} />
              Back
            </Link>
          </Button>
        </div>
      )}
      <PageHeader title={title} description={description} actions={actions} />
      <div className={cn(width === "narrow" && "max-w-lg")}>{children}</div>
    </div>
  )
}
