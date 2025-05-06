import { getFlightPlanCount } from "@/lib/db-service"
import { CounterDisplay } from "./counter-display"

export async function SiteFooter() {
  // Fetch the count server-side for initial render with cache disabled
  const flightPlanCount = await getFlightPlanCount()

  return (
    <footer className="py-6 border-t">
      <div className="container mx-auto px-4 text-center">
        <p className="text-gray-700 dark:text-gray-300 font-medium mb-3">
          <CounterDisplay initialCount={flightPlanCount} /> flight plans generated so far!
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          Infinite Planner is not affiliated with FlightRadar24, FlightAware, or Infinite Flight.
        </p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
          © {new Date().getFullYear()} Infinite Planner. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
