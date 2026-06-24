import { Upload, X } from "lucide-react"

import type { ActiveFilter, EditorImage } from "../../_types/editor"

type ImageCanvasProps = {
  activeFilter: ActiveFilter
  bloomStrength: number
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  image: EditorImage | null
  isDragging: boolean
  modulationLineCount: number
  noiseAmount: number
  onClearImage: () => void
  onDragActiveChange: (active: boolean) => void
  onImageSelected: (file?: File) => void
  paletteColorCount: number
  pixelSize: number
  scanLineSpacing: number
}

export function ImageCanvas({
  activeFilter,
  bloomStrength,
  canvasRef,
  image,
  isDragging,
  modulationLineCount,
  noiseAmount,
  onClearImage,
  onDragActiveChange,
  onImageSelected,
  paletteColorCount,
  pixelSize,
  scanLineSpacing,
}: ImageCanvasProps) {
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
        {image ? (
          <>
            <div className="absolute left-4 top-4 z-10 max-w-[calc(100%-112px)] text-xs text-zinc-600">
              <div className="truncate text-zinc-400">{image.name}</div>
              <div>
                {activeFilter === "pixelate" && `pixelated ${pixelSize}px`}
                {activeFilter === "noise" && `noise ${noiseAmount}`}
                {activeFilter === "bloom" && `bloom ${bloomStrength}`}
                {activeFilter === "colors" && `${paletteColorCount} colors`}
                {activeFilter === "scan-lines" && `scan lines ${scanLineSpacing}px`}
                {activeFilter === "modulation" &&
                  `modulation ${modulationLineCount} lines`}
                {activeFilter === "none" && "source image"}
              </div>
            </div>

            <button
              type="button"
              aria-label="Remove image"
              title="Remove image"
              onClick={onClearImage}
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center text-zinc-600 transition-colors hover:text-white"
            >
              <X size={17} strokeWidth={1.5} />
            </button>

            <canvas
              ref={canvasRef}
              aria-label={`${image.name} preview`}
              className="max-h-full max-w-full object-contain"
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            <Upload size={24} strokeWidth={1.4} className="text-zinc-600" />
            <div className="text-xs leading-5 text-zinc-700">
              <div>drop an image here</div>
              <div>or use Add image</div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
