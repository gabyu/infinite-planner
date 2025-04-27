import { FlightPlanEditor } from "@/components/flight-plan-editor"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function PlannerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      {/* Navigation */}
      <header className="border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-lg font-bold">IP</span>
            </div>
            <h1 className="text-xl font-bold">Infinite Planner</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="https://discord.gg/HmJVmYfM" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Join Discord
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">
                <Home size={16} />
                Back to Home
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
      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 text-center">
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
