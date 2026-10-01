import { UsersSection } from "@/components/admin/users-section"
import { PageHeader } from "@/components/admin/page-header"
import { requireAdmin } from "@/lib/admin/auth"

export default async function UsersPage({ searchParams }: { searchParams: { page?: string } }) {
  await requireAdmin()
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  return (
    <>
      <PageHeader title="Users" description="People who signed in with Discord." />
      <UsersSection page={page} />
    </>
  )
}
