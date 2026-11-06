"use client"

import { useEffect, useState } from "react"

import { drawFilteredImage } from "../../_lib/image-filters"
import { instantiatePreset, type Preset } from "../../_lib/presets"
import type { EditorMedia } from "../../_types/editor"

const thumbnailEdge = 180

/**
 * Renders each preset onto a small copy of the current image so the
 * presets panel previews the real result. Runs one preset per task to keep
 * the main thread responsive.
 */
export function usePresetThumbnails(
  media: EditorMedia | null,
  presets: Preset[],
  sourcePalette: string[],
) {
  const [state, setState] = useState<{ key: string; thumbs: Record<string, string> }>({
    key: "",
    thumbs: {},
  })
  const presetKey = presets.map((preset) => preset.id).join("|")
  const key = media?.kind === "image" ? `${media.url}::${presetKey}::${sourcePalette.join()}` : ""

  useEffect(() => {
    if (!key || !media) return

    let cancelled = false
    let timeout = 0
    const image = new window.Image()

    image.onload = () => {
      const longEdge = Math.max(image.naturalWidth, image.naturalHeight)
      // Downscale the source first so every preset renders from a tiny bitmap.
      const scale = Math.min(1, (thumbnailEdge * 2) / longEdge)
      const source = document.createElement("canvas")
      source.width = Math.max(1, Math.round(image.naturalWidth * scale))
      source.height = Math.max(1, Math.round(image.naturalHeight * scale))
      source.getContext("2d")?.drawImage(image, 0, 0, source.width, source.height)

      // Match how effects look at the preview's 1200px working size.
      const effectScale = Math.min(1, (thumbnailEdge * 2) / Math.min(longEdge, 1200))
      const queue = [...presets]

      const renderNext = () => {
        const preset = queue.shift()
        if (!preset || cancelled) return

        const canvas = document.createElement("canvas")
        const layers = instantiatePreset(preset, sourcePalette).map((layer) => ({
          ...layer,
          settings: scaleSettings(layer.settings, effectScale),
        }))

        drawFilteredImage(canvas, source, source.width, source.height, {
          filterLayers: layers,
        })

        const url = canvas.toDataURL("image/jpeg", 0.82)
        setState((current) => ({
          key,
          thumbs: { ...(current.key === key ? current.thumbs : {}), [preset.id]: url },
        }))
        timeout = window.setTimeout(renderNext, 0)
      }

      renderNext()
    }

    image.src = media.url

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
    // presets/sourcePalette are captured through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state.key === key ? state.thumbs : {}
}

/** Shrinks pixel-sized settings so a small render looks like the full preview. */
export const scaleSettings = <T extends Record<string, unknown>>(settings: T, scale: number): T => ({
  ...settings,
  bloomRadius: (settings.bloomRadius as number) * scale,
  ditherScale: Math.max(1, Math.round((settings.ditherScale as number) * scale)),
  modulationAmplitude: (settings.modulationAmplitude as number) * scale,
  pixelSize: Math.max(2, Math.round((settings.pixelSize as number) * scale)),
  asciiCellSize: Math.max(4, Math.round((settings.asciiCellSize as number) * scale)),
  scanLineSpacing: Math.max(2, Math.round((settings.scanLineSpacing as number) * scale)),
})
