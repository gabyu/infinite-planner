"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plane, MapPin, TrendingUp } from "lucide-react"
import {
  getPopularAirports,
  getPopularFlights,
  getTotalStats,
  type AirportStats,
  type FlightStats,
} from "@/lib/flight-stats-service"

export function FlightStatistics() {
  const [popularAirports, setPopularAirports] = useState<AirportStats[]>([])
  const [popularFlights, setPopularFlights] = useState<FlightStats[]>([])
  const [totalStats, setTotalStats] = useState({ totalFlights: 0, totalAirports: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)

        // Fetch all statistics in parallel
        const [airports, flights, totals] = await Promise.all([
          getPopularAirports(5),
          getPopularFlights(5),
          getTotalStats(),
        ])

        setPopularAirports(airports)
        setPopularFlights(flights)
        setTotalStats(totals)
      } catch (error) {
        console.error("Error fetching flight statistics:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Don't render if no data and not loading
  if (!isLoading && totalStats.totalFlights === 0) {
    return null
  }

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Infinite Planner Statistics</h2>
          <div className="flex justify-center items-center gap-2 mb-8">
            <div className="h-[2px] w-12 bg-gray-300"></div>
            <div className="h-[2px] w-24 bg-primary"></div>
            <div className="h-[2px] w-12 bg-gray-300"></div>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Real flight data from our community of virtual pilots
          </p>
        </div>

        {/* Total Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Flights Analyzed</CardTitle>
              <Plane className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalStats.totalFlights.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From FlightRadar24 and FlightAware</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Airports</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : totalStats.totalAirports.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Origins and destinations</p>
            </CardContent>
          </Card>
        </div>

        {/* Popular Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Popular Airports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Popular Airports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                    </div>
                  ))}
                </div>
              ) : popularAirports.length > 0 ? (
                <div className="space-y-3">
                  {popularAirports.map((airport, index) => (
                    <div key={airport.airport_code} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-mono font-semibold text-primary">{airport.airport_code}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{airport.count} flights</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No airport data available yet</p>
              )}
            </CardContent>
          </Card>

          {/* Popular Flights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Popular Flights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
                    </div>
                  ))}
                </div>
              ) : popularFlights.length > 0 ? (
                <div className="space-y-3">
                  {popularFlights.map((flight, index) => (
                    <div key={flight.flight_number} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-mono font-semibold text-primary">{flight.flight_number}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{flight.count} times</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No flight data available yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
