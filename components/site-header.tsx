"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Upload, PencilRuler, LayoutDashboard } from "lucide-react"
import { UserMenu } from "@/components/auth/user-menu"
import { useAuthUser } from "@/hooks/use-auth-user"

const navLinkClass =
  "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-medium h-10 items-center gap-1.5"
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

// Shared site-wide header. The dashboard is only offered to signed-in users.
export function SiteHeader() {
  const { user } = useAuthUser()

  return (
    <header className="border-b">
      <div className="container mx-auto py-2 sm:py-4 px-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 no-underline group">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center">
            <Image
              src="/ip_logo.svg"
              alt="Infinite Planner Logo"
              width={32}
              height={32}
              priority
              className="w-full h-full group-hover:opacity-80 transition-opacity"
            />
          </div>
          <h1 className="text-sm sm:text-xl font-bold text-blue-600 dark:text-blue-400 group-hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap">
            Infinite Planner
          </h1>
        </Link>
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
          {user && (
            <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />}>
              <span className="hidden sm:inline">Dashboard</span>
            </NavLink>
          )}
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}
