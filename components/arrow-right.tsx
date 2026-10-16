import { ArrowRight as LucideArrowRight } from "lucide-react"
import type { ComponentProps } from "react"

// The site's right arrow: lucide's, but with flat line ends and sharp corners instead of rounded ones.
export function ArrowRight(props: ComponentProps<typeof LucideArrowRight>) {
  return <LucideArrowRight strokeLinecap="butt" strokeLinejoin="miter" {...props} />
}
