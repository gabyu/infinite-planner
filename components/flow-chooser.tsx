"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, PencilRuler } from "lucide-react"
import { useIsTouchPrimary } from "@/hooks/use-is-touch-primary"

// The "how do you want to build your flight plan?" entry point - lives on
// the homepage. /convert (KML import) and /sketch (draw from scratch) are
// real routes, so these are plain navigation, not local state.
export function FlowChooser() {
  const isTouchPrimary = useIsTouchPrimary()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link href="/convert" className="no-underline">
          <Card className="bg-background shadow-sm border-border cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors h-full">
            <CardContent className="pt-8 pb-8 text-center flex flex-col items-center h-full">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Import a Flight</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Upload a KML file from FlightRadar24 or FlightAware and convert it into a flight plan.
              </p>
              <Button className="w-full">Import a Flight</Button>
            </CardContent>
          </Card>
        </Link>

        <Link href={isTouchPrimary ? "#" : "/sketch"} className="no-underline" aria-disabled={isTouchPrimary}>
          <Card
            className={`bg-background shadow-sm border-border transition-colors h-full ${
              isTouchPrimary ? "opacity-60" : "cursor-pointer hover:border-blue-400 dark:hover:border-blue-500"
            }`}
            onClick={(e) => isTouchPrimary && e.preventDefault()}
          >
            <CardContent className="pt-8 pb-8 text-center flex flex-col items-center h-full">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <PencilRuler className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Route Sketch</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Draw a route on a blank map with line and pen tools, then export it as a flight plan.
              </p>
              <Button className="w-full" disabled={isTouchPrimary}>
                Start a Route Sketch
              </Button>
              {isTouchPrimary && (
                <p className="text-xs text-muted-foreground mt-3">
                  Flight plan drawing is currently available on desktop only.
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
