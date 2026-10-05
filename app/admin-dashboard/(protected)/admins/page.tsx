import { AdminsSection } from "@/components/admin/admins-section"
import { CreateAdminDialog } from "@/components/admin/create-admin-dialog"
import { PageHeader } from "@/components/admin/page-header"
import { requireAdmin } from "@/lib/admin/auth"

export default async function AdminsPage() {
  await requireAdmin()

  return (
    <>
      <PageHeader title="Admins" description="Accounts that can sign in to this dashboard." actions={<CreateAdminDialog />} />
      <AdminsSection />
    </>
  )
}
