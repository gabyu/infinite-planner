import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

// Badges of honour a pilot can hold. The contributor badge goes to the Discord members who published flight plans
// during the soft launch of the library, and stays with them after it. More will follow: each is a name the database
// reports (get_pilot_profile.badges) and a label here.
const BADGES: Record<string, { label: string; title: string }> = {
  contributor: {
    label: "Contributor",
    title: "Contributor: published flight plans while the library was being built",
  },
}

export function Badges({ badges, className }: { badges: string[]; className?: string }) {
  const known = badges.filter((name) => name in BADGES)
  if (known.length === 0) return null
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {known.map((name) => (
        <span
          key={name}
          title={BADGES[name].title}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium leading-none text-primary"
        >
          <Star size={10} className="fill-primary" aria-hidden />
          {BADGES[name].label}
        </span>
      ))}
    </span>
  )
}
