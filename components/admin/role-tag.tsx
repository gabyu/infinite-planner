import { Badge } from "@/components/ui/badge"

// Marks the top of the role ladder (public < Discord account < contributor < admin) in the admin lists.
// A plain Discord account gets no tag.
export function RoleTag({ role }: { role: string }) {
  if (role === "admin") return <Badge>Admin</Badge>
  if (role === "contributor") return <Badge variant="secondary">Contributor</Badge>
  return null
}
