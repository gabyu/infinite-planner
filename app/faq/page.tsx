import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import FAQSelector from "@/components/faq-selector"

// Simple FAQ data - no complex structures
const faqData = [
  {
    question: "What file formats are supported?",
    answer: (
      <div>
        <p>Infinite Planner currently supports KML files from two major flight tracking services:</p>
        <ul>
          <li>
            <strong>FlightRadar24 KML files</strong> - These typically contain flight path data with coordinates
          </li>
          <li>
            <strong>FlightAware KML files</strong> - These include more detailed flight information including airports
            and timestamps
          </li>
        </ul>
        <p>
          We automatically detect the source of your KML file and parse it accordingly. The exported file format is FPL
          (Flight Plan), which is compatible with Infinite Flight.
        </p>
      </div>
    ),
  },
  {
    question: "Why are my waypoints limited to 250?",
    answer: (
      <div>
        <p>
          Infinite Flight has a technical limitation of 250 waypoints per flight plan. This is a constraint of the
          simulator itself, not our tool.
        </p>
        <p>When your imported KML file contains more than 250 waypoints, our intelligent simplification algorithm:</p>
        <ul>
          <li>Preserves critical waypoints like turns and altitude changes</li>
          <li>Maintains 20% of waypoints for departure operations</li>
          <li>Keeps 60% for en-route navigation</li>
          <li>Reserves 20% for arrival procedures</li>
        </ul>
        <p>This ensures your flight plan remains accurate while staying within Infinite Flight's limits.</p>
      </div>
    ),
  },
  {
    question: "How accurate are the converted flight plans?",
    answer: (
      <div>
        <p>
          Our flight plans are highly accurate and based on real-world flight data from FlightRadar24 and FlightAware.
          However, there are some considerations:
        </p>
        <ul>
          <li>
            <strong>Coordinate Accuracy:</strong> We preserve the original GPS coordinates from the source data
          </li>
          <li>
            <strong>Altitude Data:</strong> Converted from meters to feet for Infinite Flight compatibility
          </li>
          <li>
            <strong>Route Optimization:</strong> Our algorithm removes redundant waypoints while preserving the flight
            path shape
          </li>
          <li>
            <strong>Airport Integration:</strong> We can automatically detect origin and destination airports from
            FlightAware files
          </li>
        </ul>
        <p>
          The resulting flight plan will closely match the real-world flight while being optimized for the Infinite
          Flight simulator.
        </p>
      </div>
    ),
  },
  {
    question: "My KML file won't import. What should I do?",
    answer: (
      <div>
        <p>If you're having trouble importing your KML file, try these troubleshooting steps:</p>
        <ol>
          <li>
            <strong>Check file format:</strong> Ensure your file has a .kml extension
          </li>
          <li>
            <strong>Verify file source:</strong> We support FlightRadar24 and FlightAware KML files
          </li>
          <li>
            <strong>File size:</strong> Very large files (&gt;10MB) may take longer to process
          </li>
          <li>
            <strong>File corruption:</strong> Try re-downloading the KML file from the original source
          </li>
          <li>
            <strong>Browser issues:</strong> Try refreshing the page or using a different browser
          </li>
        </ol>
        <p>
          If you continue to experience issues, please join our Discord community for support. Include the filename and
          source of your KML file when asking for help.
        </p>
      </div>
    ),
  },
  {
    question: "How do I use the exported flight plan in Infinite Flight?",
    answer: (
      <div>
        <p>Once you've exported your flight plan as an FPL file, follow these steps to use it in Infinite Flight:</p>
        <ol>
          <li>
            <strong>Save the FPL file:</strong> Download the .fpl file to your device
          </li>
          <li>
            <strong>Import to Infinite Flight:</strong>
            <ul>
              <li>Open Infinite Flight</li>
              <li>Go to the Flight Plan section</li>
              <li>Tap "Import" or the folder icon</li>
              <li>Select your downloaded .fpl file</li>
            </ul>
          </li>
          <li>
            <strong>Review the plan:</strong> Check waypoints, altitudes, and route
          </li>
          <li>
            <strong>Start your flight:</strong> Select your aircraft and begin flying!
          </li>
        </ol>
        <p>
          The flight plan will appear in Infinite Flight with all waypoints properly named and positioned. You can edit
          individual waypoints within Infinite Flight if needed.
        </p>
      </div>
    ),
  },
  {
    question:
      "I can't download KML file from FlightRadar24. Must I purchase a subscription plan to use Infinite Planner?",
    answer: (
      <div>
        <p>
          <strong>No, you don't need to purchase any subscription to use Infinite Planner!</strong> While FlightRadar24
          requires a paid subscription to download KML files, you can use{" "}
          <strong>FlightAware as a free alternative</strong>.
        </p>

        <h4>
          <strong>Using FlightAware (Free Option):</strong>
        </h4>
        <ol>
          <li>
            Go to{" "}
            <a href="https://www.flightaware.com" target="_blank" rel="noopener noreferrer">
              FlightAware.com
            </a>
          </li>
          <li>Use the flight finder with origin and destination airports</li>
          <li>Choose a flight that has already ended (completed flights only)</li>
          <li>Download the KML file for free</li>
        </ol>

        <h4>
          <strong>Example - Amsterdam to San Francisco flights:</strong>
        </h4>
        <p>
          Visit:{" "}
          <a
            href="https://www.flightaware.com/live/findflight?origin=EHAM&destination=KSFO"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://www.flightaware.com/live/findflight?origin=EHAM&destination=KSFO
          </a>
        </p>

        <p>
          <strong>Important:</strong> Make sure to select flights that have already completed their journey, as only
          finished flights have complete KML data available for download.
        </p>

        <p>
          FlightAware provides excellent flight data and works perfectly with Infinite Planner, often with even more
          detailed information than FlightRadar24!
        </p>
      </div>
    ),
  },
  {
    question: "I cannot import the flight plan in Infinite Flight",
    answer: (
      <div>
        <p>
          The issue is usually the file extension. The file must end with <strong>.fpl</strong> (without .xml or .kml).
        </p>

        <h4>
          <strong>On iOS / iPadOS:</strong>
        </h4>
        <ol>
          <li>Open the Files app</li>
          <li>In settings, turn "Show All Filename Extensions" ON</li>
          <li>Rename the file and remove ".xml" so it ends only with .fpl</li>
        </ol>

        <h4>
          <strong>On Android:</strong>
        </h4>
        <ol>
          <li>Save the file in a folder where Infinite Flight has permission to read</li>
          <li>Using a file manager, make sure the filename ends with .fpl</li>
        </ol>

        <p>Once the extension is correct, Infinite Flight will recognize and import the plan.</p>
      </div>
    ),
  },
  {
    question: "Will ATC accept our custom flight plan?",
    answer: (
      <div>
        <p>Yes, landing with ATC is absolutely fine — but it's important to know how Infinite Planner works.</p>
        <p>
          Infinite Planner doesn't decide which runway or approach you'll use. The flight plan you import and edit is
          what matters, and it's{" "}
          <strong>always your responsibility to follow ATC instructions and ATIS information</strong> in Infinite
          Flight, especially in Expert and Training servers.
        </p>
        <ul>
          <li>
            If you import a plan from a <strong>recent real-world flight</strong>, there's a very good chance it will
            remain valid when you fly it.
          </li>
          <li>
            At airports with GTS or GT configurations, your plan will usually be valid for landing, especially if the
            runway setup hasn't changed.
          </li>
          <li>
            If <strong>approach frequency is active</strong>, ATC may require you to follow the published ATIS and the
            preferred STAR approach. In this case, you'll need to amend your flight plan:
            <ul>
              <li>
                <strong>Remove waypoints</strong> that don't match the STAR path
              </li>
              <li>
                <strong>Add the STAR waypoints</strong> up to the final approach
              </li>
              <li>
                For the last waypoints before landing, you can still keep those from your original plan, as long as the
                runway assignment matches
              </li>
            </ul>
          </li>
        </ul>
      </div>
    ),
  },
]

export default function FAQPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      {/* Page Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-12 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Frequently Asked Questions</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Find answers to common questions about using Infinite Planner
            </p>
          </div>
        </section>

        {/* Simple FAQ Layout - Just a list of questions and answers */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <FAQSelector />
          </div>
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
