"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, Heart, Import, Settings2 } from "lucide-react"
import { DiscordIcon } from "@/components/discord-icon"
import { ShareDialog } from "@/components/share-dialog"
import { Button } from "@/components/ui/button"
import { signInWithDiscordTo, useAuthUser } from "@/hooks/use-auth-user"
import type { PlanShare } from "@/lib/flight-plans"
import { cn } from "@/lib/utils"

type Intent = "like" | "download" | "import"

interface Stats {
  likeCount: number
  importCount: number
  downloadCount: number
}

interface Me {
  planId: string | null
  isOwner: boolean
  liked: boolean
  copyId: string | null
}

interface PlanActionsProps {
  publicId: string
  // Where this page lives (canonical path), to come back to after signing in.
  path: string
  initial: Stats
  origin: string
  destination: string
  flightNumber: string | null
  visibility: "unlisted" | "public"
}

const INTENTS: Intent[] = ["like", "download", "import"]

// The part of a plan page that depends on who is looking, so it lives in the browser while the page
// itself stays cached. Anonymous visitors see everything but the actions, and get an invitation to
// sign in: whichever action they pressed is carried out when they come back (?intent=...), once.
export function PlanActions({ publicId, path, initial, origin, destination, flightNumber, visibility }: PlanActionsProps) {
  const router = useRouter()
  const { user, ready } = useAuthUser()
  const [stats, setStats] = useState<Stats>(initial)
  const [me, setMe] = useState<Me | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Intent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const [share, setShare] = useState<PlanShare>({ visibility, publicId })
  const intentRan = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/plans/${publicId}/stats`, { cache: "no-store" })
      if (!response.ok) return
      const body = await response.json()
      setStats({ likeCount: body.likeCount, importCount: body.importCount, downloadCount: body.downloadCount })
      setMe(body.me)
    } finally {
      setLoaded(true)
    }
  }, [publicId])

  // Counters and viewer state: once on arrival, again when the session is known.
  useEffect(() => {
    if (ready) refresh()
  }, [ready, user?.id, refresh])

  const signIn = (intent: Intent) => signInWithDiscordTo(`${path}?intent=${intent}`)

  const like = useCallback(
    async (liked: boolean) => {
      setError(null)
      setMe((current) => (current ? { ...current, liked } : current))
      setStats((current) => ({ ...current, likeCount: Math.max(0, current.likeCount + (liked ? 1 : -1)) }))
      const response = await fetch(`/api/plans/${publicId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error ?? "Couldn't save your like.")
        refresh()
        return
      }
      setMe((current) => (current ? { ...current, liked: body.liked } : current))
      setStats((current) => ({ ...current, likeCount: body.likeCount }))
    },
    [publicId, refresh],
  )

  const download = useCallback(() => {
    setError(null)
    window.location.assign(`/api/plans/${publicId}/fpl`)
    // The download is counted on the server; pick the new number up shortly after.
    window.setTimeout(refresh, 1500)
  }, [publicId, refresh])

  const importPlan = useCallback(async () => {
    setError(null)
    setBusy("import")
    try {
      const response = await fetch(`/api/plans/${publicId}/import`, { method: "POST" })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error ?? "Couldn't import this flight plan.")
        return
      }
      router.push(body.editPath)
    } finally {
      setBusy(null)
    }
  }, [publicId, router])

  // The action chosen before signing in, carried out once and removed from the address. Every action is
  // idempotent, so a refresh or a second tab never likes twice nor makes a second copy.
  useEffect(() => {
    if (intentRan.current || !ready || !loaded) return
    const url = new URL(window.location.href)
    const intent = url.searchParams.get("intent") as Intent | null
    if (!intent || !INTENTS.includes(intent)) return
    intentRan.current = true
    url.searchParams.delete("intent")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    if (!user || me?.isOwner) return
    if (intent === "like") like(true)
    else if (intent === "download") download()
    else importPlan()
  }, [ready, loaded, user, me, like, download, importPlan])

  const owner = !!me?.isOwner
  const liked = !!me?.liked

  return (
    <div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {owner ? (
          <>
            <Button size="lg" className="rounded-full px-6" onClick={() => setManaging(true)}>
              <Settings2 /> Manage
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-6" onClick={download}>
              <Download /> Download .fpl
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full px-4">
              <Link href="/dashboard" className="no-underline">
                Open in dashboard
              </Link>
            </Button>
          </>
        ) : (
          <>
            {me?.copyId ? (
              <Button asChild size="lg" className="rounded-full px-6">
                <Link href={`/convert?draft=${me.copyId}&fork=1`} className="no-underline">
                  <Import /> Open my copy
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className="rounded-full px-6"
                disabled={busy === "import"}
                onClick={() => (user ? importPlan() : signIn("import"))}
              >
                <Import /> {busy === "import" ? "Importing..." : "Import to my flight plans"}
              </Button>
            )}
            <Button size="lg" variant="outline" className="rounded-full px-6" onClick={() => (user ? download() : signIn("download"))}>
              <Download /> Download .fpl
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-4"
              aria-pressed={liked}
              aria-label={liked ? "Remove your like" : "Like this flight plan"}
              onClick={() => (user ? like(!liked) : signIn("like"))}
            >
              <Heart className={cn(liked && "fill-primary text-primary")} />
              {stats.likeCount}
            </Button>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <p className="mt-4 text-sm text-muted-foreground">
        {stats.downloadCount} download{stats.downloadCount === 1 ? "" : "s"} · {stats.importCount} import
        {stats.importCount === 1 ? "" : "s"} · {stats.likeCount} like{stats.likeCount === 1 ? "" : "s"}
      </p>

      {ready && !user && (
        <div className="mt-8 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Fly this route, your way.</h2>
          <ul className="mt-3 space-y-1.5 text-[15px] text-muted-foreground">
            <li>Download it for Infinite Flight, no tracker needed.</li>
            <li>Import it and adjust the route, altitudes and names to your liking.</li>
            <li>Build your own library of flight plans.</li>
          </ul>
          <Button size="lg" className="mt-5 gap-2 rounded-full px-6" onClick={() => signIn("import")}>
            <DiscordIcon className="h-4 w-4" />
            Continue with Discord
          </Button>
        </div>
      )}

      {managing && owner && me?.planId && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setManaging(false)}
          planId={me.planId}
          origin={origin}
          destination={destination}
          flightNumber={flightNumber}
          share={share}
          allowPublic
          onShareChange={(next) => {
            setShare(next)
            // A private plan has no page any more.
            if (next.visibility === "private") window.location.assign("/dashboard")
          }}
        />
      )}
    </div>
  )
}
