"use client"

import { useEffect, useRef, useState } from "react"

import { extractCommonPalette, getRandomHexColor } from "../../_lib/color"
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
import { ImageCanvas } from "./image-canvas"
import { LayerSidebar } from "./layer-sidebar"
import { WorkspaceSidebar } from "./workspace-sidebar"

const videoPreviewFrameInterval = 1000 / 24
const imagePreviewMaxEdge = 1200
const imageFilters: StackableFilter[] = [
  "pixelate",
  "noise",
  "bloom",
  "colors",
  "dither",
  "fisheye",
  "scan-lines",
  "modulation",
]
const videoFilters: StackableFilter[] = [
  "pixelate",
  "noise",
  "bloom",
  "colors",
  "scan-lines",
  "modulation",
]

export function MediaWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoPaletteMediaUrlRef = useRef<string | null>(null)
  const videoWebglRendererRef = useRef<VideoWebglRenderer | null>(null)
  const layerIdRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [media, setMedia] = useState<EditorMedia | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoFrameVersion, setVideoFrameVersion] = useState(0)
  const [filterLayers, setFilterLayers] = useState<FilterLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
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

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !media) {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null
      return
    }

    let cancelled = false
    let animationFrameId = 0
    const imageSettings = {
      filterLayers,
    }
    const videoSettings = getVideoFilterSettings(filterLayers, paletteColors)

    if (media.kind === "image") {
      videoWebglRendererRef.current?.destroy()
      videoWebglRendererRef.current = null
      const sourceImage = new window.Image()

      sourceImage.onload = () => {
        if (cancelled) {
          return
        }

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
    const videoPreviewScale = 1
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
        {
          renderScale: sourceVideo.paused ? 1 : videoPreviewScale,
        },
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
  }, [
    filterLayers,
    media,
    paletteColors,
    videoFrameVersion,
  ])

  useEffect(() => {
    if (!media) {
      return
    }

    let cancelled = false

    if (media.kind === "image") {
      const sourceImage = new window.Image()

      sourceImage.onload = () => {
        if (!cancelled) {
          setPaletteColors(
            extractCommonPalette(
              sourceImage,
              sourceImage.naturalWidth,
              sourceImage.naturalHeight,
              3,
            ),
          )
        }
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

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const selectFile = (file?: File) => {
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
    setVideoDuration(0)
    setVideoTime(0)
    setIsVideoPlaying(false)
    setVideoFrameVersion((version) => version + 1)
    setFilterLayers([])
    setSelectedLayerId(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const clearMedia = () => {
    setMedia((currentMedia) => {
      if (currentMedia) {
        URL.revokeObjectURL(currentMedia.url)
      }

      return null
    })

    setIsVideoPlaying(false)
    setVideoDuration(0)
    setVideoTime(0)
    setFilterLayers([])
    setSelectedLayerId(null)
  }

  const toggleVideoPlayback = () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (video.paused || video.ended) {
      void video.play()
      setIsVideoPlaying(true)
      setVideoFrameVersion((version) => version + 1)
      return
    }

    video.pause()
    setIsVideoPlaying(false)
    setVideoFrameVersion((version) => version + 1)
  }

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

  const addFilterLayer = (filter: StackableFilter) => {
    const supportedFilters = getSupportedFilters(media?.kind)

    if (!media || !supportedFilters.includes(filter)) {
      return
    }

    const nextLayer = {
      id: `layer-${layerIdRef.current + 1}`,
      settings: createLayerSettings(paletteColors),
      type: filter,
      visible: true,
    } satisfies FilterLayer

    layerIdRef.current += 1
    setFilterLayers((currentLayers) => [nextLayer, ...currentLayers])
    setSelectedLayerId(nextLayer.id)
  }

  const updateLayerSettings = (
    layerId: string,
    settings: Partial<FilterLayerSettings>,
  ) => {
    setFilterLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId
          ? { ...layer, settings: { ...layer.settings, ...settings } }
          : layer,
      ),
    )
  }

  const moveLayer = (layerId: string, direction: "up" | "down") => {
    setFilterLayers((currentLayers) => {
      const currentIndex = currentLayers.findIndex((layer) => layer.id === layerId)
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= currentLayers.length
      ) {
        return currentLayers
      }

      const nextLayers = [...currentLayers]
      const [layer] = nextLayers.splice(currentIndex, 1)

      nextLayers.splice(nextIndex, 0, layer)
      return nextLayers
    })
  }

  const toggleLayerVisibility = (layerId: string) => {
    setFilterLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    )
  }

  const deleteLayer = (layerId: string) => {
    setFilterLayers((currentLayers) => {
      const deletedIndex = currentLayers.findIndex((layer) => layer.id === layerId)
      const nextLayers = currentLayers.filter((layer) => layer.id !== layerId)

      if (selectedLayerId === layerId) {
        setSelectedLayerId(
          nextLayers[deletedIndex]?.id ?? nextLayers[deletedIndex - 1]?.id ?? null,
        )
      }

      return nextLayers
    })
  }

  const addLayerPaletteColor = (layerId: string) => {
    const layer = filterLayers.find((currentLayer) => currentLayer.id === layerId)

    updateLayerSettings(layerId, {
      paletteColors: [...(layer?.settings.paletteColors ?? []), "#ffffff"],
    })
  }

  const updateLayerPaletteColor = (
    layerId: string,
    colorIndex: number,
    nextColor: string,
  ) => {
    const layer = filterLayers.find((currentLayer) => currentLayer.id === layerId)

    if (!layer) {
      return
    }

    updateLayerSettings(layerId, {
      paletteColors: layer.settings.paletteColors.map((color, index) =>
        index === colorIndex ? nextColor : color,
      ),
    })
  }

  const deleteLayerPaletteColor = (layerId: string, colorIndex: number) => {
    const layer = filterLayers.find((currentLayer) => currentLayer.id === layerId)

    if (!layer || layer.settings.paletteColors.length === 1) {
      return
    }

    updateLayerSettings(layerId, {
      paletteColors: layer.settings.paletteColors.filter(
        (_, index) => index !== colorIndex,
      ),
    })
  }

  const randomizeLayerPaletteColors = (layerId: string) => {
    const layer = filterLayers.find((currentLayer) => currentLayer.id === layerId)

    if (!layer) {
      return
    }

    updateLayerSettings(layerId, {
      paletteColors: layer.settings.paletteColors.map(() => getRandomHexColor()),
    })
  }

  const visibleLayerCount = filterLayers.filter((layer) => layer.visible).length
  const activeVideoSettings = getVideoFilterSettings(filterLayers, paletteColors)
  const canvasRenderMode =
    media?.kind === "video" && canUseVideoWebglRenderer(activeVideoSettings)
      ? "webgl-video"
      : "2d"
  const supportedFilters = getSupportedFilters(media?.kind)

  return (
    <main className="flex min-h-screen flex-col bg-black text-sm text-zinc-300 md:flex-row">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      <WorkspaceSidebar
        canAddFilters={Boolean(media)}
        hasMedia={Boolean(media)}
        onAddFilter={addFilterLayer}
        onAddImage={openFilePicker}
        onRemoveMedia={clearMedia}
        supportedFilters={supportedFilters}
      />

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <ImageCanvas
          canvasRenderMode={canvasRenderMode}
          canvasRef={canvasRef}
          isVideoPlaying={isVideoPlaying}
          isDragging={isDragging}
          media={media}
          onClearMedia={clearMedia}
          onDragActiveChange={setIsDragging}
          onImageSelected={selectFile}
          onSeekVideo={seekVideo}
          onToggleVideoPlayback={toggleVideoPlayback}
          onVideoFrameChange={syncVideoFrame}
          onVideoPlayingChange={setIsVideoPlaying}
          visibleLayerCount={visibleLayerCount}
          videoDuration={videoDuration}
          videoRef={videoRef}
          videoTime={videoTime}
        />

        <LayerSidebar
          layers={filterLayers}
          onAddPaletteColor={addLayerPaletteColor}
          onDeleteLayer={deleteLayer}
          onDeletePaletteColor={deleteLayerPaletteColor}
          onMoveLayer={moveLayer}
          onPaletteColorChange={updateLayerPaletteColor}
          onRandomizePaletteColors={randomizeLayerPaletteColors}
          onSelectLayer={setSelectedLayerId}
          onToggleLayerVisibility={toggleLayerVisibility}
          onUpdateLayerSettings={updateLayerSettings}
          selectedLayerId={selectedLayerId}
        />
      </div>
    </main>
  )
}

const createLayerSettings = (paletteColors: string[]): FilterLayerSettings => ({
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
  pixelSize: 12,
  scanLineOpacity: 35,
  scanLineSpacing: 8,
  scanLineThickness: 1,
  smartColoring: false,
})

const getSupportedFilters = (mediaKind?: EditorMedia["kind"]) => {
  if (mediaKind === "video") {
    return videoFilters
  }

  return imageFilters
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

  return {
    ...settings,
    activeFilters,
  }
}

const applyVideoLayerSettings = (
  settings: FilterLayerSettings,
  layer: FilterLayer,
) => {
  if (layer.type === "pixelate") {
    settings.pixelSize = layer.settings.pixelSize
  }

  if (layer.type === "noise") {
    settings.noiseAmount = layer.settings.noiseAmount
  }

  if (layer.type === "bloom") {
    settings.bloomRadius = layer.settings.bloomRadius
    settings.bloomStrength = layer.settings.bloomStrength
    settings.bloomThreshold = layer.settings.bloomThreshold
  }

  if (layer.type === "colors") {
    settings.paletteColors = layer.settings.paletteColors
    settings.smartColoring = layer.settings.smartColoring
  }

  if (layer.type === "scan-lines") {
    settings.scanLineOpacity = layer.settings.scanLineOpacity
    settings.scanLineSpacing = layer.settings.scanLineSpacing
    settings.scanLineThickness = layer.settings.scanLineThickness
  }

  if (layer.type === "modulation") {
    settings.modulationAmplitude = layer.settings.modulationAmplitude
    settings.modulationDirection = layer.settings.modulationDirection
    settings.modulationLineCount = layer.settings.modulationLineCount
    settings.modulationThickness = layer.settings.modulationThickness
  }
}

const getPreviewRenderScale = (width: number, height: number) => {
  const longestEdge = Math.max(width, height)

  // Cap interactive canvas work so large photos do not multiply per-layer cost.
  return longestEdge > imagePreviewMaxEdge ? imagePreviewMaxEdge / longestEdge : 1
}
