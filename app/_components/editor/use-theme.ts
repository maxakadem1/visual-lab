"use client"

import { useCallback, useSyncExternalStore } from "react"

type Theme = "dark" | "light"

const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light"

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "dark" as Theme)

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark"

    document.documentElement.classList.toggle("dark", next === "dark")
    try {
      localStorage.setItem("vl-theme", next)
    } catch {}
    listeners.forEach((listener) => listener())
  }, [])

  return { theme, toggleTheme }
}
