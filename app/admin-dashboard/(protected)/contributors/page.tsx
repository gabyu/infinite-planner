import { ContributorSearch } from "@/components/admin/contributor-search"
import { LibraryActionButton } from "@/components/admin/library-actions"
import { LocalDate } from "@/components/admin/local-date"
import { PageHeader } from "@/components/admin/page-header"
import { RoleTag } from "@/components/admin/role-tag"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSessionContext, requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"

interface ContributorRow {
  id: string
  discord_username: string | null
  avatar_url: string | null
  role: string
  contributor_since: string | null
  published_count: number
  downloads_received: number
  likes_received: number
}

export default async function ContributorsPage() {
  await requireAdmin()
  const ctx = await getSessionContext()
  if (!ctx) return null
  const timezone = ctx.profile?.timezone ?? null

  const { data, error } = await ctx.supabase.rpc("admin_list_contributors")
  if (error) console.error("Loading contributors failed:", error.message)
  const contributors = (data ?? []) as ContributorRow[]

  return (
    <>
      <PageHeader
        title="Contributors"
        description="Discord members raised to publish flight plans during the soft launch. They keep the badge after the launch. Admins are contributors by default."
      />

      <section aria-labelledby="add" className="mb-8">
        <h2 id="add" className="mb-3 text-sm font-semibold">
          Add a contributor
        </h2>
        <ContributorSearch />
      </section>

      <section aria-labelledby="list">
        <h2 id="list" className="mb-3 text-sm font-semibold">
          Contributors ({contributors.length})
        </h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discord user</TableHead>
                <TableHead className="w-32">Since</TableHead>
                <TableHead className="w-28">Published</TableHead>
                <TableHead className="w-28">Downloads</TableHead>
                <TableHead className="w-24">Likes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {error ? "Couldn't load the contributors right now." : "No contributor yet."}
                  </TableCell>
                </TableRow>
              )}
              {contributors.map((contributor) => (
                <TableRow key={contributor.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        {contributor.avatar_url && <AvatarImage src={contributor.avatar_url} alt="" referrerPolicy="no-referrer" />}
                        <AvatarFallback className="text-[10px] uppercase">{(contributor.discord_username ?? "?").slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{contributor.discord_username ?? "Unknown"}</span>
                      <RoleTag role={contributor.role} />
                    </div>
                  </TableCell>
                  <TableCell>{contributor.contributor_since ? <LocalDate iso={contributor.contributor_since} timezone={timezone} /> : "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{Number(contributor.published_count)}</TableCell>
                  <TableCell className="font-mono text-sm">{Number(contributor.downloads_received)}</TableCell>
                  <TableCell className="font-mono text-sm">{Number(contributor.likes_received)}</TableCell>
                  <TableCell className="text-right">
                    {contributor.role === "contributor" ? (
                      <LibraryActionButton
                        variant="ghost"
                        action={{ action: "contributor", userId: contributor.id, contributor: false }}
                        confirm={`Demote ${contributor.discord_username ?? "this account"} back to a regular member? Their published plans stay as they are, but before the launch they lose access to the library.`}
                      >
                        Demote
                      </LibraryActionButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">Always, as an admin</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  )
}
