"use client"

import { useEffect, useRef, useState } from "react"
import { AudioLines, Film, Mic, Power, WandSparkles } from "lucide-react"

import type { AudioLevels } from "../../_lib/audio-reactive"
import type { AudioBand } from "../../_types/editor"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Tooltip } from "../ui/tooltip"
import type { MediaEditor } from "./use-media-editor"

const meterBands: { key: keyof AudioLevels; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "mid", label: "Mid" },
  { key: "high", label: "High" },
  { key: "beat", label: "Beat" },
]

/** Toolbar toggle that opens the audio-reactive controls. */
export function AudioButton({ editor }: { editor: MediaEditor }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = editor.audioSource !== "off"

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <Tooltip content={active ? "Audio reactive: on" : "Audio reactive"}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Audio reactive"
          aria-expanded={open}
          data-pressed={open || active}
          onClick={() => setOpen((current) => !current)}
          className={cn(active && "text-primary [--icon:var(--primary)]")}
        >
          <AudioLines />
          {active && (
            <span className="absolute top-1.5 right-1.5 size-1.5 animate-pulse rounded-full bg-primary" />
          )}
        </Button>
      </Tooltip>
      {open && <AudioPopover editor={editor} />}
    </div>
  )
}

function AudioPopover({ editor }: { editor: MediaEditor }) {
  const { audioSource, media, layers, actions } = editor
  const isVideo = media?.kind === "video"
  const sources = [
    { value: "off", label: "Off", icon: Power, disabled: false },
    { value: "media", label: "Soundtrack", icon: Film, disabled: !isVideo },
    { value: "mic", label: "Mic", icon: Mic, disabled: false },
  ] as const

  return (
    <div className="dropdown-glass absolute right-0 bottom-full z-30 mb-3 flex w-72 animate-pop-in flex-col gap-3 rounded-xl p-3 shadow-[0_24px_64px_-24px_rgb(0_0_0/65%)]">
      <div>
        <div className="text-sm font-semibold">Audio reactive</div>
        <p className="mt-0.5 text-xs text-balance text-muted-foreground">
          Sound pushes each layer&apos;s settings. Pick a band per layer in the inspector.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-input/40 p-0.5" role="radiogroup">
        {sources.map(({ value, label, icon: Icon, disabled }) => {
          const pressed = audioSource === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={pressed}
              disabled={disabled}
              title={disabled ? "Open a video to use its soundtrack" : undefined}
              onClick={() => void actions.startAudio(value)}
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
                pressed
                  ? "bg-background text-foreground shadow-xs/10 dark:bg-input/72"
                  : "text-muted-foreground hover:bg-background/55 hover:text-foreground dark:hover:bg-input/32",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          )
        })}
      </div>

      <LevelMeters editor={editor} />

      <Button
        variant="outline"
        size="sm"
        disabled={!layers.length}
        onClick={actions.autoMapAllAudio}
      >
        <WandSparkles />
        Make every layer react
      </Button>
      <p className="-mt-1 text-2xs text-balance text-muted-foreground">
        {isVideo
          ? "Video exports react to their own soundtrack (or the live mic)."
          : "Works on stills too: play music near your mic."}
      </p>
    </div>
  )
}

/** Live band levels, drawn straight to the DOM to avoid re-rendering React. */
export function LevelMeters({
  editor,
  highlight,
  compact = false,
}: {
  editor: MediaEditor
  highlight?: AudioBand
  compact?: boolean
}) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([])
  const { getAudioLevels, audioSource } = editor

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const levels = getAudioLevels()
      meterBands.forEach((band, index) => {
        const bar = barsRef.current[index]
        if (bar) bar.style.transform = `scaleX(${levels[band.key].toFixed(3)})`
      })
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [getAudioLevels])

  const bands = highlight && compact ? meterBands.filter((band) => band.key === highlight) : meterBands

  return (
    <div className={cn("flex flex-col gap-1.5", audioSource === "off" && "opacity-50")}>
      {bands.map((band) => {
        const index = meterBands.indexOf(band)
        return (
          <div key={band.key} className="flex items-center gap-2">
            {!compact && (
              <span className="w-8 text-2xs text-muted-foreground">{band.label}</span>
            )}
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-input/60">
              <span
                ref={(node) => {
                  barsRef.current[index] = node
                }}
                className={cn(
                  "absolute inset-0 origin-left scale-x-0 rounded-full",
                  highlight === band.key || !highlight ? "bg-primary" : "bg-muted-foreground/50",
                )}
              />
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Inspector shortcut for turning listening on from a layer. */
export function ListenHint({ editor }: { editor: MediaEditor }) {
  const isVideo = editor.media?.kind === "video"
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-2xs text-muted-foreground">Not listening yet</span>
      <div className="flex gap-1">
        {isVideo && (
          <Tooltip content="React to the video's soundtrack">
            <Button variant="outline" size="xs" onClick={() => void editor.actions.startAudio("media")}>
              <Film />
              Soundtrack
            </Button>
          </Tooltip>
        )}
        <Tooltip content="React to your microphone">
          <Button variant="outline" size="xs" onClick={() => void editor.actions.startAudio("mic")}>
            <Mic />
            Mic
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
