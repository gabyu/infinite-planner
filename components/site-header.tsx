"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Upload, PencilRuler, LayoutDashboard } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { UserMenu } from "@/components/auth/user-menu"

const navLinkClass =
  "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-normal h-10 items-center gap-1.5"
const activeNavLinkClass =
  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md text-sm font-medium h-10 items-center gap-1.5"

function NavLink({
  href,
  icon,
  children,
  hideOnMobile,
}: {
  href: string
  icon?: React.ReactNode
  children: React.ReactNode
  hideOnMobile?: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === href
  const responsiveClass = hideOnMobile ? "hidden sm:flex" : "flex"

  if (isActive) {
    return (
      <span className={`${activeNavLinkClass} ${responsiveClass}`}>
        {icon}
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className={`${navLinkClass} ${responsiveClass}`}>
      {icon}
      {children}
    </Link>
  )
}

// Shared site-wide header: the same on every page, admin included. Nothing in it depends on the
// session (the Dashboard link is always there and the account slot has a fixed width), so
// links never jump while the sign-in state loads.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="container mx-auto flex items-center justify-between px-4 py-2 sm:py-4">
        <BrandLogo href="/" />
        <nav className="flex items-center gap-1 sm:gap-2 md:gap-4">
          <NavLink href="/how-it-works" hideOnMobile>
            Guide
          </NavLink>
          <NavLink href="/faq" hideOnMobile>
            FAQ
          </NavLink>
          <NavLink href="/convert" icon={<Upload size={16} />}>
            <span className="hidden sm:inline">Convert</span>
          </NavLink>
          <NavLink href="/sketch" icon={<PencilRuler size={16} />}>
            <span className="hidden sm:inline">Sketch</span>
          </NavLink>
          <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />}>
            <span className="hidden sm:inline">Dashboard</span>
          </NavLink>
          {/* Fixed width: the avatar and the "Sign in" button take the same room. */}
          <div className="flex h-10 w-10 items-center justify-end sm:w-[6.5rem]">
            <UserMenu />
          </div>
        </nav>
      </div>
    </header>
  )
}
