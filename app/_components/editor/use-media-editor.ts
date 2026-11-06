"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { extractCommonPalette, getRandomHexColor } from "../../_lib/color"
import { imageFilters, videoFilters } from "../../_lib/filter-registry"
import { drawFilteredImage } from "../../_lib/image-filters"
import {
  buildShareUrl,
  createLayerId,
  createLayerSettings,
  defaultPalette,
  instantiatePreset,
  readSharedLayers,
  toPresetLayers,
  type Preset,
} from "../../_lib/presets"
import {
  loadSession,
  saveCustomPreset,
  saveSessionLayers,
  saveSessionMedia,
} from "../../_lib/storage"
import {
  canUseVideoWebglRenderer,
  VideoWebglRenderer,
} from "../../_lib/video-webgl-filters"
import type {
  EditorMedia,
  FilterLayer,
  FilterLayerSettings,
  StackableFilter,
} from "../../_types/editor"

const videoPreviewFrameInterval = 1000 / 24
const imagePreviewMaxEdge = 1200
const historyLimit = 100
const coalesceWindowMs = 1000

export type MediaInfo = { width: number; height: number; size: number }
export type NotifyOptions = {
  tone?: "default" | "error"
  action?: { label: string; run: () => void }
}
export type Notify = (message: string, options?: NotifyOptions) => void

/* ------------------------------ Layer history ---------------------------- */

type LayerHistory = {
  layers: FilterLayer[]
  past: FilterLayer[][]
  future: FilterLayer[][]
  lastKey: string | null
  lastAt: number
}

type HistoryAction =
  | {
      type: "apply"
      updater: (layers: FilterLayer[]) => FilterLayer[]
      key?: string
      at: number
    }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; layers: FilterLayer[] }

const historyReducer = (state: LayerHistory, action: HistoryAction): LayerHistory => {
  switch (action.type) {
    case "apply": {
      const next = action.updater(state.layers)
      if (next === state.layers) return state

      // Slider drags fire dozens of updates; fold them into one undo step.
      const coalesce =
        action.key !== undefined &&
        action.key === state.lastKey &&
        action.at - state.lastAt < coalesceWindowMs

      return {
        layers: next,
        past: coalesce ? state.past : [...state.past, state.layers].slice(-historyLimit),
        future: [],
        lastKey: action.key ?? null,
        lastAt: action.at,
      }
    }
    case "undo": {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        layers: previous,
        past: state.past.slice(0, -1),
        future: [state.layers, ...state.future],
        lastKey: null,
        lastAt: 0,
      }
    }
    case "redo": {
      const [next, ...future] = state.future
      if (!next) return state
      return {
        layers: next,
        past: [...state.past, state.layers],
        future,
        lastKey: null,
        lastAt: 0,
      }
    }
    case "load":
      return { layers: action.layers, past: [], future: [], lastKey: null, lastAt: 0 }
  }
}

const initialHistory: LayerHistory = {
  layers: [],
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
}

/* --------------------------------- Hook ---------------------------------- */

export function useMediaEditor({ notify }: { notify: Notify }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoPaletteMediaUrlRef = useRef<string | null>(null)
  const videoWebglRendererRef = useRef<VideoWebglRenderer | null>(null)
  const restoreDoneRef = useRef(false)
  const notifyRef = useRef(notify)

  const [media, setMedia] = useState<EditorMedia | null>(null)
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [videoFrameVersion, setVideoFrameVersion] = useState(0)
  const [history, dispatchHistory] = useReducer(historyReducer, initialHistory)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [renderMs, setRenderMs] = useState<number | null>(null)
  const [paletteColors, setPaletteColors] = useState<string[]>(defaultPalette)
  const layers = history.layers

  useEffect(() => {
    notifyRef.current = notify
  })

  const setLayers = useCallback(
    (updater: (layers: FilterLayer[]) => FilterLayer[], key?: string) =>
      dispatchHistory({ type: "apply", updater, key, at: Date.now() }),
    [],
  )

  useEffect(() => {
    return () => {
      if (media) {
        URL.revokeObjectURL(media.url)
      }
    }
  }, [media])

  // Preview rendering.
  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !media) {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null
      return
    }

    let cancelled = false
    let animationFrameId = 0
    const imageSettings = { filterLayers: layers }
    const videoSettings = getVideoFilterSettings(layers, paletteColors)

    if (media.kind === "image") {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null
      const sourceImage = new window.Image()

      sourceImage.onload = () => {
        if (cancelled) {
          return
        }

        const start = performance.now()
        drawFilteredImage(
          canvas,
          sourceImage,
          sourceImage.naturalWidth,
          sourceImage.naturalHeight,
          imageSettings,
          {
            renderScale: getPreviewRenderScale(
              sourceImage.naturalWidth,
              sourceImage.naturalHeight,
            ),
          },
        )
        setRenderMs(performance.now() - start)
      }

      sourceImage.src = media.url

      return () => {
        cancelled = true
      }
    }

    const sourceVideo = videoRef.current

    if (!sourceVideo || !sourceVideo.videoWidth || !sourceVideo.videoHeight) {
      return
    }

    if (canUseVideoWebglRenderer(videoSettings)) {
      let renderer = videoWebglRendererRef.current

      if (!renderer || renderer.targetCanvas !== canvas) {
        renderer?.destroy()

        try {
          renderer = new VideoWebglRenderer(canvas)
          videoWebglRendererRef.current = renderer
        } catch {
          videoWebglRendererRef.current = null
        }
      }

      if (renderer) {
        let videoFrameCallbackId = 0
        const requestVideoFrame =
          sourceVideo.requestVideoFrameCallback?.bind(sourceVideo)
        const cancelVideoFrame =
          sourceVideo.cancelVideoFrameCallback?.bind(sourceVideo)
        const videoPreviewScale = sourceVideo.paused ? 1 : 0.8
        const renderVideoFrame = (now: number) => {
          if (cancelled) {
            return
          }

          renderer.render(sourceVideo, videoSettings, {
            renderScale: videoPreviewScale,
            time: now / 1000,
          })

          if (sourceVideo.paused || sourceVideo.ended) {
            return
          }

          if (requestVideoFrame) {
            videoFrameCallbackId = requestVideoFrame(renderVideoFrame)
            return
          }

          animationFrameId = requestAnimationFrame(renderVideoFrame)
        }

        renderVideoFrame(performance.now())

        return () => {
          cancelled = true

          if (cancelVideoFrame && videoFrameCallbackId) {
            cancelVideoFrame(videoFrameCallbackId)
          }

          cancelAnimationFrame(animationFrameId)
        }
      }
    }

    videoWebglRendererRef.current?.destroy()
    videoWebglRendererRef.current = null

    let lastVideoRenderTime = 0
    const renderVideoFrame = () => {
      if (cancelled) {
        return
      }

      const now = performance.now()

      if (
        !sourceVideo.paused &&
        lastVideoRenderTime > 0 &&
        now - lastVideoRenderTime < videoPreviewFrameInterval
      ) {
        animationFrameId = requestAnimationFrame(renderVideoFrame)
        return
      }

      lastVideoRenderTime = now
      drawFilteredImage(
        canvas,
        sourceVideo,
        sourceVideo.videoWidth,
        sourceVideo.videoHeight,
        imageSettings,
        { renderScale: 1 },
      )

      if (!sourceVideo.paused && !sourceVideo.ended) {
        animationFrameId = requestAnimationFrame(renderVideoFrame)
      }
    }

    renderVideoFrame()

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrameId)
    }
  }, [layers, media, paletteColors, videoFrameVersion])

  // Palette extraction + media metadata.
  useEffect(() => {
    if (!media) {
      return
    }

    let cancelled = false

    if (media.kind === "image") {
      const sourceImage = new window.Image()

      sourceImage.onload = () => {
        if (cancelled) {
          return
        }

        setMediaInfo((info) => ({
          size: info?.size ?? 0,
          width: sourceImage.naturalWidth,
          height: sourceImage.naturalHeight,
        }))
        setPaletteColors(
          extractCommonPalette(
            sourceImage,
            sourceImage.naturalWidth,
            sourceImage.naturalHeight,
            3,
          ),
        )
      }

      sourceImage.src = media.url

      return () => {
        cancelled = true
      }
    }

    const sourceVideo = videoRef.current

    if (sourceVideo?.videoWidth && sourceVideo.videoHeight) {
      if (videoPaletteMediaUrlRef.current === media.url) {
        return
      }

      // Lock video palettes to the first readable frame to avoid playback flicker.
      videoPaletteMediaUrlRef.current = media.url
      setMediaInfo((info) => ({
        size: info?.size ?? 0,
        width: sourceVideo.videoWidth,
        height: sourceVideo.videoHeight,
      }))
      setPaletteColors(
        extractCommonPalette(
          sourceVideo,
          sourceVideo.videoWidth,
          sourceVideo.videoHeight,
          3,
        ),
      )
    }

    return () => {
      cancelled = true
    }
  }, [media, videoFrameVersion])

  const supportedFilters = media?.kind === "video" ? videoFilters : imageFilters

  /* ------------------------------ Media I/O ------------------------------ */

  const loadFile = useCallback(
    (file: File, options: { layers?: FilterLayer[]; persist?: boolean } = {}) => {
      const kind = file.type.startsWith("video/") ? "video" : "image"
      const nextMedia = {
        kind,
        name: file.name,
        url: URL.createObjectURL(file),
      } satisfies EditorMedia

      // Release the previous preview before replacing it with the new media.
      setMedia((currentMedia) => {
        if (currentMedia) {
          URL.revokeObjectURL(currentMedia.url)
        }

        return nextMedia
      })
      setMediaInfo({ width: 0, height: 0, size: file.size })
      setVideoDuration(0)
      setVideoTime(0)
      setIsVideoPlaying(false)
      setVideoFrameVersion((version) => version + 1)
      setRenderMs(null)

      if (options.layers) {
        dispatchHistory({ type: "load", layers: options.layers })
        setSelectedLayerId(options.layers[0]?.id ?? null)
      } else if (kind === "video") {
        // Keep the current look, minus effects video can't render.
        setLayers((current) => {
          const kept = current.filter((layer) => videoFilters.includes(layer.type))
          return kept.length === current.length ? current : kept
        })
      }

      if (options.persist !== false) {
        void saveSessionMedia(file)
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [setLayers],
  )

  const selectFile = useCallback(
    (file?: File) => {
      if (
        file &&
        (file.type.startsWith("image/") || file.type.startsWith("video/"))
      ) {
        loadFile(file)
      }
    },
    [loadFile],
  )

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const clearMedia = useCallback(() => {
    setMedia((currentMedia) => {
      if (currentMedia) {
        URL.revokeObjectURL(currentMedia.url)
      }

      return null
    })

    setMediaInfo(null)
    setIsVideoPlaying(false)
    setVideoDuration(0)
    setVideoTime(0)
    dispatchHistory({ type: "load", layers: [] })
    setSelectedLayerId(null)
    setRenderMs(null)
    void saveSessionMedia(null)
  }, [])

  // Restore the last session, or a look shared through the URL hash.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const shared = readSharedLayers(window.location.hash)
      const session = await loadSession()

      if (cancelled) return

      const sharedLayers = shared
        ? instantiatePreset({ layers: shared }, defaultPalette)
        : null
      const restoredLayers = sharedLayers ?? session?.layers ?? []

      if (session?.file && session.type) {
        loadFile(
          new File([session.file], session.name ?? "media", { type: session.type }),
          { layers: restoredLayers, persist: false },
        )
      } else if (restoredLayers.length) {
        dispatchHistory({ type: "load", layers: restoredLayers })
        setSelectedLayerId(restoredLayers[0]?.id ?? null)
      }

      if (sharedLayers) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        )
        notifyRef.current(
          session?.file
            ? "Shared look applied"
            : "Shared look loaded. Open an image to see it.",
        )
      } else if (session?.file) {
        notifyRef.current(`Restored ${session.name ?? "your last session"}`)
      }

      restoreDoneRef.current = true
    })()

    return () => {
      cancelled = true
    }
  }, [loadFile])

  // Autosave the stack so a refresh never loses work.
  useEffect(() => {
    if (!restoreDoneRef.current) return
    const timeout = window.setTimeout(() => void saveSessionLayers(layers), 400)
    return () => window.clearTimeout(timeout)
  }, [layers])

  // Paste images or videos straight onto the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find(
        (item) => item.type.startsWith("image/") || item.type.startsWith("video/"),
      )

      if (!file) return
      event.preventDefault()
      loadFile(renamePastedFile(file))
      notifyRef.current("Pasted from clipboard")
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [loadFile])

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()

      for (const item of items) {
        const type = item.types.find((entry) => entry.startsWith("image/"))
        if (!type) continue
        const blob = await item.getType(type)
        loadFile(renamePastedFile(new File([blob], `image.${type.split("/")[1]}`, { type })))
        notify("Pasted from clipboard")
        return
      }

      notify("No image on the clipboard", { tone: "error" })
    } catch {
      notify("Clipboard access was blocked", { tone: "error" })
    }
  }

  const renderExportBlob = async () => {
    if (!media || media.kind !== "image") {
      throw new Error("Nothing to export.")
    }

    const sourceImage = await loadImage(media.url)
    const exportCanvas = document.createElement("canvas")

    // Render at natural size so export quality is independent from preview scale.
    drawFilteredImage(
      exportCanvas,
      sourceImage,
      sourceImage.naturalWidth,
      sourceImage.naturalHeight,
      { filterLayers: layers },
    )

    return getCanvasBlob(exportCanvas)
  }

  const exportImage = async () => {
    if (!media || media.kind !== "image" || isExporting) {
      return
    }

    setIsExporting(true)

    try {
      const blob = await renderExportBlob()
      const downloadUrl = URL.createObjectURL(blob)
      const downloadLink = document.createElement("a")

      downloadLink.href = downloadUrl
      downloadLink.download = getExportFileName(media.name)
      downloadLink.style.display = "none"
      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()

      // Let the browser start the download before releasing the blob URL.
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
    } catch (error) {
      console.error(error)
      notify("Export failed", { tone: "error" })
    } finally {
      setIsExporting(false)
    }
  }

  const copyImage = async () => {
    if (!media || media.kind !== "image") {
      return
    }

    try {
      // Hand the clipboard a promise so the user gesture stays valid while rendering.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": renderExportBlob() }),
      ])
      notify("Image copied to clipboard")
    } catch (error) {
      console.error(error)
      notify("Couldn't copy the image", { tone: "error" })
    }
  }

  /* ------------------------------- Video --------------------------------- */

  const toggleVideoPlayback = useCallback(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (video.paused || video.ended) {
      void video.play()
      setIsVideoPlaying(true)
    } else {
      video.pause()
      setIsVideoPlaying(false)
    }

    setVideoFrameVersion((version) => version + 1)
  }, [])

  const seekVideo = (time: number) => {
    const video = videoRef.current

    if (!video) {
      return
    }

    video.currentTime = time
    setVideoTime(time)
    setVideoFrameVersion((version) => version + 1)
  }

  const syncVideoFrame = () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    setVideoTime(video.currentTime)
    setVideoDuration(
      video.duration && Number.isFinite(video.duration) ? video.duration : 0,
    )
    setVideoFrameVersion((version) => version + 1)
  }

  /* ------------------------------- Layers -------------------------------- */

  const addLayer = (filter: StackableFilter) => {
    if (!media || !supportedFilters.includes(filter)) {
      return
    }

    const nextLayer = {
      id: createLayerId(),
      settings: createLayerSettings(paletteColors),
      type: filter,
      visible: true,
    } satisfies FilterLayer

    setLayers((currentLayers) => [nextLayer, ...currentLayers])
    setSelectedLayerId(nextLayer.id)
  }

  const duplicateLayer = (layerId: string) => {
    const nextId = createLayerId()

    setLayers((currentLayers) => {
      const index = currentLayers.findIndex((layer) => layer.id === layerId)

      if (index < 0) {
        return currentLayers
      }

      const source = currentLayers[index]
      const copy: FilterLayer = {
        ...source,
        id: nextId,
        settings: {
          ...source.settings,
          paletteColors: [...source.settings.paletteColors],
        },
      }
      const nextLayers = [...currentLayers]

      nextLayers.splice(index, 0, copy)
      return nextLayers
    })
    setSelectedLayerId(nextId)
  }

  const updateLayerSettings = (
    layerId: string,
    settings: Partial<FilterLayerSettings>,
  ) => {
    setLayers(
      (currentLayers) =>
        currentLayers.map((layer) =>
          layer.id === layerId
            ? { ...layer, settings: { ...layer.settings, ...settings } }
            : layer,
        ),
      `${layerId}:${Object.keys(settings).sort().join(",")}`,
    )
  }

  const resetLayer = (layerId: string) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? { ...layer, settings: createLayerSettings(paletteColors) }
          : layer,
      ),
    )
  }

  const moveLayer = (layerId: string, toIndex: number) => {
    setLayers((currentLayers) => {
      const fromIndex = currentLayers.findIndex((layer) => layer.id === layerId)

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        toIndex >= currentLayers.length ||
        fromIndex === toIndex
      ) {
        return currentLayers
      }

      const nextLayers = [...currentLayers]
      const [layer] = nextLayers.splice(fromIndex, 1)

      nextLayers.splice(toIndex, 0, layer)
      return nextLayers
    })
  }

  const toggleLayerVisibility = (layerId: string) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    )
  }

  const deleteLayer = (layerId: string) => {
    const deletedIndex = layers.findIndex((layer) => layer.id === layerId)
    const nextLayers = layers.filter((layer) => layer.id !== layerId)

    if (selectedLayerId === layerId) {
      setSelectedLayerId(
        nextLayers[deletedIndex]?.id ?? nextLayers[deletedIndex - 1]?.id ?? null,
      )
    }

    setLayers(() => nextLayers)
  }

  const clearLayers = () => {
    setLayers(() => [])
    setSelectedLayerId(null)
  }

  /** Color-picker drags coalesce into one undo step; discrete swaps do not. */
  const updatePalette = (layerId: string, nextPalette: string[], coalesce = true) => {
    if (coalesce) {
      updateLayerSettings(layerId, { paletteColors: nextPalette })
      return
    }

    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? { ...layer, settings: { ...layer.settings, paletteColors: [...nextPalette] } }
          : layer,
      ),
    )
  }

  const randomizePalette = (layerId: string) => {
    const layer = layers.find((currentLayer) => currentLayer.id === layerId)

    if (layer) {
      setLayers(
        (currentLayers) =>
          currentLayers.map((current) =>
            current.id === layerId
              ? {
                  ...current,
                  settings: {
                    ...current.settings,
                    paletteColors: current.settings.paletteColors.map(() =>
                      getRandomHexColor(),
                    ),
                  },
                }
              : current,
          ),
      )
    }
  }

  /* ------------------------------- History ------------------------------- */

  // After undo/redo, focus the layer that actually changed.
  const selectAfterTravel = (target: FilterLayer[]) => {
    const changed = target.find((layer) => !layers.includes(layer))

    if (changed) {
      setSelectedLayerId(changed.id)
    } else if (!target.some((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(target[0]?.id ?? null)
    }
  }

  const undo = () => {
    const target = history.past.at(-1)
    if (!target) return
    dispatchHistory({ type: "undo" })
    selectAfterTravel(target)
  }

  const redo = () => {
    const target = history.future[0]
    if (!target) return
    dispatchHistory({ type: "redo" })
    selectAfterTravel(target)
  }

  /* --------------------------- Presets & sharing -------------------------- */

  const applyPreset = (preset: Preset) => {
    if (!media) return

    const nextLayers = instantiatePreset(preset, paletteColors).filter((layer) =>
      supportedFilters.includes(layer.type),
    )

    setLayers(() => nextLayers)
    setSelectedLayerId(nextLayers[0]?.id ?? null)
    notify(`Applied “${preset.name}”`, { action: { label: "Undo", run: () => dispatchHistory({ type: "undo" }) } })
  }

  const saveStackAsPreset = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !layers.length) return

    saveCustomPreset({
      id: createLayerId(),
      name: trimmed,
      description: `${layers.length} layer${layers.length === 1 ? "" : "s"}`,
      layers: toPresetLayers(layers),
      custom: true,
    })
    notify(`Saved preset “${trimmed}”`)
  }

  const copyShareLink = async () => {
    if (!layers.length) return

    try {
      await copyText(buildShareUrl(layers))
      notify("Link copied. Anyone who opens it gets this look.")
    } catch {
      notify("Couldn't copy the link", { tone: "error" })
    }
  }

  const activeVideoSettings = getVideoFilterSettings(layers, paletteColors)
  const canvasRenderMode: "2d" | "webgl-video" =
    media?.kind === "video" && canUseVideoWebglRenderer(activeVideoSettings)
      ? "webgl-video"
      : "2d"

  return {
    fileInputRef,
    canvasRef,
    videoRef,
    media,
    mediaInfo,
    layers,
    selectedLayerId,
    selectedLayer: layers.find((layer) => layer.id === selectedLayerId) ?? null,
    supportedFilters,
    canvasRenderMode,
    renderMs,
    sourcePalette: paletteColors,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    video: {
      duration: videoDuration,
      time: videoTime,
      playing: isVideoPlaying,
    },
    isExporting,
    actions: {
      openFilePicker,
      selectFile,
      clearMedia,
      exportImage,
      copyImage,
      pasteFromClipboard,
      toggleVideoPlayback,
      seekVideo,
      syncVideoFrame,
      setVideoPlaying: setIsVideoPlaying,
      addLayer,
      duplicateLayer,
      updateLayerSettings,
      resetLayer,
      moveLayer,
      toggleLayerVisibility,
      deleteLayer,
      clearLayers,
      selectLayer: setSelectedLayerId,
      updatePalette,
      randomizePalette,
      undo,
      redo,
      applyPreset,
      saveStackAsPreset,
      copyShareLink,
    },
  }
}

export type MediaEditor = ReturnType<typeof useMediaEditor>

/** Async clipboard first; falls back to execCommand when permission is missing. */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {}

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()

  if (!copied) throw new Error("Copy failed")
}

const renamePastedFile = (file: File) => {
  if (!/^image\.\w+$/i.test(file.name)) return file

  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png"
  const stamp = new Date()
    .toTimeString()
    .slice(0, 8)
    .replace(/:/g, "-")

  return new File([file], `Pasted ${stamp}.${extension}`, { type: file.type })
}

const getVideoFilterSettings = (
  filterLayers: FilterLayer[],
  paletteColors: string[],
) => {
  const settings = createLayerSettings(paletteColors)
  const activeFilters: StackableFilter[] = []

  for (const filter of videoFilters) {
    const layer = filterLayers.find(
      (currentLayer) => currentLayer.visible && currentLayer.type === filter,
    )

    if (!layer) {
      continue
    }

    // The video shader supports one pass per filter type, so top layers win.
    applyVideoLayerSettings(settings, layer)
    activeFilters.push(filter)
  }

  return { ...settings, activeFilters }
}

const videoSettingKeys: Partial<
  Record<StackableFilter, (keyof FilterLayerSettings)[]>
> = {
  pixelate: ["pixelSize"],
  noise: ["noiseAmount"],
  bloom: ["bloomRadius", "bloomStrength", "bloomThreshold"],
  colors: ["paletteColors", "smartColoring"],
  "scan-lines": ["scanLineOpacity", "scanLineSpacing", "scanLineThickness"],
  modulation: [
    "modulationAmplitude",
    "modulationDirection",
    "modulationLineCount",
    "modulationThickness",
  ],
}

const applyVideoLayerSettings = (
  settings: FilterLayerSettings,
  layer: FilterLayer,
) => {
  const target = settings as Record<keyof FilterLayerSettings, unknown>

  for (const key of videoSettingKeys[layer.type] ?? []) {
    target[key] = layer.settings[key]
  }
}

const getPreviewRenderScale = (width: number, height: number) => {
  const longestEdge = Math.max(width, height)

  // Cap interactive canvas work so large photos do not multiply per-layer cost.
  return longestEdge > imagePreviewMaxEdge ? imagePreviewMaxEdge / longestEdge : 1
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()

    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

const getCanvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not export PNG."))
        return
      }

      resolve(blob)
    }, "image/png")
  })

const getExportFileName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf(".")
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const safeBaseName = baseName.trim() || "image"

  return `${safeBaseName}-visual-lab.png`
}
