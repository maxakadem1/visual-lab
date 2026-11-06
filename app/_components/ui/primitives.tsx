"use client"

import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react"

import { cn } from "./cn"

/* ---------------------------------- Kbd ---------------------------------- */

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded bg-foreground/[0.07] px-1 font-sans text-2xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

/** Renders a shortcut like "mod+k" as platform-aware key caps. */
export function Shortcut({ keys, className }: { keys: string; className?: string }) {
  const isMac = useIsMac()

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.split("+").map((key) => (
        <Kbd key={key}>{formatKey(key, isMac)}</Kbd>
      ))}
    </span>
  )
}

const formatKey = (key: string, isMac: boolean) => {
  switch (key) {
    case "mod":
      return isMac ? "⌘" : "Ctrl"
    case "shift":
      return isMac ? "⇧" : "Shift"
    case "alt":
      return isMac ? "⌥" : "Alt"
    case "space":
      return "Space"
    case "del":
      return isMac ? "⌫" : "Del"
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

const noopSubscribe = () => () => {}

export function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  )
}

/* --------------------------------- Badge --------------------------------- */

const badgeVariants = {
  outline: "border-input bg-background text-foreground dark:bg-input/32",
  secondary: "bg-secondary text-muted-foreground",
  primary: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-[oklch(0.75_0.12_264)]",
  success: "bg-success/8 text-success-foreground dark:bg-success/16",
  warning: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
} as const

export function Badge({
  className,
  variant = "secondary",
  ...props
}: ComponentProps<"span"> & { variant?: keyof typeof badgeVariants }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent px-[calc(--spacing(1)-1px)] text-2xs font-medium [&_svg:not([class*='size-'])]:size-3",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------- Switch --------------------------------- */

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange"> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-checked={checked || undefined}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group/switch inline-flex h-[calc(var(--thumb)+2px)] w-[calc(var(--thumb)*2-2px)] shrink-0 items-center rounded-full p-[2px] outline-none transition-[background-color,box-shadow] duration-200 [--thumb:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-64",
        checked ? "bg-primary" : "bg-input",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block size-[calc(var(--thumb)-2px)] rounded-full shadow-sm/5 transition-[translate,background-color] duration-150",
          checked
            ? "translate-x-[calc(var(--thumb)-4px)] bg-white"
            : "bg-background dark:bg-muted-foreground",
        )}
      />
    </button>
  )
}

/* ------------------------------- Segmented ------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<"div">, "onChange"> & {
  value: T
  options: { value: T; label: ReactNode }[]
  onValueChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      className={cn("flex w-fit gap-0.5 rounded-lg bg-input/40 p-0.5", className)}
      {...props}
    >
      {options.map((option) => {
        const pressed = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={pressed}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex h-6 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              pressed
                ? "bg-background text-foreground shadow-xs/10 dark:bg-input/72"
                : "text-muted-foreground hover:bg-background/55 hover:text-foreground dark:hover:bg-input/32",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------- Slider --------------------------------- */

export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  className,
  style,
  ...props
}: Omit<ComponentProps<"input">, "onChange" | "value" | "type"> & {
  value: number
  min: number
  max: number
  step?: number
  onValueChange: (value: number) => void
}) {
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value))}
      className={cn("vl-slider", className)}
      style={{ ...style, ["--progress" as string]: `${progress}%` }}
      {...props}
    />
  )
}

/* --------------------------------- Input --------------------------------- */

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <span
      className={cn(
        "relative inline-flex w-full rounded-lg border border-input bg-background text-sm text-foreground shadow-xs/5 ring-ring/24 transition-shadow not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:before:shadow-none dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
    >
      <input
        className="h-7.5 w-full min-w-0 rounded-[inherit] bg-transparent px-[calc(--spacing(3)-1px)] leading-7.5 outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </span>
  )
}

/* ------------------------------- Separator ------------------------------- */

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical"
  className?: string
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className,
      )}
    />
  )
}
