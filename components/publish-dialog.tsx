"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { legalCopy } from "@/lib/copy"

// THE publish dialog: one component, one set of strings, used by every place a plan can be published (the switch in
// the dashboard, the editor for Convert and Sketch). A plan that needs the declaration (origin Imported) gets the
// checkbox, empty each time the dialog opens and required before the button works; any other plan gets the same
// dialog without it. Closing (Not now, the X, Escape, a click outside) records nothing.
export function PublishDialog({
  open,
  needsDeclaration,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  needsDeclaration: boolean
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const [declared, setDeclared] = useState(false)
  // Never pre-ticked: reopening starts empty.
  useEffect(() => {
    if (open) setDeclared(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{legalCopy.declarationTitle}</DialogTitle>
          <DialogDescription>{legalCopy.declarationBody}</DialogDescription>
        </DialogHeader>
        {needsDeclaration && (
          // One label for the text; the link inside it opens the Terms in a new tab and does not tick the box.
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={declared}
              onChange={(event) => setDeclared(event.target.checked)}
              className="mt-0.5 accent-[hsl(var(--primary))]"
            />
            <span>
              {legalCopy.declarationCheckbox}{" "}
              <a
                href="/terms#your-content"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="font-medium underline underline-offset-2"
              >
                {legalCopy.declarationTermsLink}
              </a>
              .
            </span>
          </label>
        )}
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {legalCopy.declarationCancel}
          </Button>
          <Button onClick={onConfirm} disabled={busy || (needsDeclaration && !declared)}>
            {legalCopy.declarationConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
