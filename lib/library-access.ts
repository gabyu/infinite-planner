import "server-only"
import { notFound } from "next/navigation"
import { getLibraryLaunched, getViewer, isLibraryOpenFor, type Viewer } from "@/lib/library"

// The gate of the library's dynamic pages (Explore, hubs): before the launch they are admin-only and look
// like they don't exist to everyone else. Returns who is looking and whether this is the pre-launch view
// (noindex, with the banner).
export async function requireLibraryAccess(): Promise<{ viewer: Viewer; prelaunch: boolean }> {
  const viewer = await getViewer()
  if (!(await isLibraryOpenFor(viewer))) notFound()
  return { viewer, prelaunch: !(await getLibraryLaunched()) }
}
