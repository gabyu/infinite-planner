import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { LocalDate } from "@/components/admin/local-date"
import { getSessionContext } from "@/lib/admin/auth"

const PAGE_SIZE = 25

interface UserRow {
  id: string
  discord_username: string | null
  avatar_url: string | null
  created_at: string
}

// Read-only list of Discord accounts. No actions in V1: there's nothing to manage yet.
export async function UsersSection({ page }: { page: number }) {
  const ctx = await getSessionContext()
  if (!ctx) return null

  const from = (page - 1) * PAGE_SIZE
  const { data, count, error } = await ctx.supabase
    .from("profiles")
    .select("id, discord_username, avatar_url, created_at", { count: "exact" })
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) {
    console.error("Loading users failed:", error.message)
    return <p className="text-sm text-muted-foreground">Couldn't load users right now.</p>
  }

  const users = (data ?? []) as UserRow[]
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Discord user</TableHead>
            <TableHead className="w-40">Signed up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                No one has signed in with Discord yet.
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
                <LocalDate iso={user.created_at} timezone={ctx.profile?.timezone ?? null} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <span>
          {total} {total === 1 ? "user" : "users"}
          {pages > 1 && ` · page ${page} of ${pages}`}
        </span>
        {pages > 1 && (
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin-dashboard/users?page=${page - 1}`}>Previous</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin-dashboard/users?page=${page + 1}`}>Next</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
