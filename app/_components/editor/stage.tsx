"use client"

import { useEffect, useRef, useState } from "react"
import {
  Columns2,
  Maximize,
  Pause,
  Play,
  Plus,
  Scan,
  Upload,
} from "lucide-react"

import { filterDefinitions } from "../../_lib/filter-registry"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Segmented, Separator, Shortcut, Slider } from "../ui/primitives"
import { Tooltip } from "../ui/tooltip"
import { formatTime, isEditableTarget } from "./format"
import type { MediaEditor } from "./use-media-editor"

export function Stage({
  editor,
  onOpenCommandMenu,
}: {
  editor: MediaEditor
  onOpenCommandMenu: () => void
}) {
  const { media, canvasRef, videoRef, video, actions, layers, canvasRenderMode } = editor
  const [isDragging, setIsDragging] = useState(false)
  const [viewMode, setViewMode] = useState<"fit" | "actual">("fit")
  const [comparing, setComparing] = useState(false)
  const dragDepth = useRef(0)

  // Hold "\" to peek at the untouched source.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "\\" && !isEditableTarget(event.target)) setComparing(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === "\\") setComparing(false)
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  const visibleCount = layers.filter((layer) => layer.visible).length
  const canCompare = media?.kind === "image" && visibleCount > 0

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        dragDepth.current += 1
        setIsDragging(true)
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setIsDragging(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return
        event.preventDefault()
        dragDepth.current = 0
        setIsDragging(false)
        actions.selectFile(event.dataTransfer.files[0])
      }}
    >
      <div
        className={cn(
          "surface-dots relative flex min-h-0 flex-1",
          viewMode === "actual" && media ? "overflow-auto" : "overflow-hidden",
        )}
      >
        {media ? (
          <div
            className={cn(
              "m-auto flex items-center justify-center p-6 pb-24 sm:p-10 sm:pb-28",
              viewMode === "fit" && "size-full",
            )}
          >
            <div
              className={cn(
                "relative animate-fade-in",
                viewMode === "fit" && "flex max-h-full max-w-full",
              )}
            >
              {media.kind === "video" && (
                <video
                  ref={videoRef}
                  src={media.url}
                  className="hidden"
                  playsInline
                  preload="metadata"
                  onEnded={() => {
                    actions.setVideoPlaying(false)
                    actions.syncVideoFrame()
                  }}
                  onLoadedData={actions.syncVideoFrame}
                  onLoadedMetadata={actions.syncVideoFrame}
                  onPause={() => actions.setVideoPlaying(false)}
                  onPlay={() => actions.setVideoPlaying(true)}
                  onSeeked={actions.syncVideoFrame}
                  onTimeUpdate={actions.syncVideoFrame}
                />
              )}
              <canvas
                key={canvasRenderMode}
                ref={canvasRef}
                aria-label={`${media.name} preview`}
                className={cn(
                  "block rounded-lg bg-black shadow-[0_24px_64px_-24px_rgb(0_0_0/55%)] ring-1 ring-border",
                  viewMode === "fit" && "max-h-full max-w-full object-contain",
                )}
              />
              {comparing && media.kind === "image" && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob URL source preview */}
                  <img
                    src={media.url}
                    alt="Original"
                    className="absolute inset-0 size-full rounded-lg object-contain"
                  />
                  <span className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-1 text-2xs font-medium text-white backdrop-blur">
                    Original
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <EmptyState onBrowse={actions.openFilePicker} />
        )}
      </div>

      {media && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-4 sm:px-5">
          <div className="glass pointer-events-auto relative flex w-full max-w-[46rem] animate-slide-up items-center gap-1.5 rounded-2xl border border-black/8 p-1.5 shadow-[0_1px_2px_rgb(0_0_0/5%)] dark:border-white/6 dark:shadow-[0_16px_40px_-18px_rgb(0_0_0/80%)] dark:inset-shadow-[0_1px_--theme(--color-white/3%)]">
            {media.kind === "video" ? (
              <>
                <Tooltip content={video.playing ? "Pause" : "Play"} shortcut="space">
                  <button
                    type="button"
                    aria-label={video.playing ? "Pause video" : "Play video"}
                    onClick={actions.toggleVideoPlayback}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-xs shadow-primary/24 inset-shadow-[0_1px_rgb(255_255_255/16%)] outline-none transition-all duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {video.playing ? (
                      <Pause className="size-3.5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 size-3.5 fill-current" />
                    )}
                  </button>
                </Tooltip>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {formatTime(video.time)}
                </span>
                <Slider
                  aria-label="Seek"
                  min={0}
                  max={video.duration || 0}
                  step={0.01}
                  value={Math.min(video.time, video.duration || video.time)}
                  onValueChange={actions.seekVideo}
                  className="mx-1 min-w-0 flex-1"
                />
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {formatTime(video.duration)}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenCommandMenu}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 text-left text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Plus className="size-4 shrink-0" />
                <span className="truncate">
                  {layers.length ? "Add another effect…" : "Add an effect…"}
                </span>
                <Shortcut keys="mod+k" className="ms-auto" />
              </button>
            )}

            <Separator orientation="vertical" className="mx-1 my-1.5" />

            {media.kind === "video" && (
              <Tooltip content="Add effect" shortcut="mod+k">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add effect"
                  onClick={onOpenCommandMenu}
                >
                  <Plus />
                </Button>
              </Tooltip>
            )}

            {media.kind === "image" && (
              <Tooltip content="Hold to compare with original" shortcut="\">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hold to compare with original"
                  disabled={!canCompare}
                  data-pressed={comparing}
                  onPointerDown={() => setComparing(true)}
                  onPointerUp={() => setComparing(false)}
                  onPointerLeave={() => setComparing(false)}
                >
                  <Columns2 />
                </Button>
              </Tooltip>
            )}

            <Segmented
              aria-label="Zoom"
              value={viewMode}
              onValueChange={setViewMode}
              className="hidden shrink-0 sm:flex"
              options={[
                {
                  value: "fit",
                  label: (
                    <>
                      <Maximize className="size-3" />
                      Fit
                    </>
                  ),
                },
                {
                  value: "actual",
                  label: (
                    <>
                      <Scan className="size-3" />
                      1:1
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}

      {isDragging && (
        <div className="pointer-events-none absolute inset-3 z-20 grid animate-fade-in place-items-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/6 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full bg-popover px-4 py-2 text-sm font-medium shadow-md/10">
            <Upload className="size-4 text-primary" />
            Drop to {media ? "replace" : "open"}
          </div>
        </div>
      )}
    </section>
  )
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="m-auto flex w-full max-w-md animate-slide-up flex-col items-center px-6 text-center">
      <div className="relative mb-6 grid size-14 place-items-center rounded-2xl border bg-card shadow-sm/5">
        <Upload className="size-5 text-muted-foreground" />
        <span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-background bg-primary" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight text-balance">
        Drop or paste an image to begin
      </h1>
      <p className="mt-1.5 text-sm text-balance text-muted-foreground">
        Stack pixel, dither, bloom and glitch effects in real time. Everything runs
        locally in your browser.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={onBrowse}>
          Browse files
          <Shortcut keys="mod+o" className="-me-1 [&_kbd]:bg-white/16 [&_kbd]:text-white/80" />
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          or paste <Shortcut keys="mod+v" />
        </span>
      </div>
      <div className="mt-10 flex max-w-sm flex-wrap justify-center gap-1.5">
        {filterDefinitions.map(({ type, label, icon: Icon }) => (
          <span
            key={type}
            className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 text-xs text-muted-foreground"
          >
            <Icon className="size-3" />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
