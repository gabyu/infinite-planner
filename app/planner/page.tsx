"use client"

import { FlightPlanEditor } from "@/components/flight-plan-editor"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, RotateCcw } from "lucide-react" // Imported RotateCcw
import { DiscordIcon } from "@/components/discord-icon"
import { SiteFooter } from "@/components/site-footer"
import "./planner.css" // Import the planner-specific CSS
import Image from "next/image"

export default function PlannerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      {/* Navigation */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 no-underline group">
            {" "}
            {/* Combined Link and added group */}
            <div className="w-8 h-8 rounded-md overflow-hidden">
              <Image
                src="/ip_logo.svg"
                alt="Infinite Planner Logo"
                width={32}
                height={32}
                priority
                className="group-hover:opacity-80 transition-opacity"
              />
            </div>
            <h1 className="text-xl font-bold text-xs sm:text-xl text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors cursor-pointer">
              Infinite Planner
            </h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="https://discord.gg/ZdB72sjET5" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="h-10 flex items-center gap-2 px-2 sm:px-4 bg-transparent">
                <DiscordIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Join Discord</span>
              </Button>
            </Link>
            <Button
              onClick={() => window.location.reload()} // Reset Planner button
              variant="outline"
              className="h-10 flex items-center gap-2 px-2 sm:px-4 bg-transparent"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Reset Planner</span>
            </Button>
            <Link href="/">
              <Button variant="outline" className="h-10 flex items-center gap-2 px-2 sm:px-4 bg-transparent">
                <Home size={16} />
                <span className="hidden sm:inline">Back to Home</span>
              </Button>
            </Link>
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
