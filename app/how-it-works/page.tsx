import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MapPin } from "lucide-react"
import { DiscordIcon } from "@/components/discord-icon"
import { SiteFooter } from "@/components/site-footer"

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto py-2 sm:py-4 px-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 no-underline group">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center">
              <Image
                src="/ip_logo.svg"
                alt="Infinite Planner Logo"
                width={32}
                height={32}
                className="w-full h-full group-hover:opacity-80 transition-opacity"
              />
            </div>
            <h1 className="text-sm sm:text-xl font-bold text-blue-600 dark:text-blue-400 group-hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap">
              Infinite Planner
            </h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md text-sm font-medium h-10 flex items-center">
              Guide
            </span>
            <Link
              href="/faq"
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-md transition-colors no-underline text-sm font-medium h-10 flex items-center"
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
            <Link href="/planner">
              <Button className="h-10 flex items-center gap-2 px-2 sm:px-4">
                <MapPin size={16} />
                <span className="hidden sm:inline">Open Planner Tool</span>
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-12 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">How Infinite Planner Works</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Learn how to convert real-world flights into Infinite Flight custom flight plans in just a few simple
              steps
            </p>
          </div>
        </section>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto prose prose-lg prose-gray dark:prose-invert">
            {/* Overview Section */}
            <h2 className="text-3xl font-bold mb-6">Overview</h2>
            <p className="text-lg mb-8">
              Infinite Planner bridges the gap between real-world aviation data and the Infinite Flight simulator. Our
              tool takes actual flight paths from services like FlightRadar24 and FlightAware and converts them into
              flight plans that work seamlessly with Infinite Flight's 250-waypoint limitation.
            </p>

            {/* Step by Step Process */}
            <h2 className="text-3xl font-bold mb-6">Step-by-Step Process</h2>

            <h3 className="text-2xl font-semibold mb-4">1. Obtaining Your KML File</h3>
            <p className="mb-4">
              Before using Infinite Planner, you'll need to obtain a KML file from a supported flight tracking service:
            </p>

            <h4 className="text-xl font-medium mb-3">From FlightRadar24:</h4>
            <ol className="mb-6">
              <li>Visit FlightRadar24.com and search for your desired flight</li>
              <li>Click on the flight to view its details</li>
              <li>Look for the "Export" or "Download" option</li>
              <li>Select "KML" format to download the flight path</li>
            </ol>

            <h4 className="text-xl font-medium mb-3">From FlightAware:</h4>
            <ol className="mb-8">
              <li>Navigate to FlightAware.com and find your flight</li>
              <li>Open the flight details page</li>
              <li>Click on "Track Log" or "Flight Path"</li>
              <li>Download the KML file from the available options</li>
            </ol>

            <h3 className="text-2xl font-semibold mb-4">2. Importing Your Flight Data</h3>
            <p className="mb-4">Once you have your KML file, importing it into Infinite Planner is straightforward:</p>
            <ul className="mb-6">
              <li>
                <strong>Click "Import KML"</strong> - Use the import button in the planner tool
              </li>
              <li>
                <strong>Select your file</strong> - Choose the KML file you downloaded
              </li>
              <li>
                <strong>Automatic detection</strong> - Our system automatically identifies whether it's from
                FlightRadar24 or FlightAware
              </li>
              <li>
                <strong>Instant processing</strong> - The flight path is processed and optimized immediately
              </li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">3. Intelligent Route Optimization</h3>
            <p className="mb-4">
              This is where the magic happens. Our advanced algorithm analyzes your flight path and applies intelligent
              simplification:
            </p>

            <h4 className="text-xl font-medium mb-3">Waypoint Distribution Strategy:</h4>
            <ul className="mb-6">
              <li>
                <strong>Departure Phase (20%)</strong> - Preserves detailed ground operations and initial climb
              </li>
              <li>
                <strong>En-route Phase (60%)</strong> - Maintains critical navigation points and turns
              </li>
              <li>
                <strong>Arrival Phase (20%)</strong> - Keeps approach and landing waypoints intact
              </li>
            </ul>

            <h4 className="text-xl font-medium mb-3">Smart Waypoint Selection:</h4>
            <ul className="mb-8">
              <li>Identifies significant course changes and turns</li>
              <li>Preserves altitude change points</li>
              <li>Removes redundant straight-line waypoints</li>
              <li>Maintains the overall flight path accuracy</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">4. Customization and Editing</h3>
            <p className="mb-4">After import, you have full control over your flight plan:</p>

            <h4 className="text-xl font-medium mb-3">Map-Based Editing:</h4>
            <ul className="mb-4">
              <li>Visual flight path preview on interactive map</li>
              <li>Drag waypoints to adjust positions</li>
              <li>Add new waypoints by clicking on the route</li>
              <li>Real-time route updates</li>
            </ul>

            <h4 className="text-xl font-medium mb-3">Waypoint Management:</h4>
            <ul className="mb-8">
              <li>Rename waypoints individually or in bulk</li>
              <li>Set custom altitudes for each waypoint</li>
              <li>Delete unnecessary waypoints</li>
              <li>Apply custom naming schemes</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">5. Export to Infinite Flight</h3>
            <p className="mb-4">The final step is exporting your optimized flight plan:</p>
            <ol className="mb-8">
              <li>
                <strong>Click "Export FPL"</strong> - Generate the Infinite Flight compatible file
              </li>
              <li>
                <strong>Download automatically</strong> - The .fpl file downloads to your device
              </li>
              <li>
                <strong>Import to Infinite Flight</strong> - Use the file in your simulator
              </li>
              <li>
                <strong>Start flying!</strong> - Your real-world flight plan is ready to use
              </li>
            </ol>

            {/* Technical Details */}
            <h2 className="text-3xl font-bold mb-6">Technical Details</h2>

            <h3 className="text-2xl font-semibold mb-4">Supported File Formats</h3>
            <ul className="mb-6">
              <li>
                <strong>Input:</strong> KML files from FlightRadar24 and FlightAware
              </li>
              <li>
                <strong>Output:</strong> FPL (Flight Plan) files compatible with Infinite Flight
              </li>
              <li>
                <strong>Coordinate System:</strong> WGS84 (World Geodetic System 1984)
              </li>
              <li>
                <strong>Altitude Units:</strong> Converted from meters to feet automatically
              </li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">Data Processing</h3>
            <ul className="mb-8">
              <li>
                <strong>Coordinate Precision:</strong> Maintains 6 decimal places for accuracy
              </li>
              <li>
                <strong>Route Validation:</strong> Checks for gaps and discontinuities
              </li>
              <li>
                <strong>Duplicate Removal:</strong> Eliminates redundant waypoints
              </li>
              <li>
                <strong>Path Smoothing:</strong> Optimizes route while preserving shape
              </li>
            </ul>

            {/* Video Tutorial */}
            <h2 className="text-3xl font-bold mb-6">Video Tutorial</h2>
            <p className="mb-4">Watch our comprehensive tutorial to see Infinite Planner in action:</p>

            <div className="relative w-full mb-8" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                src="https://www.youtube.com/embed/1PxZdh3p6Xg"
                title="How to Use Infinite Planner - Complete Tutorial"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Tips and Best Practices */}
            <h2 className="text-3xl font-bold mb-6">Tips and Best Practices</h2>

            <h3 className="text-2xl font-semibold mb-4">Choosing the Right Flight</h3>
            <ul className="mb-6">
              <li>Select flights with clear departure and arrival airports</li>
              <li>Longer flights typically provide better route optimization results</li>
              <li>International flights often have more interesting waypoint patterns</li>
              <li>Avoid flights with multiple stops or diversions for best results</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">Optimization Tips</h3>
            <ul className="mb-6">
              <li>
                <strong>Review the map preview</strong> before exporting to catch any issues
              </li>
              <li>
                <strong>Check waypoint names</strong> and rename them for better organization
              </li>
              <li>
                <strong>Verify altitudes</strong> match your intended flight profile
              </li>
              <li>
                <strong>Test in Infinite Flight</strong> before starting long flights
              </li>
            </ul>

            <h3 className="text-2xl font-semibold mb-4">Troubleshooting Common Issues</h3>
            <ul className="mb-8">
              <li>
                <strong>Large gaps in route:</strong> Check the original KML file quality
              </li>
              <li>
                <strong>Too few waypoints:</strong> The original flight may have been very direct
              </li>
              <li>
                <strong>Import failures:</strong> Ensure the KML file is from a supported source
              </li>
              <li>
                <strong>Infinite Flight compatibility:</strong> Verify you're using the latest app version
              </li>
            </ul>

            {/* Call to Action */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-8 text-center mb-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-lg mb-6">
                Transform your next Infinite Flight experience with real-world flight plans
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/planner" className="no-underline">
                  <Button size="lg" className="flex items-center gap-2">
                    <MapPin size={20} />
                    Open Planner Tool
                  </Button>
                </Link>
                <Link href="/faq" className="no-underline">
                  <Button variant="outline" size="lg" className="flex items-center gap-2 bg-transparent">
                    FAQ
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
