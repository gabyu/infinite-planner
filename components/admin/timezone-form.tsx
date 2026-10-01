"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { detectBrowserTimezone, listTimezones } from "@/lib/admin/timezone"

const AUTO = "__auto__"

// Lets an admin pin the timezone used to draw days in the heatmap. Writes their own
// profile row directly (RLS + a column grant allow `timezone` and nothing else).
export function TimezoneForm({ userId, timezone }: { userId: string; timezone: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(timezone ?? AUTO)
  const [browserTz, setBrowserTz] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => setBrowserTz(detectBrowserTimezone()), [])
  const zones = useMemo(() => listTimezones(), [])
  const options = timezone && !zones.includes(timezone) ? [timezone, ...zones] : zones

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const supabase = getBrowserSupabase()
    if (!supabase) return setStatus({ kind: "error", text: "Supabase isn't configured." })

    setPending(true)
    setStatus(null)
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: value === AUTO ? null : value })
      .eq("id", userId)
    setPending(false)

    if (error) {
      setStatus({ kind: "error", text: "Couldn't save. Try again." })
    } else {
      setStatus({ kind: "ok", text: "Saved." })
      router.refresh()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value={AUTO}>Browser default{browserTz ? ` (${browserTz})` : ""}</option>
          {options.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Decides where one day ends and the next begins in the activity heatmap, and how dates are shown.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
        {status && (
          <span
            role="status"
            className={status.kind === "ok" ? "text-sm text-muted-foreground" : "text-sm text-red-600 dark:text-red-400"}
          >
            {status.text}
          </span>
        )}
      </div>
    </form>
  )
}
