"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CircleAlert, CircleCheck } from "lucide-react"

import { cn } from "./cn"

export type Toast = {
  id: number
  message: string
  tone: "default" | "error"
  action?: { label: string; run: () => void }
}

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] }

export function useToaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((toast: ToastInput) => {
    idRef.current += 1
    const next: Toast = { tone: "default", ...toast, id: idRef.current }
    setToasts((current) => [...current.slice(-2), next])
  }, [])

  return { toasts, push, dismiss }
}

export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(var(--topbar-height)+0.75rem)] left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: number) => void
}) {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (hovered) return
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.action ? 5000 : 2800)
    return () => window.clearTimeout(timeout)
  }, [hovered, onDismiss, toast.action, toast.id])

  const Icon = toast.tone === "error" ? CircleAlert : CircleCheck

  return (
    <div
      role="status"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "dropdown-glass pointer-events-auto flex min-h-10 max-w-full animate-pop-in items-center gap-2.5 rounded-xl py-1.5 pl-3 text-sm shadow-[0_16px_40px_-18px_rgb(0_0_0/55%)] dark:shadow-[0_18px_44px_-18px_rgb(0_0_0/80%)]",
        toast.action ? "pr-1.5" : "pr-4",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          toast.tone === "error" ? "text-destructive-foreground" : "text-success-foreground",
        )}
      />
      <span className="min-w-0 flex-1 py-1 text-pretty">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run()
            onDismiss(toast.id)
          }}
          className="h-7 shrink-0 rounded-md px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent dark:hover:bg-white/8"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
