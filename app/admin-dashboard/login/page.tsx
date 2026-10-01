import { AuthCard } from "@/components/admin/auth-card"
import { AdminLoginForm } from "@/components/admin/login-form"

export default function AdminLoginPage() {
  return (
    <AuthCard title="Sign in" description="Admin dashboard. Use the email and password of your admin account.">
      <AdminLoginForm />
    </AuthCard>
  )
}
