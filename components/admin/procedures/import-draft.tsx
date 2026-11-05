"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { ProcedureRow } from "@/lib/procedure-ingest"

// The procedures of an import that is being reviewed: read from the files, not saved yet. The import card (left column) edits
// them and the map (right column) draws them, so they live above both. Kept while the admin switches airport.
export interface PendingRow extends ProcedureRow {
  /** Client-side key. */
  id: string
  /** The file it came from. */
  file: string
  /** Part of the import (unticked rows are left out). */
  include: boolean
  /** After saving: what happened to it. */
  status?: "added" | "duplicate" | "error"
}

interface ImportDraft {
  pending: PendingRow[]
  setPending: (next: PendingRow[] | ((current: PendingRow[]) => PendingRow[])) => void
  hoverId: string | null
  setHoverId: (id: string | null) => void
}

const Context = createContext<ImportDraft>({ pending: [], setPending: () => {}, hoverId: null, setHoverId: () => {} })

export function ImportDraftProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRow[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)
  const value = useMemo(() => ({ pending, setPending, hoverId, setHoverId }), [pending, hoverId])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useImportDraft = () => useContext(Context)
