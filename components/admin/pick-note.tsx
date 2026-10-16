"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// The editor's note of one pinned plan: shown under its title on the front of Explore. Saved on request.
export function PickNote({ pickId, initial }: { pickId: string; initial: string | null }) {
  const router = useRouter()
  const [note, setNote] = useState(initial ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = note.trim() !== (initial ?? "")

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "note", pickId, note: note.trim() }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setError("Couldn't save the note.")
    router.refresh()
  }

  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={160}
        placeholder="A word from the editor (optional)"
        aria-label="Editor's note"
        className="h-8 min-w-[16rem] flex-1"
      />
      <Button type="submit" size="sm" variant="outline" disabled={busy || !changed}>
        Save
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  )
}
