import { FlightPlanEditor } from "@/components/flight-plan-editor"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, Plane } from "lucide-react"
import { DiscordIcon } from "@/components/discord-icon"

export const metadata = {
  title: "Infinite Planner ● Flight Plan Converter for Infinite Flight",
}

export default function PlannerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      {/* Navigation */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/" className="no-underline hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <Plane className="h-5 w-5 text-primary-foreground" />
              </div>
            </Link>
            <h1 className="text-xl font-bold hidden sm:block">Infinite Planner</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="https://discord.gg/HmJVmYfM" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="h-10 flex items-center gap-2">
                <DiscordIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Join Discord</span>
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="h-10 flex items-center gap-2">
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
      <footer className="mt-auto py-8 border-t">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Stats last updated: <span id="stats-last-updated">--</span> | Total flight plans:{" "}
            <span id="footer-total-plans">--</span> | Version: <span id="app-version">--</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Infinite Planner is not affiliated with FlightRadar24, FlightAware, or Infinite Flight.
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
            © {new Date().getFullYear()} Infinite Planner. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
