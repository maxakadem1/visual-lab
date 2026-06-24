import type { FilterSettings, RgbColor } from "../_types/editor"
import {
  buildSmartPalette,
  findNearestColor,
  getLuminance,
  hexToRgb,
} from "./color"

const filterOrder = [
  "pixelate",
  "noise",
  "bloom",
  "colors",
  "scan-lines",
  "modulation",
] as const

const applyPixelation = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pixelSize: number,
) => {
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
  sampleContext.drawImage(canvas, 0, 0, sampleWidth, sampleHeight)
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
}

const applyNoise = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  noiseAmount: number,
) => {
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

const applyBloom = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterSettings,
) => {
  const glowCanvas = document.createElement("canvas")
  const glowContext = glowCanvas.getContext("2d")

  if (!glowContext) {
    return
  }

  glowCanvas.width = canvas.width
  glowCanvas.height = canvas.height
  glowContext.drawImage(canvas, 0, 0)

  const glowData = glowContext.getImageData(0, 0, canvas.width, canvas.height)
  const glowPixels = glowData.data

  // Keep only bright pixels so the blur spreads highlights, not shadows.
  for (let index = 0; index < glowPixels.length; index += 4) {
    const brightness =
      glowPixels[index] * 0.2126 +
      glowPixels[index + 1] * 0.7152 +
      glowPixels[index + 2] * 0.0722

    if (brightness < settings.bloomThreshold) {
      glowPixels[index + 3] = 0
    }
  }

  glowContext.putImageData(glowData, 0, 0)
  context.save()
  context.globalAlpha = settings.bloomStrength / 100
  context.globalCompositeOperation = "screen"
  context.filter = `blur(${settings.bloomRadius}px)`
  context.drawImage(glowCanvas, 0, 0)
  context.restore()
}

const applyColorLimit = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterSettings,
) => {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const palette = settings.paletteColors.map(hexToRgb)
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
        : Math.round((getLuminance(sourceColor) / 255) * (smartPalette.length - 1))
    const nearestColor = settings.smartColoring
      ? smartPalette[brightnessIndex]
      : findNearestColor(sourceColor, palette)

    pixels[index] = nearestColor[0]
    pixels[index + 1] = nearestColor[1]
    pixels[index + 2] = nearestColor[2]
  }

  context.putImageData(imageData, 0, 0)
}

const applyScanLines = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterSettings,
) => {
  context.save()
  context.globalAlpha = settings.scanLineOpacity / 100
  context.fillStyle = "#000000"

  // Draw dark horizontal bands over the image like an old display.
  for (let y = 0; y < canvas.height; y += settings.scanLineSpacing) {
    context.fillRect(0, y, canvas.width, settings.scanLineThickness)
  }

  context.restore()
}

const applyModulation = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterSettings,
) => {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data

  const lineCount = Math.max(1, settings.modulationLineCount)
  const sourceCanvas = document.createElement("canvas")
  const sourceContext = sourceCanvas.getContext("2d")

  if (!sourceContext) {
    return
  }

  sourceCanvas.width = canvas.width
  sourceCanvas.height = canvas.height

  // Snapshot the current pipeline result before redrawing it as displaced strips.
  sourceContext.drawImage(canvas, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)

  if (settings.modulationDirection === "horizontal") {
    const spacing = canvas.height / lineCount

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const y = Math.round(lineIndex * spacing)
      const height = Math.min(settings.modulationThickness, canvas.height - y)

      if (height <= 0) {
        continue
      }

      for (let x = 0; x < canvas.width; x += 2) {
        const pixelIndex = (y * canvas.width + x) * 4
        const brightness =
          pixels[pixelIndex] * 0.2126 +
          pixels[pixelIndex + 1] * 0.7152 +
          pixels[pixelIndex + 2] * 0.0722
        const offset = ((brightness / 255) - 0.5) * settings.modulationAmplitude

        context.drawImage(sourceCanvas, x, y, 2, height, x, y + offset, 2, height)
      }
    }

    return
  }

  const spacing = canvas.width / lineCount

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const x = Math.round(lineIndex * spacing)
    const width = Math.min(settings.modulationThickness, canvas.width - x)

    if (width <= 0) {
      continue
    }

    for (let y = 0; y < canvas.height; y += 2) {
      const pixelIndex = (y * canvas.width + x) * 4
      const brightness =
        pixels[pixelIndex] * 0.2126 +
        pixels[pixelIndex + 1] * 0.7152 +
        pixels[pixelIndex + 2] * 0.0722
      const offset = ((brightness / 255) - 0.5) * settings.modulationAmplitude

      context.drawImage(sourceCanvas, x, y, width, 2, x + offset, y, width, 2)
    }
  }
}

export const drawFilteredImage = (
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  settings: FilterSettings,
  options: { renderScale?: number } = {},
) => {
  const outputContext = canvas.getContext("2d")

  if (!outputContext) {
    return
  }

  const renderScale = Math.max(0.1, Math.min(1, options.renderScale ?? 1))
  const renderWidth = Math.max(1, Math.round(sourceWidth * renderScale))
  const renderHeight = Math.max(1, Math.round(sourceHeight * renderScale))
  const renderCanvas =
    renderScale === 1 ? canvas : document.createElement("canvas")
  const context = renderCanvas.getContext("2d")
  const renderSettings = {
    ...settings,
    bloomRadius: settings.bloomRadius * renderScale,
    modulationAmplitude: settings.modulationAmplitude * renderScale,
    modulationThickness: Math.max(
      1,
      Math.round(settings.modulationThickness * renderScale),
    ),
    pixelSize: Math.max(1, Math.round(settings.pixelSize * renderScale)),
    scanLineSpacing: Math.max(
      1,
      Math.round(settings.scanLineSpacing * renderScale),
    ),
    scanLineThickness: Math.max(
      1,
      Math.round(settings.scanLineThickness * renderScale),
    ),
  }

  if (!context) {
    return
  }

  renderCanvas.width = renderWidth
  renderCanvas.height = renderHeight
  canvas.width = sourceWidth
  canvas.height = sourceHeight
  context.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
  context.drawImage(source, 0, 0, renderCanvas.width, renderCanvas.height)

  // Apply the enabled filters in one stable order until reordering is added.
  for (const filter of filterOrder) {
    if (!settings.activeFilters.includes(filter)) {
      continue
    }

    if (filter === "pixelate") {
      applyPixelation(context, renderCanvas, renderSettings.pixelSize)
    }

    if (filter === "noise") {
      applyNoise(context, renderCanvas, renderSettings.noiseAmount)
    }

    if (filter === "bloom") {
      applyBloom(context, renderCanvas, renderSettings)
    }

    if (filter === "colors") {
      applyColorLimit(context, renderCanvas, renderSettings)
    }

    if (filter === "scan-lines") {
      applyScanLines(context, renderCanvas, renderSettings)
    }

    if (filter === "modulation") {
      applyModulation(context, renderCanvas, renderSettings)
    }
  }

  if (renderCanvas !== canvas) {
    outputContext.clearRect(0, 0, canvas.width, canvas.height)
    outputContext.imageSmoothingEnabled = true
    outputContext.drawImage(renderCanvas, 0, 0, canvas.width, canvas.height)
  }
}
