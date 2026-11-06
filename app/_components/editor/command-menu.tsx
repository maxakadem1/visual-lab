"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { CornerDownLeft, Search } from "lucide-react"

import { cn } from "../ui/cn"
import { Badge, Kbd, Shortcut } from "../ui/primitives"

export type CommandItem = {
  id: string
  group: string
  label: string
  description?: string
  icon: ReactNode
  shortcut?: string
  badge?: string
  disabled?: boolean
  keywords?: string
  run: () => void
}

export function CommandMenu({
  open,
  onOpenChange,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandItem[]
}) {
  if (!open) return null

  return createPortal(
    <CommandMenuDialog items={items} onClose={() => onOpenChange(false)} />,
    document.body,
  )
}

function CommandMenuDialog({
  items,
  onClose,
}: {
  items: CommandItem[]
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const enabled = items.filter((item) => !item.disabled)
    if (!q) return enabled

    // Label hits outrank keyword hits, which outrank description hits.
    const score = (item: CommandItem) => {
      const label = item.label.toLowerCase()
      if (label.startsWith(q)) return 4
      if (label.split(/\s+/).some((word) => word.startsWith(q))) return 3
      if (label.includes(q)) return 2
      if (`${item.keywords ?? ""} ${item.group}`.toLowerCase().includes(q)) return 1
      if ((item.description ?? "").toLowerCase().includes(q)) return 0.5
      return 0
    }

    return enabled
      .map((item) => ({ item, score: score(item) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item)
  }, [items, query])

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    filtered.forEach((item) => map.set(item.group, [...(map.get(item.group) ?? []), item]))
    return [...map.entries()]
  }, [filtered])

  // Keyboard order must follow the grouped visual order.
  const ordered = useMemo(() => groups.flatMap(([, groupItems]) => groupItems), [groups])

  const clampedIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1))

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${clampedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [clampedIndex])

  const run = (item?: CommandItem) => {
    if (!item) return
    onClose()
    item.run()
  }

  let flatIndex = -1

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
      <div
        className="absolute inset-0 animate-fade-in bg-background/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="dropdown-glass relative flex max-h-[min(30rem,70vh)] w-full max-w-[34rem] animate-pop-in flex-col overflow-hidden rounded-xl shadow-[0_24px_64px_-24px_rgb(0_0_0/65%)] dark:shadow-[0_24px_64px_-24px_rgb(0_0_0/65%),inset_0_1px_rgb(255_255_255/4%)]"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            onClose()
          } else if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((clampedIndex + 1) % Math.max(1, filtered.length))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex(
              (clampedIndex - 1 + filtered.length) % Math.max(1, filtered.length),
            )
          } else if (event.key === "Enter") {
            event.preventDefault()
            run(ordered[clampedIndex])
          }
        }}
      >
        <div className="flex items-center gap-2.5 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder="Add an effect or run a command…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search commands"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </div>
          )}
          {groups.map(([group, groupItems]) => (
            <div key={group} className="pb-1">
              <div className="px-2.5 pt-2 pb-1 text-2xs font-medium text-muted-foreground">
                {group}
              </div>
              {groupItems.map((item) => {
                flatIndex += 1
                const index = flatIndex
                const active = index === clampedIndex

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-index={index}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => run(item)}
                    className={cn(
                      "flex min-h-9 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm outline-none",
                      active ? "bg-accent text-accent-foreground dark:bg-white/6" : "text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground shadow-xs/5 [&_svg]:size-3.5",
                        active && "text-foreground",
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
                    {item.shortcut && <Shortcut keys={item.shortcut} />}
                    {active && !item.shortcut && (
                      <CornerDownLeft className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t px-4 py-2 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> select
          </span>
          <span className="ms-auto flex items-center gap-1.5">
            <Shortcut keys="mod+k" /> toggle
          </span>
        </div>
      </div>
    </div>
  )
}
