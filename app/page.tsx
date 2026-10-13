import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { DiscordIcon } from "@/components/discord-icon"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FlightStatistics } from "@/components/flight-statistics"
import { Hero } from "@/components/home/hero"
import { getRecentFlights } from "@/lib/recent-flights"

// The globe shows the latest flight plans: rebuild the page in the background at most every 5 minutes.
export const revalidate = 300

const STEPS = [
  {
    n: "01",
    title: "Flight plan",
    text: "Import a flight from Flight Aware or Flight Radar 24. Waypoints and altitudes come with it.",
  },
  {
    n: "02",
    title: "Map",
    text: "See the whole route on the map, waypoint by waypoint, and check it before you take off.",
  },
  {
    n: "03",
    title: "Download",
    text: "Download your flight plan in a few clicks, ready to load straight into Infinite Flight.",
  },
]

const TEAM = [
  { name: "Gabyu", role: "CEO and Cofounder", image: "/images/gabyu.png" },
  { name: "Zetfree", role: "Cofounder", image: "/images/zetfree.jpeg" },
  { name: "RaphaelXT", role: "QA Tester", image: "/images/raphaelxt.avif" },
]

export default async function HomePage() {
  const flights = await getRecentFlights(8)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <Hero flights={flights} />

      {/* What it does */}
      <section className="border-t">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <p className="max-w-4xl font-display text-3xl font-medium leading-[1.12] tracking-[-0.025em] sm:text-4xl md:text-5xl">
            A solid alternative to SimBrief, which allows you to replay a real-world flight with ease in mind.
          </p>
          <p className="mt-6 max-w-2xl text-lg font-light leading-relaxed text-muted-foreground md:text-xl">
            This site is used to convert KML flight plans from Flight Radar 24 or Flight Aware into flight plans on
            Infinite Flight.
          </p>

          <ol className="mt-16 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="flex min-h-56 flex-col justify-between rounded-3xl bg-muted/60 p-7 md:p-8">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{step.n}</span>
                <div>
                  <h3 className="font-display text-2xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 font-light leading-relaxed text-muted-foreground text-pretty">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Team */}
      <section className="border-t">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl md:text-5xl">Our Team</h2>
          <p className="mt-4 text-lg font-light text-muted-foreground md:text-xl">
            Meet the people behind Infinite Planner
          </p>
          <ul className="mt-12 grid gap-10 sm:grid-cols-3">
            {TEAM.map((person) => (
              <li key={person.name} className="flex items-center gap-4">
                <Image
                  src={person.image}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-full object-cover"
                />
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight">{person.name}</h3>
                  <p className="font-light text-muted-foreground">{person.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FlightStatistics />

      {/* Community */}
      <section className="container mx-auto px-4 pb-20 md:pb-28">
        <div className="rounded-[2rem] bg-blue-600 px-6 py-16 text-center text-white dark:bg-blue-700 md:px-12 md:py-24">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl md:text-5xl">
            Join Our Community
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg font-light leading-relaxed text-blue-50">
            Connect with other Infinite Flight enthusiasts, get help with flight planning, and stay updated on new
            features.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-9 h-12 rounded-full bg-white px-7 text-base text-blue-700 hover:bg-blue-50"
          >
            <Link href="https://discord.gg/ZdB72sjET5" target="_blank" rel="noopener noreferrer">
              <DiscordIcon className="!size-5" />
              Join Our Discord
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
