"use client"

import { useEffect, useRef, useState } from "react"
import {
  Aperture,
  Archive,
  Frame,
  Images,
  SlidersHorizontal,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"

type ActiveFilter = "none" | "pixelate" | "noise" | "bloom" | "colors"

type RgbColor = [number, number, number]

const navItems = [
  { label: "Canvas", icon: Frame },
  { label: "Media", icon: Images },
  { label: "Adjust", icon: SlidersHorizontal },
  { label: "Archive", icon: Archive },
]

const getColorDistance = (left: RgbColor, right: RgbColor) => {
  return (
    (left[0] - right[0]) ** 2 +
    (left[1] - right[1]) ** 2 +
    (left[2] - right[2]) ** 2
  )
}

const findNearestColor = (color: RgbColor, palette: RgbColor[]) => {
  let nearestColor = palette[0]
  let nearestDistance = getColorDistance(color, nearestColor)

  for (const paletteColor of palette) {
    const distance = getColorDistance(color, paletteColor)

    if (distance < nearestDistance) {
      nearestColor = paletteColor
      nearestDistance = distance
    }
  }

  return nearestColor
}

const rgbToHex = ([red, green, blue]: RgbColor) => {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`
}

const hexToRgb = (hexColor: string): RgbColor => {
  return [
    Number.parseInt(hexColor.slice(1, 3), 16),
    Number.parseInt(hexColor.slice(3, 5), 16),
    Number.parseInt(hexColor.slice(5, 7), 16),
  ]
}

const getRandomHexColor = () => {
  const randomValue = Math.floor(Math.random() * 0xffffff)

  return `#${randomValue.toString(16).padStart(6, "0")}`
}

const getLuminance = ([red, green, blue]: RgbColor) => {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

const normalizeColorToLuminance = (color: RgbColor, targetLuminance: number) => {
  const currentLuminance = Math.max(1, getLuminance(color))
  const scale = targetLuminance / currentLuminance

  return color.map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * scale))),
  ) as RgbColor
}

const buildSmartPalette = (palette: RgbColor[]) => {
  if (palette.length === 1) {
    return [normalizeColorToLuminance(palette[0], 150)]
  }

  const sortedPalette = [...palette].sort(
    (left, right) => getLuminance(left) - getLuminance(right),
  )

  // Spread chosen colors across brightness steps so the image remains readable.
  return sortedPalette.map((color, index) => {
    const targetLuminance = 35 + (index / (sortedPalette.length - 1)) * 200
    return normalizeColorToLuminance(color, targetLuminance)
  })
}

const extractCommonPalette = (sourceImage: HTMLImageElement, colorCount: number) => {
  const sampleCanvas = document.createElement("canvas")
  const sampleContext = sampleCanvas.getContext("2d")

  if (!sampleContext) {
    return Array.from({ length: colorCount }, () => "#000000")
  }

  sampleCanvas.width = Math.min(240, sourceImage.naturalWidth)
  sampleCanvas.height = Math.max(
    1,
    Math.round((sampleCanvas.width / sourceImage.naturalWidth) * sourceImage.naturalHeight),
  )
  sampleContext.drawImage(sourceImage, 0, 0, sampleCanvas.width, sampleCanvas.height)

  const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data
  const buckets = new Map<string, { blue: number; count: number; green: number; red: number }>()

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 16) {
      continue
    }

    const redBucket = Math.round(pixels[index] / 32) * 32
    const greenBucket = Math.round(pixels[index + 1] / 32) * 32
    const blueBucket = Math.round(pixels[index + 2] / 32) * 32
    const key = `${redBucket}-${greenBucket}-${blueBucket}`
    const bucket = buckets.get(key) ?? { blue: 0, count: 0, green: 0, red: 0 }

    bucket.count += 1
    bucket.red += pixels[index]
    bucket.green += pixels[index + 1]
    bucket.blue += pixels[index + 2]
    buckets.set(key, bucket)
  }

  const palette = Array.from(buckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, colorCount)
    .map((bucket) =>
      rgbToHex([
        Math.round(bucket.red / bucket.count),
        Math.round(bucket.green / bucket.count),
        Math.round(bucket.blue / bucket.count),
      ]),
    )

  while (palette.length < colorCount) {
    palette.push("#000000")
  }

  return palette
}

export function MediaWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [image, setImage] = useState<{ name: string; url: string } | null>(null)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("none")
  const [pixelSize, setPixelSize] = useState(12)
  const [noiseAmount, setNoiseAmount] = useState(24)
  const [bloomThreshold, setBloomThreshold] = useState(190)
  const [bloomStrength, setBloomStrength] = useState(70)
  const [bloomRadius, setBloomRadius] = useState(18)
  const [paletteColors, setPaletteColors] = useState<string[]>([
    "#000000",
    "#ffffff",
    "#808080",
  ])
  const [smartColoring, setSmartColoring] = useState(false)

  useEffect(() => {
    return () => {
      if (image) {
        URL.revokeObjectURL(image.url)
      }
    }
  }, [image])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !image) {
      return
    }

    let cancelled = false
    const sourceImage = new window.Image()

    sourceImage.onload = () => {
      if (cancelled) {
        return
      }

      const context = canvas.getContext("2d")

      if (!context) {
        return
      }

      canvas.width = sourceImage.naturalWidth
      canvas.height = sourceImage.naturalHeight
      context.clearRect(0, 0, canvas.width, canvas.height)

      if (activeFilter === "pixelate") {
        const sampleWidth = Math.max(1, Math.ceil(canvas.width / pixelSize))
        const sampleHeight = Math.max(1, Math.ceil(canvas.height / pixelSize))
        const sampleCanvas = document.createElement("canvas")
        const sampleContext = sampleCanvas.getContext("2d")

        if (!sampleContext) {
          return
        }

        sampleCanvas.width = sampleWidth
        sampleCanvas.height = sampleHeight

        // Scale down, then scale up without smoothing to create block pixels.
        sampleContext.drawImage(sourceImage, 0, 0, sampleWidth, sampleHeight)
        context.imageSmoothingEnabled = false
        context.drawImage(
          sampleCanvas,
          0,
          0,
          sampleWidth,
          sampleHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        context.imageSmoothingEnabled = true
        return
      }

      context.drawImage(sourceImage, 0, 0)

      if (activeFilter === "noise") {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data

        // Add equal RGB variance so the image keeps its original color balance.
        for (let index = 0; index < pixels.length; index += 4) {
          const noise = (Math.random() - 0.5) * noiseAmount * 2
          pixels[index] = Math.max(0, Math.min(255, pixels[index] + noise))
          pixels[index + 1] = Math.max(0, Math.min(255, pixels[index + 1] + noise))
          pixels[index + 2] = Math.max(0, Math.min(255, pixels[index + 2] + noise))
        }

        context.putImageData(imageData, 0, 0)
      }

      if (activeFilter === "bloom") {
        const glowCanvas = document.createElement("canvas")
        const glowContext = glowCanvas.getContext("2d")

        if (!glowContext) {
          return
        }

        glowCanvas.width = canvas.width
        glowCanvas.height = canvas.height
        glowContext.drawImage(sourceImage, 0, 0)

        const glowData = glowContext.getImageData(0, 0, canvas.width, canvas.height)
        const glowPixels = glowData.data

        // Keep only bright pixels so the blur spreads highlights, not shadows.
        for (let index = 0; index < glowPixels.length; index += 4) {
          const brightness =
            glowPixels[index] * 0.2126 +
            glowPixels[index + 1] * 0.7152 +
            glowPixels[index + 2] * 0.0722

          if (brightness < bloomThreshold) {
            glowPixels[index + 3] = 0
          }
        }

        glowContext.putImageData(glowData, 0, 0)
        context.save()
        context.globalAlpha = bloomStrength / 100
        context.globalCompositeOperation = "screen"
        context.filter = `blur(${bloomRadius}px)`
        context.drawImage(glowCanvas, 0, 0)
        context.restore()
      }

      if (activeFilter === "colors") {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data
        const palette = paletteColors.map(hexToRgb)
        const smartPalette = buildSmartPalette(palette)

        // Replace every pixel with a palette color chosen by color or brightness.
        for (let index = 0; index < pixels.length; index += 4) {
          const sourceColor: RgbColor = [
            pixels[index],
            pixels[index + 1],
            pixels[index + 2],
          ]
          const brightnessIndex =
            smartPalette.length === 1
              ? 0
              : Math.round(
                  (getLuminance(sourceColor) / 255) * (smartPalette.length - 1),
                )
          const nearestColor = smartColoring
            ? smartPalette[brightnessIndex]
            : findNearestColor(sourceColor, palette)

          pixels[index] = nearestColor[0]
          pixels[index + 1] = nearestColor[1]
          pixels[index + 2] = nearestColor[2]
        }

        context.putImageData(imageData, 0, 0)
      }
    }

    sourceImage.src = image.url

    return () => {
      cancelled = true
    }
  }, [
    activeFilter,
    bloomRadius,
    bloomStrength,
    bloomThreshold,
    image,
    noiseAmount,
    paletteColors,
    pixelSize,
    smartColoring,
  ])

  useEffect(() => {
    if (!image) {
      return
    }

    let cancelled = false
    const sourceImage = new window.Image()

    sourceImage.onload = () => {
      if (!cancelled) {
        setPaletteColors(extractCommonPalette(sourceImage, 3))
      }
    }

    sourceImage.src = image.url

    return () => {
      cancelled = true
    }
  }, [image])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const selectFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) {
      return
    }

    const nextImage = {
      name: file.name,
      url: URL.createObjectURL(file),
    }

    // Release the previous preview before replacing it with the new image.
    setImage((currentImage) => {
      if (currentImage) {
        URL.revokeObjectURL(currentImage.url)
      }

      return nextImage
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const clearImage = () => {
    setImage((currentImage) => {
      if (currentImage) {
        URL.revokeObjectURL(currentImage.url)
      }

      return null
    })

    setActiveFilter("none")
  }

  const addPaletteColor = () => {
    setPaletteColors((currentColors) => [...currentColors, "#ffffff"])
  }

  const updatePaletteColor = (colorIndex: number, nextColor: string) => {
    setPaletteColors((currentColors) =>
      currentColors.map((color, index) => (index === colorIndex ? nextColor : color)),
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

  return (
    <main className="flex min-h-screen bg-black text-sm text-zinc-300">
      <aside className="flex w-16 shrink-0 flex-col items-center justify-between border-r border-white/10 px-2 py-4 md:w-20">
        <div className="flex flex-col items-center gap-6">
          <button
            type="button"
            aria-label="Visual Lab home"
            className="grid size-10 place-items-center text-zinc-200 transition-colors hover:text-white"
          >
            <Aperture size={20} strokeWidth={1.5} />
          </button>

          <nav aria-label="Workspace sections" className="flex flex-col gap-3">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                title={label}
                className="group flex w-12 flex-col items-center gap-1 text-zinc-600 transition-colors hover:text-white md:w-14"
              >
                {/* Icons keep the rail compact while labels stay scannable. */}
                <Icon
                  size={18}
                  strokeWidth={1.4}
                  className="transition-transform duration-300 group-hover:-translate-y-0.5"
                />
                <span className="text-[10px] leading-none">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2 text-[10px] leading-none text-zinc-700">
          <span>VL</span>
          <span>01</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <section
          className="flex min-w-0 flex-1 items-center justify-center px-4 py-6 md:px-8"
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) {
              setIsDragging(false)
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            selectFile(event.dataTransfer.files[0])
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />

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
                    {activeFilter === "colors" && `${paletteColors.length} colors`}
                    {activeFilter === "none" && "source image"}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Remove image"
                  title="Remove image"
                  onClick={clearImage}
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
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="group flex flex-col items-center gap-2 text-zinc-500 transition-colors hover:text-white"
                >
                  <Upload
                    size={24}
                    strokeWidth={1.4}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5"
                  />
                  <span className="text-xs">Add image</span>
                </button>

                <div className="text-xs leading-5 text-zinc-700">
                  <div>drop an image here</div>
                  <div>or choose a file</div>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="shrink-0 border-t border-white/10 px-4 py-4 md:w-64 md:border-l md:border-t-0 md:py-5">
          <div className="flex flex-col gap-6 md:h-full md:gap-8">
            <div>
              <div className="text-xs text-zinc-500">Filters</div>
              <div className="mt-4 flex gap-4 md:flex-col md:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFilter("none")}
                  className={`text-left text-xs transition-colors ${
                    activeFilter === "none"
                      ? "text-white"
                      : "text-zinc-600 hover:text-white"
                  }`}
                >
                  None
                </button>
                <button
                  type="button"
                  disabled={!image}
                  onClick={() => setActiveFilter("pixelate")}
                  className={`text-left text-xs transition-colors disabled:cursor-not-allowed disabled:text-zinc-800 ${
                    activeFilter === "pixelate"
                      ? "text-white"
                      : "text-zinc-600 hover:text-white"
                  }`}
                >
                  Pixelation
                </button>
                <button
                  type="button"
                  disabled={!image}
                  onClick={() => setActiveFilter("noise")}
                  className={`text-left text-xs transition-colors disabled:cursor-not-allowed disabled:text-zinc-800 ${
                    activeFilter === "noise"
                      ? "text-white"
                      : "text-zinc-600 hover:text-white"
                  }`}
                >
                  Noise
                </button>
                <button
                  type="button"
                  disabled={!image}
                  onClick={() => setActiveFilter("bloom")}
                  className={`text-left text-xs transition-colors disabled:cursor-not-allowed disabled:text-zinc-800 ${
                    activeFilter === "bloom"
                      ? "text-white"
                      : "text-zinc-600 hover:text-white"
                  }`}
                >
                  Bloom
                </button>
                <button
                  type="button"
                  disabled={!image}
                  onClick={() => setActiveFilter("colors")}
                  className={`text-left text-xs transition-colors disabled:cursor-not-allowed disabled:text-zinc-800 ${
                    activeFilter === "colors"
                      ? "text-white"
                      : "text-zinc-600 hover:text-white"
                  }`}
                >
                  Colors
                </button>
              </div>
            </div>

            {activeFilter === "pixelate" && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-zinc-500">Pixel size</div>
                  <div className="mt-1 text-2xl text-zinc-300">{pixelSize}</div>
                  <p className="mt-2 text-xs leading-5 text-zinc-700">
                    Bigger numbers make chunkier square blocks.
                  </p>
                </div>

                <label className="flex flex-col gap-3 text-xs text-zinc-600">
                  Block size
                  <span className="text-zinc-700">
                    Slide right to make each square bigger.
                  </span>
                  <input
                    type="range"
                    min="2"
                    max="64"
                    step="1"
                    value={pixelSize}
                    onChange={(event) => setPixelSize(Number(event.target.value))}
                    className="w-full accent-zinc-200"
                  />
                </label>
              </div>
            )}

            {activeFilter === "noise" && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-zinc-500">Noise amount</div>
                  <div className="mt-1 text-2xl text-zinc-300">{noiseAmount}</div>
                  <p className="mt-2 text-xs leading-5 text-zinc-700">
                    Bigger numbers add more tiny speckles.
                  </p>
                </div>

                <label className="flex flex-col gap-3 text-xs text-zinc-600">
                  Strength
                  <span className="text-zinc-700">
                    Slide right to add more speckles.
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={noiseAmount}
                    onChange={(event) => setNoiseAmount(Number(event.target.value))}
                    className="w-full accent-zinc-200"
                  />
                </label>
              </div>
            )}

            {activeFilter === "bloom" && (
              <div className="flex flex-col gap-5">
                <div>
                  <div className="text-xs text-zinc-500">Bloom</div>
                  <div className="mt-1 text-2xl text-zinc-300">
                    {bloomStrength}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-700">
                    Bloom makes bright parts shine like a soft light.
                  </p>
                </div>

                <label className="flex flex-col gap-3 text-xs text-zinc-600">
                  Strength
                  <span className="text-zinc-700">
                    How strong the glow looks.
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    step="1"
                    value={bloomStrength}
                    onChange={(event) =>
                      setBloomStrength(Number(event.target.value))
                    }
                    className="w-full accent-zinc-200"
                  />
                </label>

                <label className="flex flex-col gap-3 text-xs text-zinc-600">
                  Threshold
                  <span className="text-zinc-700">
                    How bright a spot must be before it starts glowing.
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    step="1"
                    value={bloomThreshold}
                    onChange={(event) =>
                      setBloomThreshold(Number(event.target.value))
                    }
                    className="w-full accent-zinc-200"
                  />
                </label>

                <label className="flex flex-col gap-3 text-xs text-zinc-600">
                  Radius
                  <span className="text-zinc-700">
                    How far the glow spreads out.
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={bloomRadius}
                    onChange={(event) =>
                      setBloomRadius(Number(event.target.value))
                    }
                    className="w-full accent-zinc-200"
                  />
                </label>
              </div>
            )}

            {activeFilter === "colors" && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-zinc-500">Palette</div>
                  <div className="mt-1 text-2xl text-zinc-300">
                    {paletteColors.length}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-700">
                    The picture can only use these crayons.
                  </p>
                </div>

                <label className="flex items-start gap-3 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={smartColoring}
                    onChange={(event) => setSmartColoring(event.target.checked)}
                    className="mt-0.5 accent-zinc-200"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-zinc-500">Smart coloring</span>
                    <span className="leading-5 text-zinc-700">
                      Keep your colors, but stretch them into dark and light
                      versions so the picture stays easy to see.
                    </span>
                  </span>
                </label>

                <div className="flex flex-col gap-2">
                  {paletteColors.map((color, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <label className="flex min-w-0 flex-1 items-center gap-3 text-xs text-zinc-600">
                        <span
                          className="size-5 shrink-0 border border-white/10"
                          style={{ backgroundColor: color }}
                        />
                        <span className="sr-only">Palette color {index + 1}</span>
                        <input
                          type="color"
                          value={color}
                          onChange={(event) =>
                            updatePaletteColor(index, event.target.value)
                          }
                          className="h-8 w-full bg-transparent"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Delete color ${index + 1}`}
                        title="Delete color"
                        onClick={() => deletePaletteColor(index)}
                        disabled={paletteColors.length === 1}
                        className="grid size-8 place-items-center text-zinc-600 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-800"
                      >
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addPaletteColor}
                  className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
                >
                  <Plus size={15} strokeWidth={1.5} />
                  Add color
                </button>

                <button
                  type="button"
                  onClick={randomizePaletteColors}
                  className="w-fit text-xs text-zinc-600 transition-colors hover:text-white"
                >
                  Random colors
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
