import { AuthCard } from "@/components/admin/auth-card"
import { AdminLoginForm } from "@/components/admin/login-form"
import { SetPasswordForm } from "@/components/admin/set-password-form"
import { getSessionContext } from "@/lib/admin/auth"

// Dedicated first-login URL, sent along with the temporary credentials. The middleware
// only lets a signed-in admin with a pending password change reach the second step.
export default async function FirstLoginPage() {
  const ctx = await getSessionContext()

  if (ctx && ctx.profile?.role === "admin" && ctx.profile.must_change_password) {
    return (
      <AuthCard
        title="Choose your password"
        description={`Signed in as ${ctx.user.email}. Replace the temporary password to continue.`}
      >
        <SetPasswordForm />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Welcome"
      description="Sign in with the temporary email and password you were given. You'll choose your own next."
    >
      <AdminLoginForm submitLabel="Continue" />
    </AuthCard>
  )
}
