import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowDown, ArrowUp, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LocalDate } from "@/components/admin/local-date"
import { ADMIN_BASE, getSessionContext } from "@/lib/admin/auth"

const PAGE_SIZE = 25

type SortKey = "name" | "signed_up" | "exported" | "drafts" | "shared" | "last_active"
type SortDir = "asc" | "desc"

const SORT_KEYS: SortKey[] = ["name", "signed_up", "exported", "drafts", "shared", "last_active"]
// First click on a column: names read A-Z, everything else biggest / most recent first.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  signed_up: "desc",
  exported: "desc",
  drafts: "desc",
  shared: "desc",
  last_active: "desc",
}

interface UserRow {
  id: string
  discord_username: string | null
  avatar_url: string | null
  created_at: string
  exported_count: number
  draft_count: number
  shared_count: number
  share_downloads: number
  last_active: string | null
  total_count: number
}

function usersHref(params: { page?: number; q: string; sort: SortKey; dir: SortDir }) {
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.sort !== "signed_up" || params.dir !== "desc") {
    query.set("sort", params.sort)
    query.set("dir", params.dir)
  }
  if (params.page && params.page > 1) query.set("page", String(params.page))
  const qs = query.toString()
  return `${ADMIN_BASE}/users${qs ? `?${qs}` : ""}`
}

// Discord accounts with their flight activity. Search, sorting and paging all happen in the
// admin_list_users SQL function and are driven by the URL, so this page needs no client JS.
export async function UsersSection({
  page,
  search,
  sort: sortParam,
  dir: dirParam,
}: {
  page: number
  search: string
  sort?: string
  dir?: string
}) {
  const ctx = await getSessionContext()
  if (!ctx) return null

  const q = search.trim().slice(0, 100)
  const sort = SORT_KEYS.find((key) => key === sortParam) ?? "signed_up"
  const dir: SortDir = dirParam === "asc" || dirParam === "desc" ? dirParam : DEFAULT_DIR[sort]

  const { data, error } = await ctx.supabase.rpc("admin_list_users", {
    p_search: q || null,
    p_sort: sort,
    p_dir: dir,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  })

  if (error) {
    console.error("Loading users failed:", error.message)
    return <p className="text-sm text-muted-foreground">Couldn't load users right now.</p>
  }

  const users = (data ?? []) as UserRow[]
  // A stale link to a page that no longer exists (e.g. after a narrower search): back to the first one.
  if (users.length === 0 && page > 1) redirect(usersHref({ q, sort, dir }))

  const total = Number(users[0]?.total_count ?? 0)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const timezone = ctx.profile?.timezone ?? null

  const header = (key: SortKey, label: string, className?: string) => {
    const active = sort === key
    const nextDir: SortDir = active ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key]
    const Icon = dir === "asc" ? ArrowUp : ArrowDown
    return (
      <TableHead className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link
          href={usersHref({ q, sort: key, dir: nextDir })}
          className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
        >
          {label}
          {active && <Icon className="h-3 w-3" aria-hidden />}
        </Link>
      </TableHead>
    )
  }

  const number = (value: number) => (value === 0 ? <span className="text-muted-foreground/60">0</span> : value)

  return (
    <div className="space-y-3">
      <form action={`${ADMIN_BASE}/users`} method="get" className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by Discord name"
            aria-label="Search users by Discord name"
            maxLength={100}
            className="pl-9"
          />
        </div>
        {/* Keep the current sort when searching. */}
        {(sort !== "signed_up" || dir !== "desc") && (
          <>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
          </>
        )}
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q && (
          <Button asChild variant="ghost">
            <Link href={usersHref({ q: "", sort, dir })}>Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {header("name", "Discord user")}
              {header("signed_up", "Signed up", "w-32")}
              {header("exported", "Exported", "w-28")}
              {header("drafts", "Drafts", "w-24")}
              {header("shared", "Shared", "w-24")}
              {header("last_active", "Last active", "w-32")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {q ? `No user matches "${q}".` : "No one has signed in with Discord yet."}
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-7 w-7">
                      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" referrerPolicy="no-referrer" />}
                      <AvatarFallback className="text-[10px] uppercase">
                        {(user.discord_username ?? "?").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.discord_username ?? "Unknown"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <LocalDate iso={user.created_at} timezone={timezone} />
                </TableCell>
                <TableCell className="tabular-nums">{number(user.exported_count)}</TableCell>
                <TableCell className="tabular-nums">{number(user.draft_count)}</TableCell>
                <TableCell
                  className="tabular-nums"
                  title={user.shared_count > 0 ? `${user.share_downloads} download${user.share_downloads === 1 ? "" : "s"} through share links` : undefined}
                >
                  {number(user.shared_count)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.last_active ? <LocalDate iso={user.last_active} timezone={timezone} /> : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            {total} {total === 1 ? "user" : "users"}
            {q && " found"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={usersHref({ q, sort, dir, page: page - 1 })}>Previous</Link>
                </Button>
              )}
              {page < pages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={usersHref({ q, sort, dir, page: page + 1 })}>Next</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
