import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Plane, Map, Download } from "lucide-react"
import { DiscordIcon } from "@/components/discord-icon"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FlightStatistics } from "@/components/flight-statistics"
import { FlowChooser } from "@/components/flow-chooser"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="container mx-auto px-4 text-center">
          {/* Large logo without background container */}
          <div className="flex justify-center mb-8">
            <Image src="/ip_logo.svg" alt="Infinite Planner Logo" width={96} height={96} className="w-24 h-24" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Infinite Planner</h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto">
            The Flight Plan Hub for Infinite Flight
          </p>
          <FlowChooser />
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">About</h2>
          <div className="flex justify-center items-center gap-2 mb-8">
            <div className="h-[2px] w-12 bg-gray-300"></div>
            <div className="h-[2px] w-24 bg-primary"></div>
            <div className="h-[2px] w-12 bg-gray-300"></div>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            This site is used to convert KML flight plans from Flight Radar 24 or Flight Aware into flight plans on
            Infinite Flight.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Features</h2>
            <div className="flex justify-center items-center gap-2 mb-8">
              <div className="h-[2px] w-12 bg-gray-300"></div>
              <div className="h-[2px] w-24 bg-primary"></div>
              <div className="h-[2px] w-12 bg-gray-300"></div>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              A solid alternative to SimBrief, which allows you to replay a real-world flight with ease in mind.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            {/* Flight Plan */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-6">
                <Plane className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Flight Plan</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Import your flight plan from Flight Aware or Flight Radar 24.
              </p>
            </div>

            {/* Map */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-6">
                <Map className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Map</h3>
              <p className="text-gray-600 dark:text-gray-300">See the map of your flight plan.</p>
            </div>

            {/* Download */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-6">
                <Download className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Download</h3>
              <p className="text-gray-600 dark:text-gray-300">Download your flight plan in a few clicks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Our Team</h2>
          <div className="flex justify-center items-center gap-2 mb-8">
            <div className="h-[2px] w-12 bg-gray-300"></div>
            <div className="h-[2px] w-24 bg-primary"></div>
            <div className="h-[2px] w-12 bg-gray-300"></div>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Meet the people behind Infinite Planner
          </p>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Gabyu */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mt-4 border-4 border-white dark:border-gray-800 overflow-hidden">
                <Image
                  src="/images/gabyu.png"
                  alt="Gabyu"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold mt-4">Gabyu</h3>
              <p className="text-gray-600 dark:text-gray-300 mt-2">CEO and Cofounder</p>
            </div>
          </div>

          {/* Zetfree */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mt-4 border-4 border-white dark:border-gray-800 overflow-hidden">
                <Image
                  src="/images/zetfree.jpeg"
                  alt="Zetfree"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold mt-4">Zetfree</h3>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Cofounder</p>
            </div>
          </div>

          {/* RaphaelXT */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mt-4 border-4 border-white dark:border-gray-800 overflow-hidden">
                <Image
                  src="/images/raphaelxt.avif"
                  alt="RaphaelXT"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-bold mt-4">RaphaelXT</h3>
              <p className="text-gray-600 dark:text-gray-300 mt-2">QA Tester</p>
            </div>
          </div>
        </div>
      </section>

      {/* Flight Statistics Section */}
      <FlightStatistics />

      {/* Discord CTA Section */}
      <section className="py-12 bg-blue-700 dark:bg-blue-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Join Our Community</h2>
          <p className="mb-6 max-w-2xl mx-auto text-blue-50 dark:text-blue-100">
            Connect with other Infinite Flight enthusiasts, get help with flight planning, and stay updated on new
            features.
          </p>
          <div className="flex justify-center">
            <Link href="https://discord.gg/ZdB72sjET5" target="_blank" rel="noopener noreferrer">
              <Button
                variant="secondary"
                size="lg"
                className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 dark:bg-gray-100 dark:text-blue-800 dark:hover:bg-gray-200"
              >
                <DiscordIcon className="w-6 h-6" />
                Join Our Discord
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
