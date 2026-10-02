import type React from "react"
import Image from "next/image"
import { AdminFooter } from "@/components/admin/admin-footer"

// Centered card used by the two admin sign-in pages.
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-2">
            <Image src="/ip_logo.svg" alt="" width={28} height={28} />
            <span className="text-sm font-semibold tracking-tight">Infinite Planner</span>
            <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </span>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
            {children}
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  )
}
