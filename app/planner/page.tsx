"use client"

import { FlightPlanEditor } from "@/components/flight-plan-editor"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { DiscordIcon } from "@/components/discord-icon"
import { SiteFooter } from "@/components/site-footer"
import "./planner.css"
import Image from "next/image"

export default function PlannerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      {/* Navigation */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto py-2 sm:py-4 px-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 no-underline group">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md overflow-hidden">
              <Image
                src="/ip_logo.svg"
                alt="Infinite Planner Logo"
                width={32}
                height={32}
                priority
                className="group-hover:opacity-80 transition-opacity w-full h-full"
              />
            </div>
            <h1 className="text-sm sm:text-xl font-bold text-blue-600 dark:text-blue-400 group-hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap">
              Infinite Planner
            </h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/how-it-works"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-medium h-10 flex items-center hidden sm:block"
            >
              Guide
            </Link>
            <Link
              href="/faq"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-medium h-10 flex items-center hidden sm:block"
            >
              FAQ
            </Link>
            <Link
              href="https://discord.gg/ZdB72sjET5"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:block"
            >
              <Button variant="outline" className="h-10 flex items-center gap-2 px-4 bg-transparent">
                <DiscordIcon className="w-5 h-5" />
                <span>Join Discord</span>
              </Button>
            </Link>
            <Link href="https://discord.gg/ZdB72sjET5" target="_blank" rel="noopener noreferrer" className="md:hidden">
              <Button variant="outline" className="h-10 w-10 p-0 bg-transparent">
                <DiscordIcon className="w-5 h-5" />
              </Button>
            </Link>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="h-10 flex items-center gap-2 px-2 sm:px-4 bg-transparent"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Reset Planner</span>
            </Button>
          </nav>
        </div>
      </header>

      {/* Flight Plan Editor */}
      <main className="flex-grow">
        <FlightPlanEditor />
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
