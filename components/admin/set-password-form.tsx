"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MIN_LENGTH = 12

// Step 2 of the first login: replace the temporary password. Goes through the server
// route, which changes the password and clears must_change_password in one go.
export function SetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
    if (password !== confirm) return setError("The two passwords don't match.")

    setPending(true)
    try {
      const res = await fetch("/api/admin/first-login/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.")
        setPending(false)
        return
      }
      window.location.assign("/admin-dashboard")
    } catch {
      setError("Couldn't reach the server. Try again.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters. A passphrase works well.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Set password and continue
      </Button>
    </form>
  )
}
