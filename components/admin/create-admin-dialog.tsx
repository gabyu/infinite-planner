"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Credentials {
  email: string
  password: string
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard blocked: the value is selectable on screen, so nothing else to do.
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  )
}

// Creates an admin through the server route. The generated password appears here once,
// to be relayed by hand; it isn't stored anywhere and nothing is sent automatically.
export function CreateAdminDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const firstLoginUrl = typeof window === "undefined" ? "" : `${window.location.origin}/admin-dashboard/first-login`

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Closing wipes the password from memory and refreshes the list.
      if (credentials) router.refresh()
      setCredentials(null)
      setEmail("")
      setError(null)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.")
      } else {
        setCredentials({ email: body.email, password: body.password })
      }
    } catch {
      setError("Couldn't reach the server. Try again.")
    }
    setPending(false)
  }

  const message = credentials
    ? [
        "Infinite Planner admin access",
        `First login: ${firstLoginUrl}`,
        `Email: ${credentials.email}`,
        `Temporary password: ${credentials.password}`,
        "You'll be asked to choose your own password right away.",
      ].join("\n")
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Create admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle>Admin created</DialogTitle>
              <DialogDescription>
                Copy these now and send them to the new admin yourself. The password is shown only once and can't be
                retrieved later. If it's lost, reset it from the Supabase dashboard.
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">First-login link</dt>
                <dd className="break-all font-mono">{firstLoginUrl}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="break-all font-mono">{credentials.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Temporary password</dt>
                <dd className="break-all rounded-md border bg-muted px-2 py-1.5 font-mono select-all">
                  {credentials.password}
                </dd>
              </div>
            </dl>
            <DialogFooter className="gap-2 sm:gap-2">
              <CopyButton text={credentials.password} label="Copy password" />
              <CopyButton text={message} label="Copy full message" />
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Create an admin</DialogTitle>
              <DialogDescription>
                A secure password is generated for the account. Nothing is emailed: you'll get the credentials on
                screen to pass along yourself.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-email">Email</Label>
              <Input
                id="new-admin-email"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Create admin
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
