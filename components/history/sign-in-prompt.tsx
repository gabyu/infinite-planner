"use client"

import { Button } from "@/components/ui/button"
import { DiscordIcon } from "@/components/discord-icon"
import { signInWithDiscord } from "@/hooks/use-auth-user"

// Shown on /history and similar pages when nobody is signed in.
export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-16 text-center">
      <h2 className="text-sm font-medium">Sign in to continue</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button onClick={signInWithDiscord} className="mt-5 gap-2">
        <DiscordIcon className="h-4 w-4" />
        Sign in with Discord
      </Button>
    </div>
  )
}
