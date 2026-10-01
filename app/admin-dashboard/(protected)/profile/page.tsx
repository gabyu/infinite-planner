import { PageHeader } from "@/components/admin/page-header"
import { TimezoneForm } from "@/components/admin/timezone-form"
import { requireAdmin } from "@/lib/admin/auth"

export default async function ProfilePage() {
  const { user, profile } = await requireAdmin()

  return (
    <>
      <PageHeader title="Profile" description="Your admin account." />
      <div className="max-w-xl space-y-6">
        <section className="rounded-lg border bg-card p-5">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all font-medium">{user.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium capitalize">{profile.role}</dd>
          </dl>
        </section>
        <section className="rounded-lg border bg-card p-5">
          <TimezoneForm userId={user.id} timezone={profile.timezone} />
        </section>
      </div>
    </>
  )
}
