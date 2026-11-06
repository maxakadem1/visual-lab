import { cn } from "../ui/cn"

/** A 3×3 dither-style mark: on/off cells read as a tiny pixel filter. */
export function LogoMark({ className }: { className?: string }) {
  const cells = [1, 0, 1, 0, 1, 0, 1, 0, 0.45]

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 grid-cols-3 gap-[2px] rounded-[5px] bg-primary p-[3px] shadow-xs shadow-primary/24 inset-shadow-[0_1px_--theme(--color-white/16%)]",
        className,
      )}
    >
      {cells.map((opacity, index) => (
        <span
          key={index}
          className="rounded-[1px] bg-white"
          style={{ opacity: opacity || 0.18 }}
        />
      ))}
    </span>
  )
}
