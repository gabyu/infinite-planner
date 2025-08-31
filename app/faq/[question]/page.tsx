import { notFound } from "next/navigation"
import type { Metadata } from "next/metadata"
import FAQPage from "../page"

// FAQ data - same as in the main FAQ page
const faqData = [
  {
    id: "supported-file-formats",
    question: "What file formats are supported?",
    answer: `Infinite Planner currently supports KML files from FlightRadar24 and FlightAware, exporting to FPL format for Infinite Flight.`,
  },
  {
    id: "waypoint-limitations",
    question: "Why are my waypoints limited to 250?",
    answer: `Infinite Flight has a technical limitation of 250 waypoints per flight plan. Our algorithm optimizes routes while staying within this limit.`,
  },
  {
    id: "flight-plan-accuracy",
    question: "How accurate are the converted flight plans?",
    answer: `Our flight plans are highly accurate, based on real-world data with preserved GPS coordinates and optimized routes for Infinite Flight.`,
  },
  {
    id: "troubleshooting-import-issues",
    question: "My KML file won't import. What should I do?",
    answer: `Check file format, verify source, ensure reasonable file size, and try re-downloading if issues persist.`,
  },
  {
    id: "infinite-flight-compatibility",
    question: "How do I use the exported flight plan in Infinite Flight?",
    answer: `Download the FPL file, open Infinite Flight, go to Flight Plan section, tap Import, and select your downloaded file.`,
  },
  {
    id: "cannot-download-flightradar24",
    question:
      "I can't download KML file from FlightRadar24. Must I purchase a subscription plan to use Infinite Planner?",
    answer: `No, you don't need to purchase any subscription! Use FlightAware as a free alternative to download KML files.`,
  },
  {
    id: "cannot-import-flight-plan",
    question: "I cannot import the flight plan in Infinite Flight",
    answer: `The issue is usually the file extension. Ensure the file ends with .fpl (not .xml or .kml) and check device-specific instructions.`,
  },
  {
    id: "atc-acceptance",
    question: "Will ATC accept our custom flight plan?",
    answer: `Yes, ATC will accept custom flight plans. Always follow ATC instructions and ATIS information in Infinite Flight, especially in Expert and Training servers.`,
  },
]

interface Props {
  params: {
    question: string
  }
}

export async function generateStaticParams() {
  return faqData.map((faq) => ({
    question: faq.id,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const faq = faqData.find((item) => item.id === params.question)

  if (!faq) {
    return {
      title: "FAQ Not Found - Infinite Planner",
    }
  }

  return {
    title: `${faq.question} - Infinite Planner FAQ`,
    description: faq.answer,
    openGraph: {
      title: `${faq.question} - Infinite Planner FAQ`,
      description: faq.answer,
      type: "article",
    },
  }
}

export default function QuestionPage({ params }: Props) {
  const faq = faqData.find((item) => item.id === params.question)

  if (!faq) {
    notFound()
  }

  // Return the main FAQ page component - it will handle the URL routing
  return <FAQPage />
}
