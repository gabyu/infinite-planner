"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const sections = [
  { href: "/admin-dashboard", label: "Activity" },
  { href: "/admin-dashboard/admins", label: "Admins" },
]

// Section switcher under the shared site header. Activity is the dashboard root, so it only
// matches exactly.
export function AdminTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin sections" className="flex gap-1">
      {sections.map(({ href, label }) => {
        const active = href === "/admin-dashboard" ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
              active
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
