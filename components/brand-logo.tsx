import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

// The one Infinite Planner logo: mark + wordmark. Used by the site header (also on the admin
// pages), the admin sign-in card and the visualizer, so it never differs from the homepage's.
// Without `href` it renders as plain content (e.g. in the centred sign-in card).
export function BrandLogo({ href, className }: { href?: string; className?: string }) {
  const content = (
    <>
      <span className="flex h-6 w-6 items-center justify-center rounded-md sm:h-8 sm:w-8">
        <Image
          src="/ip_logo.svg"
          alt={href ? "Infinite Planner Logo" : ""}
          width={32}
          height={32}
          priority
          className="h-full w-full transition-opacity group-hover:opacity-80"
        />
      </span>
      <span className="whitespace-nowrap font-display text-sm font-semibold tracking-tight text-primary transition-opacity group-hover:opacity-80 sm:text-xl">
        Infinite Planner
      </span>
    </>
  )
  const base = cn("group flex items-center gap-2 no-underline", className)
  return href ? (
    <Link href={href} className={base}>
      {content}
    </Link>
  ) : (
    <div className={base}>{content}</div>
  )
}
