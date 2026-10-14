import { LibraryLaunchCard } from "@/components/admin/library-launch-card"
import { PageHeader } from "@/components/admin/page-header"
import { getSessionContext, requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"

interface LibrarySettings {
  launched: boolean
  launched_at: string | null
  target: number
  public_plans: number
}

export default async function SettingsPage() {
  await requireAdmin()
  const ctx = await getSessionContext()
  if (!ctx) return null

  const { data } = await ctx.supabase.rpc("admin_get_library_settings")
  const settings = data as LibrarySettings | null

  return (
    <>
      <PageHeader title="Settings" description="Switches that change what visitors see." />
      {settings ? (
        <LibraryLaunchCard
          launched={settings.launched}
          launchedAt={settings.launched_at}
          target={settings.target}
          publicPlans={Number(settings.public_plans)}
          timezone={ctx.profile?.timezone ?? null}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Couldn't load the settings right now.</p>
      )}
    </>
  )
}
