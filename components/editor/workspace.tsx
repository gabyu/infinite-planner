"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

interface EditorWorkspaceProps {
  map: React.ReactNode
  /** Under the map, full width (the altitude strip). Desktop only. */
  strip?: React.ReactNode
  header: React.ReactNode
  /** The scrolling part of the panel: details, waypoint list, controls. */
  body: React.ReactNode
  /** Always visible at the bottom of the panel (the Export button). */
  footer: React.ReactNode
  isMobile: boolean
}

// Snap heights: the peek is measured (handle + header + Export button), half and full are shares of the map area.
const SNAPS = [0, 0.5, 0.88] as const

// The editor screen: below the site header, a workspace that fills the viewport. The map fills it; the panel
// floats over the left of the map (collapsible) on desktop, and is a bottom sheet with three snap points
// (peek / half / full) on a phone. The Export button stays visible in both.
export function EditorWorkspace({ map, strip, header, body, footer, isMobile }: EditorWorkspaceProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Fill whatever is left of the viewport under the site header.
  useLayoutEffect(() => {
    const measure = () => {
      // Distance from the top of the page to the workspace (the site header), whatever the scroll position.
      const pageTop = (rootRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY
      setHeight(Math.max(480, window.innerHeight - pageTop))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  return (
    <div
      ref={rootRef}
      className="ip-map relative flex flex-col overflow-hidden border-y bg-muted"
      style={{ height: height ?? "calc(100dvh - 4.5rem)" }}
    >
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">{map}</div>
        {isMobile ? (
          <BottomSheet header={header} body={body} footer={footer} />
        ) : (
          <>
            <aside
              className={cn(
                "absolute bottom-4 left-4 top-4 z-[1000] flex w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden",
                "rounded-2xl border bg-card/95 shadow-xl backdrop-blur-md transition-transform duration-200 ease-out",
                "motion-reduce:transition-none",
                collapsed && "-translate-x-[calc(100%+1rem)]",
              )}
              aria-hidden={collapsed}
            >
              <div className="shrink-0 border-b">{header}</div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{body}</div>
              <div className="shrink-0 border-t bg-card">{footer}</div>
            </aside>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? copy.editor.panelExpand : copy.editor.panelCollapse}
              title={collapsed ? copy.editor.panelExpand : copy.editor.panelCollapse}
              className={cn(
                "absolute top-[28px] z-[1001] flex h-8 w-8 items-center justify-center rounded-full border bg-card text-foreground",
                "shadow-md transition-[left] duration-200 ease-out hover:bg-accent motion-reduce:transition-none",
                collapsed ? "left-4" : "left-[328px]",
              )}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>
      {!isMobile && strip}
    </div>
  )
}

// Phone: the panel as a sheet over the bottom of the map. Drag the handle (or tap it) to move between snaps.
function BottomSheet({
  header,
  body,
  footer,
}: {
  header: React.ReactNode
  body: React.ReactNode
  footer: React.ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [snap, setSnap] = useState(0)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [containerHeight, setContainerHeight] = useState(600)
  const [peekHeight, setPeekHeight] = useState(220)
  const handleRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  useEffect(() => {
    const parent = sheetRef.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => setContainerHeight(parent.clientHeight))
    observer.observe(parent)
    setContainerHeight(parent.clientHeight)
    return () => observer.disconnect()
  }, [])

  // The peek shows everything that is not the scrolling body: handle, header, footer.
  useEffect(() => {
    const parts = [handleRef.current, headerRef.current, footerRef.current].filter(Boolean) as HTMLElement[]
    const measure = () => setPeekHeight(Math.ceil(parts.reduce((sum, el) => sum + el.offsetHeight, 0)))
    const observer = new ResizeObserver(measure)
    parts.forEach((el) => observer.observe(el))
    measure()
    return () => observer.disconnect()
  }, [])

  const snapHeights = SNAPS.map((s) => (s === 0 ? peekHeight : Math.round(containerHeight * s)))
  const currentHeight = dragHeight ?? snapHeights[snap]

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startHeight: snapHeights[snap], moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const delta = drag.startY - e.clientY
    if (Math.abs(delta) > 4) drag.moved = true
    setDragHeight(Math.min(snapHeights[2], Math.max(snapHeights[0], drag.startHeight + delta)))
  }
  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (!drag.moved) {
      setSnap((value) => (value + 1) % SNAPS.length)
    } else if (dragHeight !== null) {
      let nearest = 0
      snapHeights.forEach((h, index) => {
        if (Math.abs(h - dragHeight) < Math.abs(snapHeights[nearest] - dragHeight)) nearest = index
      })
      setSnap(nearest)
    }
    setDragHeight(null)
  }

  return (
    <div
      ref={sheetRef}
      className={cn(
        "absolute inset-x-0 bottom-0 z-[1000] flex flex-col overflow-hidden rounded-t-3xl border-x border-t bg-card shadow-2xl",
        dragHeight === null && "transition-[height] duration-200 ease-out motion-reduce:transition-none",
      )}
      style={{ height: currentHeight }}
    >
      <div
        ref={handleRef}
        role="button"
        tabIndex={0}
        aria-label={copy.editor.sheetHandle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setSnap((value) => (value + 1) % SNAPS.length)
        }}
        className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
      </div>
      <div ref={headerRef} className="shrink-0">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-t">{body}</div>
      <div ref={footerRef} className="shrink-0 border-t bg-card">{footer}</div>
    </div>
  )
}
