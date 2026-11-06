"use client"

import { BookmarkPlus, X } from "lucide-react"

import { filterDefinitionMap } from "../../_lib/filter-registry"
import {
  builtInPresets,
  presetSupportsVideo,
  type Preset,
} from "../../_lib/presets"
import { deleteCustomPreset } from "../../_lib/storage"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Badge } from "../ui/primitives"
import { Tooltip } from "../ui/tooltip"
import type { MediaEditor } from "./use-media-editor"
import { usePresetThumbnails } from "./use-preset-thumbnails"

export function PresetsPanel({
  editor,
  customPresets,
  onSavePreset,
}: {
  editor: MediaEditor
  customPresets: Preset[]
  onSavePreset: () => void
}) {
  const { media, layers, sourcePalette } = editor
  const allPresets = [...customPresets, ...builtInPresets]
  const thumbs = usePresetThumbnails(media, allPresets, sourcePalette)

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={!layers.length || !media}
        onClick={onSavePreset}
        className="w-full"
      >
        <BookmarkPlus />
        Save current look
      </Button>

      {customPresets.length > 0 && (
        <PresetGrid
          label="Yours"
          presets={customPresets}
          thumbs={thumbs}
          editor={editor}
          onDelete={deleteCustomPreset}
        />
      )}
      <PresetGrid
        label="Built-in"
        presets={builtInPresets}
        thumbs={thumbs}
        editor={editor}
      />

      {!media && (
        <p className="px-1 text-2xs text-balance text-muted-foreground">
          Open an image to preview presets on your own media.
        </p>
      )}
      {media?.kind === "video" && (
        <p className="px-1 text-2xs text-balance text-muted-foreground">
          Previews are image-only. Presets with image-only effects are disabled for video.
        </p>
      )}
    </div>
  )
}

function PresetGrid({
  label,
  presets,
  thumbs,
  editor,
  onDelete,
}: {
  label: string
  presets: Preset[]
  thumbs: Record<string, string>
  editor: MediaEditor
  onDelete?: (id: string) => void
}) {
  const { media, actions } = editor

  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-1 text-2xs font-medium text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => {
          const videoBlocked = media?.kind === "video" && !presetSupportsVideo(preset)
          const disabled = !media || videoBlocked
          const thumb = thumbs[preset.id]

          return (
            <div key={preset.id} className="group/preset relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => actions.applyPreset(preset)}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-lg p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  "hover:bg-sidebar-row-hover active:bg-sidebar-row-active disabled:pointer-events-none",
                  disabled && "opacity-50",
                )}
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-card shadow-xs/5 ring-1 ring-border">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- generated data URL
                    <img
                      src={thumb}
                      alt=""
                      className="size-full animate-fade-in object-cover transition-transform duration-300 group-hover/preset:scale-105"
                    />
                  ) : (
                    <PresetPlaceholder preset={preset} loading={media?.kind === "image"} />
                  )}
                  {videoBlocked && (
                    <Badge variant="secondary" className="absolute top-1 left-1 bg-black/60 text-white">
                      Image
                    </Badge>
                  )}
                </span>
                <span className="min-w-0 px-0.5">
                  <span className="block truncate text-xs font-medium">{preset.name}</span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {preset.description}
                  </span>
                </span>
              </button>
              {onDelete && (
                <Tooltip content="Delete preset">
                  <button
                    type="button"
                    aria-label={`Delete preset ${preset.name}`}
                    onClick={() => onDelete(preset.id)}
                    className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover/preset:opacity-100 hover:bg-black/80 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </Tooltip>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PresetPlaceholder({ preset, loading }: { preset: Preset; loading: boolean }) {
  const colors =
    preset.layers.find((layer) => layer.settings?.paletteColors)?.settings?.paletteColors ??
    ["#3f3f46", "#18181b"]

  return (
    <span
      className={cn("flex size-full items-center justify-center gap-1", loading && "animate-pulse")}
      style={{
        background: `linear-gradient(135deg, ${colors
          .slice(0, 4)
          .map((color, index, list) => `${color} ${(index / Math.max(1, list.length - 1)) * 100}%`)
          .join(", ")})`,
      }}
    >
      {preset.layers.slice(0, 3).map((layer, index) => {
        const Icon = filterDefinitionMap[layer.type].icon
        return (
          <span
            key={index}
            className="grid size-5 place-items-center rounded-md bg-black/40 text-white/90 backdrop-blur-sm"
          >
            <Icon className="size-3" />
          </span>
        )
      })}
    </span>
  )
}
