import { NextResponse } from "next/server"

export async function GET() {
  // Get version information from Vercel environment variables
  const version = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7) : "development"

  return NextResponse.json({
    version,
    environment: process.env.VERCEL_ENV || "development",
    buildTime: process.env.VERCEL_GIT_COMMIT_MESSAGE ? new Date().toISOString() : new Date().toISOString(),
  })
}
