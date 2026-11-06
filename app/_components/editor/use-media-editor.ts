"use client"

import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { AudioEngine, type AudioSource } from "../../_lib/audio-engine"
import {
  applyAudioModulation,
  AudioAnalyser,
  autoMapAudio,
  isAudioReactive,
  silentLevels,
  type AudioLevels,
} from "../../_lib/audio-reactive"
import { extractCommonPalette, getRandomHexColor } from "../../_lib/color"
import {
  filterDefinitionMap,
  imageFilters,
  videoFilters,
} from "../../_lib/filter-registry"
import { drawFilteredImage } from "../../_lib/image-filters"
import {
  buildShareUrl,
  createLayerId,
  createLayerSettings,
  defaultPalette,
  instantiatePreset,
  normalizeLayers,
  readSharedLayers,
  toPresetLayers,
  type Preset,
} from "../../_lib/presets"
import { createEffectMemory } from "../../_lib/weird-effects"
import {
  loadSession,
  saveCustomPreset,
  saveSessionLayers,
  saveSessionMedia,
} from "../../_lib/storage"
import { canExportVideo, recordFilteredVideo } from "../../_lib/video-export"
import { VideoWebglRenderer } from "../../_lib/video-webgl-filters"
import type {
  EditorMedia,
  FilterLayer,
  FilterLayerSettings,
  StackableFilter,
} from "../../_types/editor"

const imagePreviewMaxEdge = 1200
/** Canvas 2D video effects run on the CPU; keep their working size modest. */
const videoCpuPreviewMaxEdge = 960
const videoCpuExportMaxEdge = 1920
/** Animated stills redraw at most this often. */
const animatedFrameInterval = 1000 / 30
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
  const exportAbortRef = useRef<AbortController | null>(null)
  const notifyRef = useRef(notify)
  const effectMemoryRef = useRef(createEffectMemory())
  const sourceImageRef = useRef<{ url: string; image: HTMLImageElement } | null>(null)
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const [audioSource, setAudioSource] = useState<AudioSource>("off")

  const [media, setMedia] = useState<EditorMedia | null>(null)
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
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

  // A running video export reads from the current media, so stop it when that goes away.
  useEffect(() => {
    return () => {
      exportAbortRef.current?.abort()
    }
  }, [media])

  // Preview rendering. Redraws continuously while video plays, audio is
  // listening or an effect animates; otherwise once per change.
  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !media) {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null
      return
    }

    let cancelled = false
    let animationFrameId = 0
    let timeoutId = 0
    let videoFrameCallbackId = 0
    let lastStatAt = 0
    const memory = effectMemoryRef.current
    const engine = audioSource !== "off" ? audioEngineRef.current : null
    const continuous = Boolean(engine) || layers.some(isAnimatedLayer)
    const liveLayers = () => (engine ? applyAudioModulation(layers, engine.sample()) : layers)

    // Animated previews re-render constantly; only report timing twice a second.
    const reportRenderTime = (ms: number) => {
      const now = performance.now()
      if (continuous && now - lastStatAt < 500) return
      lastStatAt = now
      setRenderMs(ms)
    }

    const cleanup = () => {
      cancelled = true
      cancelAnimationFrame(animationFrameId)
      window.clearTimeout(timeoutId)
    }

    if (media.kind === "image") {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null

      const draw = (image: HTMLImageElement) => {
        if (cancelled) return

        const start = performance.now()
        drawFilteredImage(
          canvas,
          image,
          image.naturalWidth,
          image.naturalHeight,
          { filterLayers: liveLayers() },
          {
            renderScale: getPreviewRenderScale(image.naturalWidth, image.naturalHeight),
            memory,
            time: start / 1000,
          },
        )
        const elapsed = performance.now() - start
        reportRenderTime(elapsed)

        if (continuous) {
          // Heavy stacks get breathing room so the UI stays responsive.
          const wait = Math.max(animatedFrameInterval - elapsed, elapsed > 50 ? elapsed * 0.5 : 0)
          timeoutId = window.setTimeout(() => {
            animationFrameId = requestAnimationFrame(() => draw(image))
          }, wait)
        }
      }

      const cached = sourceImageRef.current

      if (cached?.url === media.url) {
        draw(cached.image)
      } else {
        loadImage(media.url)
          .then((image) => {
            sourceImageRef.current = { url: media.url, image }
            draw(image)
          })
          .catch(() => {})
      }

      return cleanup
    }

    const sourceVideo = videoRef.current

    if (!sourceVideo || !sourceVideo.videoWidth || !sourceVideo.videoHeight) {
      return
    }

    const requestVideoFrame = sourceVideo.requestVideoFrameCallback?.bind(sourceVideo)
    const cancelVideoFrame = sourceVideo.cancelVideoFrameCallback?.bind(sourceVideo)
    const isPlaying = () => !sourceVideo.paused && !sourceVideo.ended
    let renderFrame: ((now: number) => void) | null = null

    if (usesGpuVideoPath(layers)) {
      let renderer = videoWebglRendererRef.current

      if (!renderer || renderer.targetCanvas !== canvas) {
        renderer?.destroy()

        try {
          renderer = new VideoWebglRenderer(canvas)
          videoWebglRendererRef.current = renderer
        } catch {
          renderer = null
          videoWebglRendererRef.current = null
        }
      }

      if (renderer) {
        const gpuRenderer = renderer
        const scale = sourceVideo.paused ? 1 : 0.8

        renderFrame = (now) =>
          gpuRenderer.render(
            sourceVideo,
            getVideoFilterSettings(liveLayers(), paletteColors),
            { renderScale: scale, time: now / 1000 },
          )
      }
    }

    if (!renderFrame) {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null
      const scale = getMaxEdgeScale(
        sourceVideo.videoWidth,
        sourceVideo.videoHeight,
        videoCpuPreviewMaxEdge,
      )

      renderFrame = (now) => {
        const start = performance.now()
        const mediaTime = sourceVideo.currentTime

        drawFilteredImage(
          canvas,
          sourceVideo,
          sourceVideo.videoWidth,
          sourceVideo.videoHeight,
          { filterLayers: liveLayers() },
          {
            renderScale: scale,
            memory,
            // Paused video still animates looping effects.
            time: isPlaying() ? mediaTime : now / 1000,
            frameTime: mediaTime,
          },
        )
        reportRenderTime(performance.now() - start)
      }
    }

    const draw = renderFrame
    const tick = (now: number) => {
      if (cancelled) return
      draw(now)

      if (isPlaying() && requestVideoFrame) {
        videoFrameCallbackId = requestVideoFrame(tick)
      } else if (isPlaying() || continuous) {
        animationFrameId = requestAnimationFrame(tick)
      }
    }

    tick(performance.now())

    return () => {
      cleanup()
      if (cancelVideoFrame && videoFrameCallbackId) cancelVideoFrame(videoFrameCallbackId)
    }
  }, [audioSource, layers, media, paletteColors, videoFrameVersion])

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

  const stopMediaAudio = useCallback(() => {
    setAudioSource((current) => {
      if (current !== "media") return current
      audioEngineRef.current?.stop()
      return "off"
    })
  }, [])

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
      effectMemoryRef.current = createEffectMemory()

      // A soundtrack source only makes sense while a video is open.
      if (kind !== "video") stopMediaAudio()

      const supported = kind === "video" ? videoFilters : imageFilters

      if (options.layers) {
        dispatchHistory({ type: "load", layers: options.layers })
        setSelectedLayerId(options.layers[0]?.id ?? null)
      } else {
        // Keep the current look, minus effects this kind of media can't render.
        setLayers((current) => {
          const kept = current.filter((layer) => supported.includes(layer.type))
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
    [setLayers, stopMediaAudio],
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
    effectMemoryRef.current = createEffectMemory()
    stopMediaAudio()
    void saveSessionMedia(null)
  }, [stopMediaAudio])

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
      const restoredLayers = sharedLayers ?? normalizeLayers(session?.layers ?? [])

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
      downloadBlob(blob, getExportFileName(media.name, "png"))
    } catch (error) {
      console.error(error)
      notify("Export failed", { tone: "error" })
    } finally {
      setIsExporting(false)
    }
  }

  const exportVideo = async () => {
    if (!media || media.kind !== "video" || isExporting) {
      return
    }

    if (!canExportVideo()) {
      notify("This browser can't record video", { tone: "error" })
      return
    }

    // Snapshot the look so edits made while recording don't change the output.
    const exportLayers = layers
    const exportPalette = paletteColors
    const exportAudioSource = audioSource
    const useWebgl = usesGpuVideoPath(exportLayers)
    const liveEngine = audioSource !== "off" ? audioEngineRef.current : null
    const reactive = liveEngine !== null && exportLayers.some(isAudioReactive)
    const memory = createEffectMemory()
    const controller = new AbortController()
    let exportAnalyser: AudioAnalyser | null = null
    let renderer: VideoWebglRenderer | null = null

    exportAbortRef.current = controller
    setIsExporting(true)
    setExportProgress(0)
    notify("Recording in real time. Keep this tab open.")

    try {
      const { blob, format } = await recordFilteredVideo({
        url: media.url,
        signal: controller.signal,
        onProgress: setExportProgress,
        createRenderer: (canvas, audio) => {
          // Soundtrack mode listens to the export's own copy of the audio, so the
          // result lines up with the music. Mic mode keeps using the live mic.
          let sampleLevels: (() => AudioLevels) | null = null
          if (reactive && exportAudioSource === "media" && audio) {
            const analyser = new AudioAnalyser(audio.context, audio.source)
            exportAnalyser = analyser
            sampleLevels = () => analyser.sample()
          } else if (reactive && liveEngine) {
            sampleLevels = () => liveEngine.sample()
          }
          const liveLayers = () =>
            sampleLevels ? applyAudioModulation(exportLayers, sampleLevels()) : exportLayers

          if (useWebgl) {
            try {
              const webglRenderer = new VideoWebglRenderer(canvas)
              renderer = webglRenderer
              return (_canvas, video, mediaTime) =>
                webglRenderer.render(video, getVideoFilterSettings(liveLayers(), exportPalette), {
                  renderScale: 1,
                  time: mediaTime,
                })
            } catch {
              // Fall through to the 2D path below.
            }
          }

          return (target, video, mediaTime) =>
            drawFilteredImage(
              target,
              video,
              video.videoWidth,
              video.videoHeight,
              { filterLayers: liveLayers() },
              {
                renderScale: getMaxEdgeScale(
                  video.videoWidth,
                  video.videoHeight,
                  videoCpuExportMaxEdge,
                ),
                memory,
                time: mediaTime,
                frameTime: mediaTime,
              },
            )
        },
      })
      const fileName = getExportFileName(media.name, format.extension)

      downloadBlob(blob, fileName)
      notify(`Saved ${fileName}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        notify("Video export cancelled")
      } else {
        console.error(error)
        notify(
          error instanceof Error && error.message ? error.message : "Export failed",
          { tone: "error" },
        )
      }
    } finally {
      ;(renderer as VideoWebglRenderer | null)?.destroy()
      ;(exportAnalyser as AudioAnalyser | null)?.disconnect()
      if (exportAbortRef.current === controller) exportAbortRef.current = null
      setIsExporting(false)
      setExportProgress(null)
    }
  }

  const exportMedia = () => {
    if (media?.kind === "video") return exportVideo()
    return exportImage()
  }

  const cancelExport = () => {
    exportAbortRef.current?.abort()
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

  const canvasRenderMode: "2d" | "webgl-video" =
    media?.kind === "video" && usesGpuVideoPath(layers) ? "webgl-video" : "2d"

  /* ---------------------------- Audio reactive --------------------------- */

  const startAudio = async (next: AudioSource) => {
    if (next === "off") {
      audioEngineRef.current?.stop()
      setAudioSource("off")
      return
    }

    audioEngineRef.current ??= new AudioEngine()
    const engine = audioEngineRef.current

    try {
      if (next === "media") {
        const video = videoRef.current
        if (media?.kind !== "video" || !video) {
          throw new Error("Open a video to react to its soundtrack.")
        }
        await engine.start("media", video)
      } else {
        await engine.start("mic")
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't start audio", { tone: "error" })
      setAudioSource("off")
      return
    }

    setAudioSource(next)

    // First time on: wire every layer up so something moves right away.
    if (!layers.some(isAudioReactive)) {
      if (layers.length) {
        setLayers((current) => autoMapAudio(current))
        notify("Layers now react to sound. Fine-tune each one in the inspector.")
      } else {
        notify("Listening. Add an effect to see it react.")
      }
    }
  }

  const autoMapAllAudio = () => {
    if (!layers.length) return
    setLayers((current) => autoMapAudio(current))
  }

  const getAudioLevels = useCallback(
    () =>
      audioEngineRef.current && audioSource !== "off"
        ? audioEngineRef.current.sample()
        : silentLevels,
    [audioSource],
  )

  // Stop the mic when the editor goes away.
  useEffect(() => () => audioEngineRef.current?.stop(), [])

  // Once wired, Web Audio carries the preview video's sound, so keep it awake.
  useEffect(() => {
    if (isVideoPlaying) audioEngineRef.current?.resume()
  }, [isVideoPlaying])

  /* ------------------------------ Snapshots ------------------------------ */

  /** A copy of the frame as currently shown, effects included. */
  const captureProcessedFrame = (): HTMLCanvasElement | null => {
    const canvas = canvasRef.current
    if (!canvas || !media || !canvas.width) return null

    if (canvasRenderMode === "webgl-video") {
      // WebGL clears its buffer after compositing; redraw and copy in one task.
      const renderer = videoWebglRendererRef.current
      const video = videoRef.current
      if (!renderer || !video) return null
      renderer.render(video, getVideoFilterSettings(layers, paletteColors), {
        renderScale: 1,
        time: performance.now() / 1000,
      })
    }

    const copy = document.createElement("canvas")
    copy.width = canvas.width
    copy.height = canvas.height
    copy.getContext("2d")?.drawImage(canvas, 0, 0)
    return copy
  }

  /** The untouched source (or current video frame), scaled to fit `maxEdge`. */
  const captureSourceFrame = async (maxEdge: number): Promise<HTMLCanvasElement | null> => {
    if (!media) return null
    let source: CanvasImageSource
    let width: number
    let height: number

    if (media.kind === "image") {
      const cached = sourceImageRef.current
      const image = cached?.url === media.url ? cached.image : await loadImage(media.url)
      source = image
      width = image.naturalWidth
      height = image.naturalHeight
    } else {
      const video = videoRef.current
      if (!video?.videoWidth) return null
      source = video
      width = video.videoWidth
      height = video.videoHeight
    }

    const scale = getMaxEdgeScale(width, height, maxEdge)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  /** Replace the whole stack in one undoable step (breed mode). */
  const replaceLayers = (nextLayers: FilterLayer[]) => {
    setLayers(() => nextLayers)
    setSelectedLayerId(nextLayers[0]?.id ?? null)
  }

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
    audioSource,
    getAudioLevels,
    notify,
    sourcePalette: paletteColors,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    video: {
      duration: videoDuration,
      time: videoTime,
      playing: isVideoPlaying,
    },
    isExporting,
    exportProgress,
    actions: {
      openFilePicker,
      selectFile,
      clearMedia,
      exportImage,
      exportVideo,
      exportMedia,
      cancelExport,
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
      startAudio,
      autoMapAllAudio,
      captureProcessedFrame,
      captureSourceFrame,
      replaceLayers,
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

/** Effects that animate by themselves, so the preview has to keep redrawing. */
const isAnimatedLayer = (layer: FilterLayer) =>
  layer.visible &&
  ((layer.type === "gravity" && layer.settings.gravityAnimate) ||
    (layer.type === "databend" && layer.settings.databendAnimate))

/** WebGL handles video only when every visible layer has a shader version. */
export const usesGpuVideoPath = (filterLayers: FilterLayer[]) => {
  const visible = filterLayers.filter((layer) => layer.visible)
  return visible.length > 0 && visible.every((layer) => filterDefinitionMap[layer.type].gpu)
}

const getMaxEdgeScale = (width: number, height: number, maxEdge: number) => {
  const longestEdge = Math.max(width, height)
  return longestEdge > maxEdge ? maxEdge / longestEdge : 1
}

const getVideoFilterSettings = (
  filterLayers: FilterLayer[],
  paletteColors: string[],
) => {
  const settings = createLayerSettings(paletteColors)
  const activeFilters: StackableFilter[] = []

  for (const filter of gpuFilters) {
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

const gpuFilters = videoFilters.filter((filter) => filterDefinitionMap[filter].gpu)

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

const getExportFileName = (fileName: string, extension: string) => {
  const dotIndex = fileName.lastIndexOf(".")
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const safeBaseName = baseName.trim() || "media"

  return `${safeBaseName}-visual-lab.${extension}`
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement("a")

  downloadLink.href = downloadUrl
  downloadLink.download = fileName
  downloadLink.style.display = "none"
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()

  // Let the browser start the download before releasing the blob URL.
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}
