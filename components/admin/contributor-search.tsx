"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { LibraryActionButton } from "@/components/admin/library-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Member {
  id: string
  discord_username: string
  avatar_url: string | null
  exported_count: number
}

// Finds Discord members by name (admin_find_members, through the admin page's own route) and raises one to contributor.
export function ContributorSearch() {
  const [query, setQuery] = useState("")
  const [members, setMembers] = useState<Member[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/admin/members?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setError("The search failed. Please try again.")
    setMembers(((await response.json()) as { members: Member[] }).members)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex max-w-md items-center gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a Discord member by name"
            aria-label="Find a Discord member by name"
            maxLength={100}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !query.trim()}>
          Search
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {members && (
        <ul className="max-w-md divide-y rounded-lg border bg-card">
          {members.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No member matches &quot;{query}&quot;.</li>}
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar className="h-7 w-7">
                  {member.avatar_url && <AvatarImage src={member.avatar_url} alt="" referrerPolicy="no-referrer" />}
                  <AvatarFallback className="text-[10px] uppercase">{member.discord_username.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{member.discord_username}</span>
                  <span className="block text-xs text-muted-foreground">
                    {member.exported_count} exported flight plan{member.exported_count === 1 ? "" : "s"}
                  </span>
                </span>
              </span>
              <LibraryActionButton action={{ action: "contributor", userId: member.id, contributor: true }}>Make contributor</LibraryActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
