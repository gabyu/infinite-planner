import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

// The "origin → destination" arrow as an icon: the font's → glyph is very wide, this one is
// close to square and scales with the surrounding text.
export function RouteArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-label="to"
      className={cn("mx-[0.3em] inline-block h-[0.95em] w-[0.95em] shrink-0 align-[-0.12em]", className)}
      strokeWidth={2.25}
    />
  )
}
