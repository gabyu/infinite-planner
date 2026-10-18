// The Help page's questions as plain text: the single source for the FAQ's questions (components/faq-selector.tsx
// renders the rich answers) and for the FAQPage structured data, which needs text, not JSX. When an answer
// changes in the selector, change its summary here too.
export const FAQ_TEXT = {
  "file-formats": {
    question: "What file formats are supported?",
    answer:
      "Infinite Planner reads KML files from FlightRadar24 and FlightAware and detects the source automatically. The exported file is an FPL flight plan, which Infinite Flight can load.",
  },
  "waypoint-limit": {
    question: "Why are my waypoints limited to 250?",
    answer:
      "Infinite Flight allows 250 waypoints per flight plan. When a KML file has more, Infinite Planner simplifies the route and keeps the turns and altitude changes, so the plan stays accurate within the simulator's limit.",
  },
  accuracy: {
    question: "How accurate are the converted flight plans?",
    answer:
      "Plans follow the real flight data from FlightRadar24 or FlightAware: GPS coordinates are preserved, altitudes are converted from meters to feet, redundant waypoints are removed and FlightAware files also give the origin and destination airports.",
  },
  "import-issue": {
    question: "My KML file won't import. What should I do?",
    answer:
      "Check that the file ends in .kml and comes from FlightRadar24 or FlightAware, allow extra time for files over 10 MB, download the file again in case it is corrupted, or try another browser. If it still fails, ask on the Discord community and mention the file name and its source.",
  },
  "export-usage": {
    question: "How do I use the exported flight plan in Infinite Flight?",
    answer:
      "Download the .fpl file to your device, open Infinite Flight, go to the Flight Plan section, tap Import and select the file. Review the waypoints and altitudes, then pick your aircraft and fly.",
  },
  subscription: {
    question: "Must I purchase a subscription plan to use Infinite Planner?",
    answer:
      "No. FlightRadar24 requires a paid plan to download KML files, but FlightAware offers them for free for completed flights, and they work with Infinite Planner.",
  },
  "fpl-import": {
    question: "I cannot import the flight plan in Infinite Flight",
    answer:
      "The cause is usually the file extension: the file must end in .fpl, not .fpl.xml or .kml. On iOS, show all filename extensions in the Files app and rename the file. On Android, save it where Infinite Flight can read it and check the name.",
  },
  "atc-compatible": {
    question: "Will ATC accept our custom flight plan?",
    answer:
      "Yes, you can land with ATC. Infinite Planner does not pick runways or approaches, so you always follow ATC instructions and the ATIS. A plan from a recent real flight usually stays valid; if approach is active, replace the final waypoints with the arrival route ATC gives you.",
  },
  explore: {
    question: "What is Explore, and who can see my flight plans?",
    answer:
      "Explore is the library of routes drawn in Route Sketch and published by the community. Your plans are private until you make one public; a public plan is listed in Explore and indexed by search engines, with your Discord name and avatar. You can make it private again at any time.",
  },
  "download-import": {
    question: "Can I download or adapt someone else's flight plan?",
    answer:
      "Yes, when signed in with Discord. Download gives you the .fpl file. Import adds a copy to your dashboard that you can edit and export as your own; the original never changes. You can also like a plan to find it under Favorites.",
  },
  report: {
    question: "How do I report a flight plan?",
    answer:
      "Open the flight plan while signed in and choose Report this flight plan, then pick a reason. Admins review reports and can hide a plan. For rights infringement, write to the address in the Terms of Service.",
  },
} as const

export type FaqId = keyof typeof FAQ_TEXT
