"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { Shortcut } from "./primitives"

type Side = "top" | "bottom" | "left" | "right"

// Shared warm-up so moving between adjacent triggers opens instantly.
let lastClosedAt = 0

export function Tooltip({
  content,
  shortcut,
  side = "top",
  children,
}: {
  content: ReactNode
  shortcut?: string
  side?: Side
  children: ReactNode
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>(0)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  const show = () => {
    window.clearTimeout(timerRef.current)
    const warm = performance.now() - lastClosedAt < 400
    timerRef.current = window.setTimeout(() => setOpen(true), warm ? 0 : 450)
  }

  const hide = () => {
    window.clearTimeout(timerRef.current)
    if (open) {
      lastClosedAt = performance.now()
    }
    setOpen(false)
    setPosition(null)
  }

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popupRef.current) {
      return
    }

    const target = triggerRef.current.firstElementChild ?? triggerRef.current
    const rect = target.getBoundingClientRect()
    const popup = popupRef.current.getBoundingClientRect()
    const gap = 6
    let x = rect.left + rect.width / 2 - popup.width / 2
    let y = rect.top - popup.height - gap

    if (side === "bottom") y = rect.bottom + gap
    if (side === "left") {
      x = rect.left - popup.width - gap
      y = rect.top + rect.height / 2 - popup.height / 2
    }
    if (side === "right") {
      x = rect.right + gap
      y = rect.top + rect.height / 2 - popup.height / 2
    }

    x = Math.max(8, Math.min(x, window.innerWidth - popup.width - 8))
    y = Math.max(8, Math.min(y, window.innerHeight - popup.height - 8))
    setPosition({ x, y })
  }, [open, side])

  return (
    <>
      <span
        ref={triggerRef}
        className="contents"
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            className="pointer-events-none fixed z-[100] flex max-w-80 animate-pop-in items-center gap-2 rounded-md border bg-popover px-2 py-1 text-xs leading-snug text-popover-foreground shadow-md/5 not-dark:bg-clip-padding"
            style={{
              left: position?.x ?? -9999,
              top: position?.y ?? -9999,
              visibility: position ? "visible" : "hidden",
            }}
          >
            <span>{content}</span>
            {shortcut && <Shortcut keys={shortcut} className="-me-1" />}
          </div>,
          document.body,
        )}
    </>
  )
}
