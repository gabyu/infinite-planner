import type React from "react"
import type { Metadata } from "next"

// Load Vercel Speed Insights for performance monitoring - using stable version
import { SpeedInsights } from "@vercel/speed-insights/react"

import { Inter, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

// Load IBM Plex Mono with more weights for better flexibility
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
})

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Infinite Planner - Flight Plan Converter for Infinite Flight",
  description:
    "Turn real-world flights into Infinite Flight custom flight plans! Import KML files from FlightRadar24 or FlightAware and export to Infinite Flight.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  // Add OpenGraph metadata for social media sharing
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://infiniteplanner.gabyu.com/",
    title: "Infinite Planner - Flight Plan Converter for Infinite Flight",
    description: "Turn real-world flights into Infinite Flight custom flight plans!",
    siteName: "Infinite Planner",
    images: [
      {
        url: "/images/infinite-planner-og.webp",
        width: 1200,
        height: 630,
        alt: "Infinite Planner",
      },
    ],
  },
  // Add Twitter card metadata
  twitter: {
    card: "summary_large_image",
    title: "Infinite Planner - Flight Plan Converter for Infinite Flight",
    description: "Turn real-world flights into Infinite Flight custom flight plans!",
    images: ["/images/infinite-planner-og.webp"],
  },
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts to improve loading performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${ibmPlexMono.variable} ${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        {/* Load Vercel Speed Insights for performance monitoring */}
        <SpeedInsights />
      </body>
    </html>
  )
}
