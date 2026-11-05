"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"

// Exactly two sections for V1. New roadmap phases add entries here; the shell stays as is.
const sections = [
  { href: "/admin-dashboard/users", label: "Users", icon: Users },
  { href: "/admin-dashboard/admins", label: "Admins", icon: ShieldCheck },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin sections" className="flex gap-1 md:flex-col">
      {sections.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
