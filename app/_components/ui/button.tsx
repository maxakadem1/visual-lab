import type { ComponentProps } from "react"

import { cn } from "./cn"

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--control-radius)] border text-sm font-medium outline-none transition-[box-shadow,scale,background-color,color] duration-150 [&:active:not([aria-haspopup])]:scale-[0.97] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--control-radius)-1px)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [--icon:currentColor] [&_svg:not([class*='text-'])]:text-[var(--icon)]"

const variants = {
  default:
    "border-primary bg-primary text-primary-foreground shadow-xs shadow-primary/24 not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] active:inset-shadow-[0_1px_--theme(--color-black/8%)] hover:bg-primary/90",
  outline:
    "[--icon:var(--muted-foreground)] border-input bg-popover text-foreground shadow-xs/5 not-dark:bg-clip-padding before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)] active:before:shadow-none hover:bg-accent/50 dark:hover:bg-input/64",
  ghost:
    "[--icon:var(--muted-foreground)] border-transparent text-foreground hover:bg-accent hover:[--icon:var(--foreground)] data-[pressed=true]:bg-accent",
  muted:
    "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground data-[pressed=true]:bg-accent data-[pressed=true]:text-foreground",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive:
    "[--icon:var(--destructive-foreground)] border-transparent text-destructive-foreground hover:bg-destructive/8",
  glass:
    "glass rounded-full border-border/60 text-foreground shadow-sm before:rounded-full hover:border-border",
} as const

const sizes = {
  default: "h-8 px-[calc(--spacing(3)-1px)]",
  sm: "h-7 gap-1.5 px-[calc(--spacing(2.5)-1px)]",
  xs: "h-6 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-xs [&_svg:not([class*='size-'])]:size-3.5",
  lg: "h-9 px-[calc(--spacing(3.5)-1px)]",
  icon: "size-8",
  "icon-sm": "size-7",
  "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
} as const

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
}
