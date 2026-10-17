"use client"

import Link from "next/link"
import { useAuthUser } from "@/hooks/use-auth-user"

// The author's name: a plain name for anonymous visitors, a link to their profile once signed in (profiles are
// for signed-in users only). Starts as plain text on the server so the cached page is the same for everyone.
export function AuthorLink({ name, profilePublicId }: { name: string; profilePublicId: string }) {
  const { user } = useAuthUser()
  if (!user) return <span>{name}</span>
  return (
    <Link href={`/pilots/${profilePublicId}`} className="link-quiet">
      {name}
    </Link>
  )
}
