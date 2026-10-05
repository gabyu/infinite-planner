import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LocalDate } from "@/components/admin/local-date"
import { getSessionContext } from "@/lib/admin/auth"

interface AdminRow {
  id: string
  email: string
  created_at: string
  must_change_password: boolean
}

// Admin list: emails live in auth.users, so they come from an admin-only SQL function.
export async function AdminsSection() {
  const ctx = await getSessionContext()
  if (!ctx) return null

  const { data, error } = await ctx.supabase.rpc("admin_list_admins")
  if (error) {
    console.error("Loading admins failed:", error.message)
    return <p className="text-sm text-muted-foreground">Couldn't load admins right now.</p>
  }

  const admins = (data ?? []) as AdminRow[]

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-40">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => (
            <TableRow key={admin.id}>
              <TableCell className="font-medium">
                {admin.email}
                {admin.id === ctx.user.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
              </TableCell>
              <TableCell>
                {admin.must_change_password ? (
                  <Badge variant="secondary">Awaiting first login</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <LocalDate iso={admin.created_at} timezone={ctx.profile?.timezone ?? null} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {admins.length} {admins.length === 1 ? "admin" : "admins"}
      </div>
    </div>
  )
}
