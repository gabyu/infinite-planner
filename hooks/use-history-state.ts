"use client"

import { useCallback, useRef, useState } from "react"

const MAX_HISTORY = 50

export interface HistoryControls {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

// Drop-in replacement for useState (same [state, setState] shape, including
// functional updater support) that also keeps an undo/redo stack. Every
// setState call becomes one undo step - coarse-grained, but that's exactly
// what "undo covers drawing actions and waypoint edits" needs, and it means
// existing setWaypoints(prev => ...) call sites don't need to change.
export function useHistoryState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void, HistoryControls] {
  const [state, setState] = useState<T>(initial)
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const [, forceRender] = useState(0)

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value
      if (next === prev) return prev

      pastRef.current.push(prev)
      if (pastRef.current.length > MAX_HISTORY) {
        pastRef.current.shift()
      }
      futureRef.current = []
      return next
    })
  }, [])

  const undo = useCallback(() => {
    setState((current) => {
      if (pastRef.current.length === 0) return current
      const previous = pastRef.current.pop() as T
      futureRef.current.push(current)
      return previous
    })
    forceRender((n) => n + 1)
  }, [])

  const redo = useCallback(() => {
    setState((current) => {
      if (futureRef.current.length === 0) return current
      const next = futureRef.current.pop() as T
      pastRef.current.push(current)
      return next
    })
    forceRender((n) => n + 1)
  }, [])

  return [
    state,
    set,
    {
      undo,
      redo,
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
    },
  ]
}
