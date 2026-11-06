"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { extractCommonPalette, getRandomHexColor } from "../../_lib/color"
import { imageFilters, videoFilters } from "../../_lib/filter-registry"
import { drawFilteredImage } from "../../_lib/image-filters"
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

export type MediaInfo = { width: number; height: number; size: number }

export function useMediaEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoPaletteMediaUrlRef = useRef<string | null>(null)
  const videoWebglRendererRef = useRef<VideoWebglRenderer | null>(null)
  const layerIdRef = useRef(0)

  const [media, setMedia] = useState<EditorMedia | null>(null)
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [videoFrameVersion, setVideoFrameVersion] = useState(0)
  const [layers, setLayers] = useState<FilterLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [renderMs, setRenderMs] = useState<number | null>(null)
  const [paletteColors, setPaletteColors] = useState<string[]>([
    "#000000",
    "#ffffff",
    "#808080",
  ])

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

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const selectFile = useCallback((file?: File) => {
    if (
      !file ||
      (!file.type.startsWith("image/") && !file.type.startsWith("video/"))
    ) {
      return
    }

    const nextMedia = {
      kind: file.type.startsWith("video/") ? "video" : "image",
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
    setLayers([])
    setSelectedLayerId(null)
    setRenderMs(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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
    setLayers([])
    setSelectedLayerId(null)
    setRenderMs(null)
  }, [])

  const exportImage = async () => {
    if (!media || media.kind !== "image" || isExporting) {
      return
    }

    setIsExporting(true)

    try {
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

      const blob = await getCanvasBlob(exportCanvas)
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
    } finally {
      setIsExporting(false)
    }
  }

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

  const supportedFilters = media?.kind === "video" ? videoFilters : imageFilters

  const addLayer = (filter: StackableFilter) => {
    if (!media || !supportedFilters.includes(filter)) {
      return
    }

    layerIdRef.current += 1
    const nextLayer = {
      id: `layer-${layerIdRef.current}`,
      settings: createLayerSettings(paletteColors),
      type: filter,
      visible: true,
    } satisfies FilterLayer

    setLayers((currentLayers) => [nextLayer, ...currentLayers])
    setSelectedLayerId(nextLayer.id)
  }

  const duplicateLayer = (layerId: string) => {
    layerIdRef.current += 1
    const nextId = `layer-${layerIdRef.current}`

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
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? { ...layer, settings: { ...layer.settings, ...settings } }
          : layer,
      ),
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

    setLayers(nextLayers)
  }

  const clearLayers = () => {
    setLayers([])
    setSelectedLayerId(null)
  }

  const updatePalette = (layerId: string, nextPalette: string[]) => {
    updateLayerSettings(layerId, { paletteColors: nextPalette })
  }

  const randomizePalette = (layerId: string) => {
    const layer = layers.find((currentLayer) => currentLayer.id === layerId)

    if (layer) {
      updatePalette(
        layerId,
        layer.settings.paletteColors.map(() => getRandomHexColor()),
      )
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
    },
  }
}

export type MediaEditor = ReturnType<typeof useMediaEditor>

export const createLayerSettings = (
  paletteColors: string[],
): FilterLayerSettings => ({
  bloomRadius: 18,
  bloomStrength: 70,
  bloomThreshold: 190,
  ditherPattern: "bayer",
  ditherScale: 4,
  ditherStrength: 100,
  fisheyeRadius: 100,
  fisheyeStrength: 45,
  modulationAmplitude: 34,
  modulationDirection: "horizontal",
  modulationLineCount: 90,
  modulationThickness: 1,
  noiseAmount: 24,
  paletteColors: [...paletteColors],
  pixelSortDirection: "vertical",
  pixelSortThreshold: 160,
  pixelSize: 12,
  asciiCellSize: 10,
  asciiContrast: 120,
  asciiCustomCharacters: " .:-=+*#%@",
  asciiCustomCharactersEnabled: false,
  asciiInvert: false,
  scanLineOpacity: 35,
  scanLineSpacing: 8,
  scanLineThickness: 1,
  smartColoring: false,
})

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
