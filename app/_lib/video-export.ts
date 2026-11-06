/**
 * Real-time video export: plays a hidden copy of the source video, renders every
 * decoded frame through the caller's filter pipeline onto a canvas, and records
 * that canvas (plus the original audio) with MediaRecorder.
 */

export type VideoExportFormat = { mimeType: string; extension: "mp4" | "webm" }

export type VideoFrameRenderer = (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  mediaTime: number,
) => void

type RecordOptions = {
  url: string
  /** Builds the renderer for the export canvas; called once before playback. */
  createRenderer: (canvas: HTMLCanvasElement) => VideoFrameRenderer
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

type CaptureTrack = MediaStreamTrack & { requestFrame?: () => void }

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: { mediaTime: number }) => void,
  ) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

const formatCandidates: (VideoExportFormat & { audioCodec?: string })[] = [
  { mimeType: "video/mp4;codecs=avc1.640028", audioCodec: "mp4a.40.2", extension: "mp4" },
  { mimeType: "video/mp4;codecs=avc1", audioCodec: "mp4a", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9", audioCodec: "opus", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8", audioCodec: "opus", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
]

export const canExportVideo = () =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  typeof HTMLCanvasElement.prototype.captureStream === "function"

/** Prefers MP4 (plays everywhere, seekable) and falls back to WebM. */
const pickFormat = (withAudio: boolean): VideoExportFormat | null => {
  for (const candidate of formatCandidates) {
    const { audioCodec, ...format } = candidate
    const withAudioType =
      withAudio && audioCodec ? `${format.mimeType},${audioCodec}` : null

    if (withAudioType && MediaRecorder.isTypeSupported(withAudioType)) {
      return { ...format, mimeType: withAudioType }
    }
    if (MediaRecorder.isTypeSupported(format.mimeType)) {
      return format
    }
  }

  return null
}

const abortError = () => new DOMException("Export cancelled", "AbortError")

const waitForEvent = (
  target: HTMLMediaElement,
  event: string,
  signal?: AbortSignal,
) =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, onEvent)
      target.removeEventListener("error", onError)
      signal?.removeEventListener("abort", onAbort)
    }
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("The video could not be decoded."))
    }
    const onAbort = () => {
      cleanup()
      reject(abortError())
    }

    target.addEventListener(event, onEvent, { once: true })
    target.addEventListener("error", onError, { once: true })
    signal?.addEventListener("abort", onAbort, { once: true })
  })

/**
 * WebM files written by MediaRecorder (screen recordings and the like) report an
 * infinite duration until the browser has scanned to the end. Seeking far past the
 * end forces that scan; then rewind to the start.
 */
const resolveDuration = async (video: HTMLVideoElement, signal?: AbortSignal) => {
  if (Number.isFinite(video.duration)) return video.duration

  const seeked = waitForEvent(video, "seeked", signal)
  video.currentTime = Number.MAX_SAFE_INTEGER
  await seeked

  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const rewound = waitForEvent(video, "seeked", signal)
  video.currentTime = 0
  await rewound

  return duration
}

/** Rough bitrate: generous enough that dither and grain survive compression. */
const getVideoBitrate = (width: number, height: number) =>
  Math.round(Math.min(40_000_000, Math.max(4_000_000, width * height * 30 * 0.12)))

export async function recordFilteredVideo({
  url,
  createRenderer,
  onProgress,
  signal,
}: RecordOptions): Promise<{ blob: Blob; format: VideoExportFormat }> {
  if (signal?.aborted) throw abortError()

  const video = document.createElement("video") as FrameCallbackVideo
  video.src = url
  video.playsInline = true
  video.preload = "auto"
  // Keep the element in the document (and on screen) so browsers don't
  // throttle or pause decoding, but effectively invisible to the user.
  video.style.cssText =
    "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1"
  document.body.appendChild(video)

  const canvas = document.createElement("canvas")
  let audioContext: AudioContext | null = null
  let recorder: MediaRecorder | null = null
  let frameHandle = 0
  let animationFrame = 0
  let stream: MediaStream | null = null
  let onVisibilityChange: (() => void) | null = null

  const cleanup = () => {
    if (frameHandle) video.cancelVideoFrameCallback?.(frameHandle)
    cancelAnimationFrame(animationFrame)
    if (onVisibilityChange) {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
    video.pause()
    video.removeAttribute("src")
    video.load()
    video.remove()
    stream?.getTracks().forEach((track) => track.stop())
    void audioContext?.close().catch(() => {})
  }

  try {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent(video, "loadeddata", signal)
    }

    const duration = await resolveDuration(video, signal)
    const render = createRenderer(canvas)

    // Draw once now so the canvas has its final size before capture starts.
    render(canvas, video, video.currentTime)

    // Push one captured frame per decoded source frame when the browser allows it.
    stream = canvas.captureStream(0)
    let videoTrack = stream.getVideoTracks()[0] as CaptureTrack | undefined

    if (videoTrack && typeof videoTrack.requestFrame !== "function") {
      stream.getTracks().forEach((track) => track.stop())
      stream = canvas.captureStream(30)
      videoTrack = stream.getVideoTracks()[0] as CaptureTrack | undefined
    }

    if (!videoTrack) {
      throw new Error("This browser can't capture the canvas.")
    }

    const captureTrack = videoTrack

    // Route the audio through Web Audio: it reaches the recording but not the speakers.
    let audioTracks: MediaStreamTrack[] = []
    try {
      audioContext = new AudioContext()
      const source = audioContext.createMediaElementSource(video)
      const destination = audioContext.createMediaStreamDestination()
      source.connect(destination)
      audioTracks = destination.stream.getAudioTracks()
      await audioContext.resume()
    } catch {
      audioTracks = []
    }

    const format = pickFormat(audioTracks.length > 0)

    if (!format) {
      throw new Error("This browser can't record video.")
    }

    const recordingStream = new MediaStream([captureTrack, ...audioTracks])
    const chunks: Blob[] = []
    const activeRecorder = new MediaRecorder(recordingStream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: getVideoBitrate(canvas.width, canvas.height),
      audioBitsPerSecond: 192_000,
    })
    recorder = activeRecorder

    activeRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    const stopped = new Promise<void>((resolve, reject) => {
      activeRecorder.onstop = () => resolve()
      activeRecorder.onerror = () => reject(new Error("Recording failed."))
    })

    let lastRenderedTime = -1
    let lastFrameCallbackAt = 0

    // Render and capture in the same task: WebGL clears its buffer afterwards.
    const renderFrame = (mediaTime: number) => {
      lastRenderedTime = mediaTime
      render(canvas, video, mediaTime)
      captureTrack.requestFrame?.()

      if (duration > 0) {
        onProgress?.(Math.min(1, mediaTime / duration))
      }
    }

    // Frame callbacks line captures up with decoded frames, but some browsers stop
    // delivering them when the video isn't composited, so animation frames back them up.
    if (video.requestVideoFrameCallback) {
      const onFrame = (_now: number, metadata: { mediaTime: number }) => {
        lastFrameCallbackAt = performance.now()
        renderFrame(metadata.mediaTime)
        frameHandle = video.requestVideoFrameCallback!(onFrame)
      }
      frameHandle = video.requestVideoFrameCallback(onFrame)
    }

    const onTick = () => {
      const callbacksStalled = performance.now() - lastFrameCallbackAt > 250

      if (callbacksStalled && !video.paused && video.currentTime !== lastRenderedTime) {
        renderFrame(video.currentTime)
      }
      animationFrame = requestAnimationFrame(onTick)
    }
    animationFrame = requestAnimationFrame(onTick)

    // Background tabs stop rendering, so hold the recording until the tab is back.
    onVisibilityChange = () => {
      if (activeRecorder.state === "inactive" || video.ended) return

      if (document.hidden) {
        video.pause()
        if (activeRecorder.state === "recording") activeRecorder.pause()
      } else {
        if (activeRecorder.state === "paused") activeRecorder.resume()
        void video.play().catch(() => {})
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    const ended = waitForEvent(video, "ended", signal)

    activeRecorder.start(1000)
    renderFrame(video.currentTime)

    try {
      await video.play()
    } catch (error) {
      activeRecorder.stop()
      throw error
    }

    try {
      await ended
    } catch (error) {
      if (activeRecorder.state !== "inactive") activeRecorder.stop()
      throw error
    }

    onProgress?.(1)
    activeRecorder.stop()
    await stopped

    return { blob: new Blob(chunks, { type: format.mimeType.split(";")[0] }), format }
  } finally {
    if (recorder && recorder.state !== "inactive") recorder.stop()
    cleanup()
  }
}
