import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Infinite Planner ● Turn real-world flights into Infinite Flight custom flight plans!",
  description:
    "Turn real-world flights into Infinite Flight custom flight plans! Import KML files from FlightRadar24 or FlightAware and export to Infinite Flight.",
  keywords: "Infinite Flight, flight plan converter, FlightRadar24, FlightAware, KML, flight simulator, aviation",
  authors: [{ name: "Infinite Planner Team" }],
  creator: "Infinite Planner",
  publisher: "Infinite Planner",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  // Open Graph metadata for social media sharing
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://infinite-planner.vercel.app/",
    title: "Infinite Planner ● Turn real-world flights into Infinite Flight custom flight plans!",
    description:
      "Turn real-world flights into Infinite Flight custom flight plans! Import KML files from FlightRadar24 or FlightAware and export to Infinite Flight.",
    siteName: "Infinite Planner",
    images: [
      {
        url: "/infinite-planner-og.png",
        width: 1200,
        height: 630,
        alt: "Infinite Planner - Flight Plan Converter for Infinite Flight",
      },
    ],
  },
  // Twitter card metadata
  twitter: {
    card: "summary_large_image",
    title: "Infinite Planner ● Turn real-world flights into Infinite Flight custom flight plans!",
    description:
      "Turn real-world flights into Infinite Flight custom flight plans! Import KML files from FlightRadar24 or FlightAware and export to Infinite Flight.",
    images: ["/infinite-planner-og.png"],
    creator: "@InfinitePlanner",
  },
  // Canonical URL
  alternates: {
    canonical: "https://infinite-planner.vercel.app/",
  },
  // Robots directive
  robots: {
    index: true,
    follow: true,
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
