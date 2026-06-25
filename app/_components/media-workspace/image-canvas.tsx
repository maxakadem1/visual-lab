import { Pause, Play, Upload, X } from "lucide-react"

import type { EditorMedia } from "../../_types/editor"

type ImageCanvasProps = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  canvasRenderMode: "2d" | "webgl-video"
  isVideoPlaying: boolean
  isDragging: boolean
  visibleLayerCount: number
  media: EditorMedia | null
  onClearMedia: () => void
  onDragActiveChange: (active: boolean) => void
  onImageSelected: (file?: File) => void
  onSeekVideo: (time: number) => void
  onToggleVideoPlayback: () => void
  onVideoFrameChange: () => void
  onVideoPlayingChange: (playing: boolean) => void
  videoDuration: number
  videoRef: React.RefObject<HTMLVideoElement | null>
  videoTime: number
}

export function ImageCanvas({
  canvasRef,
  canvasRenderMode,
  isVideoPlaying,
  isDragging,
  visibleLayerCount,
  media,
  onClearMedia,
  onDragActiveChange,
  onImageSelected,
  onSeekVideo,
  onToggleVideoPlayback,
  onVideoFrameChange,
  onVideoPlayingChange,
  videoDuration,
  videoRef,
  videoTime,
}: ImageCanvasProps) {
  const layerSummary =
    visibleLayerCount === 1
      ? "1 visible layer"
      : `${visibleLayerCount} visible layers`

  return (
    <section
      className="flex min-w-0 flex-1 items-center justify-center px-4 py-6"
      onDragEnter={(event) => {
        event.preventDefault()
        onDragActiveChange(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        onDragActiveChange(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          onDragActiveChange(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDragActiveChange(false)
        onImageSelected(event.dataTransfer.files[0])
      }}
    >
      <div
        className={`relative flex h-[min(720px,calc(100vh-48px))] w-full max-w-5xl items-center justify-center border border-dashed p-4 transition-colors ${
          isDragging
            ? "border-zinc-300 bg-white/[0.03]"
            : "border-white/10 bg-white/[0.015]"
        }`}
      >
        {media ? (
          <>
            <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-112px)] text-xs text-zinc-600">
              <div className="truncate text-zinc-400">{media.name}</div>
              <div>{layerSummary}</div>
            </div>

            <button
              type="button"
              aria-label="Remove media"
              title="Remove media"
              onClick={onClearMedia}
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center text-zinc-600 transition-colors hover:text-white"
            >
              <X size={17} strokeWidth={1.5} />
            </button>

            {media.kind === "video" && (
              <video
                ref={videoRef}
                src={media.url}
                className="hidden"
                playsInline
                preload="metadata"
                onEnded={() => {
                  onVideoPlayingChange(false)
                  onVideoFrameChange()
                }}
                onLoadedData={onVideoFrameChange}
                onLoadedMetadata={onVideoFrameChange}
                onPause={() => onVideoPlayingChange(false)}
                onPlay={() => onVideoPlayingChange(true)}
                onSeeked={onVideoFrameChange}
                onTimeUpdate={onVideoFrameChange}
              />
            )}

            <canvas
              key={canvasRenderMode}
              ref={canvasRef}
              aria-label={`${media.name} preview`}
              className="max-h-full max-w-full object-contain"
            />

            {media.kind === "video" && (
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-3 text-xs text-zinc-500">
                <button
                  type="button"
                  aria-label={isVideoPlaying ? "Pause video" : "Play video"}
                  title={isVideoPlaying ? "Pause" : "Play"}
                  onClick={onToggleVideoPlayback}
                  className="grid size-9 shrink-0 place-items-center text-zinc-500 transition-colors hover:text-white"
                >
                  {isVideoPlaying ? (
                    <Pause size={17} strokeWidth={1.5} />
                  ) : (
                    <Play size={17} strokeWidth={1.5} />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max={videoDuration || 0}
                  step="0.01"
                  value={Math.min(videoTime, videoDuration || videoTime)}
                  onChange={(event) => onSeekVideo(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-zinc-200"
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            <Upload size={24} strokeWidth={1.4} className="text-zinc-600" />
            <div className="text-xs leading-5 text-zinc-700">
              <div>drop media here</div>
              <div>or use Add media</div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
