"use client"

import { useEffect, useRef, useState } from "react"

import { extractCommonPalette, getRandomHexColor } from "../../_lib/color"
import { drawFilteredImage } from "../../_lib/image-filters"
import {
  canUseVideoWebglRenderer,
  VideoWebglRenderer,
} from "../../_lib/video-webgl-filters"
import type {
  ActiveFilter,
  EditorMedia,
  StackableFilter,
} from "../../_types/editor"
import { ImageCanvas } from "./image-canvas"
import { WorkspaceSidebar } from "./workspace-sidebar"

const fixedFilterOrder: StackableFilter[] = [
  "pixelate",
  "noise",
  "bloom",
  "colors",
  "scan-lines",
  "modulation",
]
const videoPreviewFrameInterval = 1000 / 24

export function MediaWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoPaletteMediaUrlRef = useRef<string | null>(null)
  const videoWebglRendererRef = useRef<VideoWebglRenderer | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [media, setMedia] = useState<EditorMedia | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoTime, setVideoTime] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoFrameVersion, setVideoFrameVersion] = useState(0)
  const [activeFilters, setActiveFilters] = useState<StackableFilter[]>([])
  const [selectedFilter, setSelectedFilter] = useState<ActiveFilter>("none")
  const [pixelSize, setPixelSize] = useState(12)
  const [noiseAmount, setNoiseAmount] = useState(24)
  const [bloomThreshold, setBloomThreshold] = useState(190)
  const [bloomStrength, setBloomStrength] = useState(70)
  const [bloomRadius, setBloomRadius] = useState(18)
  const [modulationDirection, setModulationDirection] = useState<
    "horizontal" | "vertical"
  >("horizontal")
  const [modulationLineCount, setModulationLineCount] = useState(90)
  const [modulationAmplitude, setModulationAmplitude] = useState(34)
  const [modulationThickness, setModulationThickness] = useState(1)
  const [scanLineSpacing, setScanLineSpacing] = useState(8)
  const [scanLineThickness, setScanLineThickness] = useState(1)
  const [scanLineOpacity, setScanLineOpacity] = useState(35)
  const [paletteColors, setPaletteColors] = useState<string[]>([
    "#000000",
    "#ffffff",
    "#808080",
  ])
  const [smartColoring, setSmartColoring] = useState(false)

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
    const settings = {
      activeFilters,
      bloomRadius,
      bloomStrength,
      bloomThreshold,
      modulationAmplitude,
      modulationDirection,
      modulationLineCount,
      modulationThickness,
      noiseAmount,
      paletteColors,
      pixelSize,
      scanLineOpacity,
      scanLineSpacing,
      scanLineThickness,
      smartColoring,
    }

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
          settings,
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

    if (canUseVideoWebglRenderer(settings)) {
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

          renderer.render(sourceVideo, settings, {
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
    const videoPreviewScale = activeFilters.includes("modulation")
      ? 0.4
      : activeFilters.length > 0
        ? 0.6
        : 1
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
        settings,
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
    activeFilters,
    bloomRadius,
    bloomStrength,
    bloomThreshold,
    media,
    modulationAmplitude,
    modulationDirection,
    modulationLineCount,
    modulationThickness,
    noiseAmount,
    paletteColors,
    pixelSize,
    scanLineOpacity,
    scanLineSpacing,
    scanLineThickness,
    smartColoring,
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
    setActiveFilters([])
    setSelectedFilter("none")
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

  const selectFilter = (filter: ActiveFilter) => {
    if (filter === "none") {
      setActiveFilters([])
      setSelectedFilter("none")
      return
    }

    setActiveFilters((currentFilters) => {
      if (!currentFilters.includes(filter)) {
        setSelectedFilter(filter)
        const enabledFilters = new Set([...currentFilters, filter])

        // Store filters in render order so the UI matches the canvas pipeline.
        return fixedFilterOrder.filter((filterName) =>
          enabledFilters.has(filterName),
        )
      }

      const nextFilters = currentFilters.filter(
        (currentFilter) => currentFilter !== filter,
      )

      // Keep the controls pointed at an enabled filter after toggling one off.
      setSelectedFilter(nextFilters.at(-1) ?? "none")
      return nextFilters
    })
  }

  const addPaletteColor = () => {
    setPaletteColors((currentColors) => [...currentColors, "#ffffff"])
  }

  const updatePaletteColor = (colorIndex: number, nextColor: string) => {
    setPaletteColors((currentColors) =>
      currentColors.map((color, index) =>
        index === colorIndex ? nextColor : color,
      ),
    )
  }

  const deletePaletteColor = (colorIndex: number) => {
    setPaletteColors((currentColors) =>
      currentColors.filter((_, index) => index !== colorIndex),
    )
  }

  const randomizePaletteColors = () => {
    setPaletteColors((currentColors) =>
      currentColors.map(() => getRandomHexColor()),
    )
  }

  const currentFilterSettings = {
    activeFilters,
    bloomRadius,
    bloomStrength,
    bloomThreshold,
    modulationAmplitude,
    modulationDirection,
    modulationLineCount,
    modulationThickness,
    noiseAmount,
    paletteColors,
    pixelSize,
    scanLineOpacity,
    scanLineSpacing,
    scanLineThickness,
    smartColoring,
  }
  const canvasRenderMode =
    media?.kind === "video" && canUseVideoWebglRenderer(currentFilterSettings)
      ? "webgl-video"
      : "2d"

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
        activeFilters={activeFilters}
        bloomRadius={bloomRadius}
        bloomStrength={bloomStrength}
        bloomThreshold={bloomThreshold}
        hasMedia={Boolean(media)}
        modulationAmplitude={modulationAmplitude}
        modulationDirection={modulationDirection}
        modulationLineCount={modulationLineCount}
        modulationThickness={modulationThickness}
        noiseAmount={noiseAmount}
        onActiveFilterChange={selectFilter}
        onAddImage={openFilePicker}
        onAddPaletteColor={addPaletteColor}
        onBloomRadiusChange={setBloomRadius}
        onBloomStrengthChange={setBloomStrength}
        onBloomThresholdChange={setBloomThreshold}
        onDeletePaletteColor={deletePaletteColor}
        onModulationAmplitudeChange={setModulationAmplitude}
        onModulationDirectionChange={setModulationDirection}
        onModulationLineCountChange={setModulationLineCount}
        onModulationThicknessChange={setModulationThickness}
        onNoiseAmountChange={setNoiseAmount}
        onPaletteColorChange={updatePaletteColor}
        onPixelSizeChange={setPixelSize}
        onRandomizePaletteColors={randomizePaletteColors}
        onRemoveMedia={clearMedia}
        onScanLineOpacityChange={setScanLineOpacity}
        onScanLineSpacingChange={setScanLineSpacing}
        onScanLineThicknessChange={setScanLineThickness}
        onSmartColoringChange={setSmartColoring}
        paletteColors={paletteColors}
        pixelSize={pixelSize}
        scanLineOpacity={scanLineOpacity}
        scanLineSpacing={scanLineSpacing}
        scanLineThickness={scanLineThickness}
        selectedFilter={selectedFilter}
        smartColoring={smartColoring}
      />

      <div className="flex min-w-0 flex-1">
        <ImageCanvas
          activeFilters={activeFilters}
          bloomStrength={bloomStrength}
          canvasRenderMode={canvasRenderMode}
          canvasRef={canvasRef}
          isVideoPlaying={isVideoPlaying}
          isDragging={isDragging}
          media={media}
          modulationLineCount={modulationLineCount}
          noiseAmount={noiseAmount}
          onClearMedia={clearMedia}
          onDragActiveChange={setIsDragging}
          onImageSelected={selectFile}
          onSeekVideo={seekVideo}
          onToggleVideoPlayback={toggleVideoPlayback}
          onVideoFrameChange={syncVideoFrame}
          onVideoPlayingChange={setIsVideoPlaying}
          paletteColorCount={paletteColors.length}
          pixelSize={pixelSize}
          scanLineSpacing={scanLineSpacing}
          videoDuration={videoDuration}
          videoRef={videoRef}
          videoTime={videoTime}
        />
      </div>
    </main>
  )
}
