import type { FilterLayer, FilterLayerSettings, RgbColor } from "../_types/editor"
import {
  buildSmartPalette,
  findNearestColor,
  getLuminance,
  hexToRgb,
} from "./color"

const bayerMatrix = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const clampColor = (value: number) => Math.max(0, Math.min(255, value))

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

const clampCoordinate = (value: number, max: number) =>
  Math.max(0, Math.min(max, value))

const sampleBilinear = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
) => {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const right = Math.min(width - 1, left + 1)
  const bottom = Math.min(height - 1, top + 1)
  const xWeight = x - left
  const yWeight = y - top
  const topLeft = pixels[(top * width + left) * 4 + channel]
  const topRight = pixels[(top * width + right) * 4 + channel]
  const bottomLeft = pixels[(bottom * width + left) * 4 + channel]
  const bottomRight = pixels[(bottom * width + right) * 4 + channel]
  const topValue = topLeft * (1 - xWeight) + topRight * xWeight
  const bottomValue = bottomLeft * (1 - xWeight) + bottomRight * xWeight

  return topValue * (1 - yWeight) + bottomValue * yWeight
}

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
  settings: FilterLayerSettings,
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
  settings: FilterLayerSettings,
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

const getDitherThreshold = (
  x: number,
  y: number,
  settings: FilterLayerSettings,
) => {
  const scale = Math.max(1, settings.ditherScale)
  const cellX = Math.floor(x / scale)
  const cellY = Math.floor(y / scale)

  if (settings.ditherPattern === "bayer") {
    const threshold = bayerMatrix[cellY % 4][cellX % 4]

    return (threshold + 0.5) / 16 - 0.5
  }

  const localX = (x % scale) / scale - 0.5
  const localY = (y % scale) / scale - 0.5
  const distance = Math.min(1, Math.hypot(localX, localY) * 2)

  return 0.5 - distance
}

const applyDither = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
) => {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const palette = settings.paletteColors.map(hexToRgb)
  const smartPalette = settings.smartColoring ? buildSmartPalette(palette) : palette
  const strength = settings.ditherStrength / 100

  // Offset each pixel before palette matching so the matrix creates texture.
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixelIndex = (y * canvas.width + x) * 4
      const threshold = getDitherThreshold(x, y, settings) * 96
      const sourceColor: RgbColor = [
        pixels[pixelIndex],
        pixels[pixelIndex + 1],
        pixels[pixelIndex + 2],
      ]
      const adjustedColor: RgbColor = [
        clampColor(sourceColor[0] + threshold),
        clampColor(sourceColor[1] + threshold),
        clampColor(sourceColor[2] + threshold),
      ]
      const targetColor = findNearestColor(adjustedColor, smartPalette)

      pixels[pixelIndex] = sourceColor[0] * (1 - strength) + targetColor[0] * strength
      pixels[pixelIndex + 1] =
        sourceColor[1] * (1 - strength) + targetColor[1] * strength
      pixels[pixelIndex + 2] =
        sourceColor[2] * (1 - strength) + targetColor[2] * strength
    }
  }

  context.putImageData(imageData, 0, 0)
}

const applyFisheye = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
) => {
  const sourceData = context.getImageData(0, 0, canvas.width, canvas.height)
  const outputData = context.createImageData(canvas.width, canvas.height)
  const sourcePixels = sourceData.data
  const outputPixels = outputData.data
  const centerX = (canvas.width - 1) / 2
  const centerY = (canvas.height - 1) / 2
  const maxRadius = Math.hypot(canvas.width, canvas.height) / 2
  const lensRadius = Math.max(1, maxRadius * (settings.fisheyeRadius / 100))
  const strength = settings.fisheyeStrength / 100

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const outputIndex = (y * canvas.width + x) * 4
      const offsetX = x - centerX
      const offsetY = y - centerY
      const distance = Math.hypot(offsetX, offsetY)

      if (distance > lensRadius || strength === 0) {
        outputPixels[outputIndex] = sourcePixels[outputIndex]
        outputPixels[outputIndex + 1] = sourcePixels[outputIndex + 1]
        outputPixels[outputIndex + 2] = sourcePixels[outputIndex + 2]
        outputPixels[outputIndex + 3] = sourcePixels[outputIndex + 3]
        continue
      }

      const normalizedDistance = distance / lensRadius
      // Pull samples toward the center so the rendered image bulges outward.
      const sourceDistance =
        normalizedDistance *
        (1 - strength * (1 - normalizedDistance * normalizedDistance))
      const scale = distance === 0 ? 0 : sourceDistance / normalizedDistance
      const sourceX = clampCoordinate(centerX + offsetX * scale, canvas.width - 1)
      const sourceY = clampCoordinate(centerY + offsetY * scale, canvas.height - 1)

      for (let channel = 0; channel < 4; channel += 1) {
        outputPixels[outputIndex + channel] = sampleBilinear(
          sourcePixels,
          canvas.width,
          canvas.height,
          sourceX,
          sourceY,
          channel,
        )
      }
    }
  }

  context.putImageData(outputData, 0, 0)
}

const getPixelBrightness = (pixels: Uint8ClampedArray, index: number) =>
  pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722

const sortPixelRun = (
  sourcePixels: Uint8ClampedArray,
  outputPixels: Uint8ClampedArray,
  runIndexes: number[],
) => {
  const sortedPixels = runIndexes
    .map((index) => ({
      alpha: sourcePixels[index + 3],
      brightness: getPixelBrightness(sourcePixels, index),
      blue: sourcePixels[index + 2],
      green: sourcePixels[index + 1],
      red: sourcePixels[index],
    }))
    .sort((left, right) => left.brightness - right.brightness)

  // Write the sorted colors back into the original contiguous run positions.
  runIndexes.forEach((index, pixelIndex) => {
    const pixel = sortedPixels[pixelIndex]

    outputPixels[index] = pixel.red
    outputPixels[index + 1] = pixel.green
    outputPixels[index + 2] = pixel.blue
    outputPixels[index + 3] = pixel.alpha
  })
}

const flushPixelSortRun = (
  sourcePixels: Uint8ClampedArray,
  outputPixels: Uint8ClampedArray,
  runIndexes: number[],
) => {
  if (runIndexes.length > 1) {
    sortPixelRun(sourcePixels, outputPixels, runIndexes)
  }

  runIndexes.length = 0
}

const applyPixelSort = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
) => {
  const sourceData = context.getImageData(0, 0, canvas.width, canvas.height)
  const outputData = context.createImageData(canvas.width, canvas.height)
  const sourcePixels = sourceData.data
  const outputPixels = outputData.data
  const threshold = settings.pixelSortThreshold

  outputPixels.set(sourcePixels)

  if (settings.pixelSortDirection === "horizontal") {
    for (let y = 0; y < canvas.height; y += 1) {
      const runIndexes: number[] = []

      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4

        if (getPixelBrightness(sourcePixels, index) >= threshold) {
          runIndexes.push(index)
          continue
        }

        flushPixelSortRun(sourcePixels, outputPixels, runIndexes)
      }

      flushPixelSortRun(sourcePixels, outputPixels, runIndexes)
    }
  } else {
    for (let x = 0; x < canvas.width; x += 1) {
      const runIndexes: number[] = []

      for (let y = 0; y < canvas.height; y += 1) {
        const index = (y * canvas.width + x) * 4

        if (getPixelBrightness(sourcePixels, index) >= threshold) {
          runIndexes.push(index)
          continue
        }

        flushPixelSortRun(sourcePixels, outputPixels, runIndexes)
      }

      flushPixelSortRun(sourcePixels, outputPixels, runIndexes)
    }
  }

  context.putImageData(outputData, 0, 0)
}

const applyScanLines = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
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
  settings: FilterLayerSettings,
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

const applyAscii = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
) => {
  const sourceData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = sourceData.data
  const cellSize = Math.max(4, settings.asciiCellSize)
  const defaultRamp = " .:-=+*#%@"
  const customRamp = settings.asciiCustomCharacters.trim()
  const baseRamp =
    settings.asciiCustomCharactersEnabled && customRamp.length > 1
      ? customRamp
      : defaultRamp
  const ramp = settings.asciiInvert ? [...baseRamp].reverse().join("") : baseRamp
  const contrast = settings.asciiContrast / 100

  context.save()
  context.fillStyle = settings.asciiInvert ? "#ffffff" : "#000000"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = `${Math.max(4, Math.round(cellSize * 0.9))}px monospace`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = settings.asciiInvert ? "#000000" : "#ffffff"

  for (let y = 0; y < canvas.height; y += cellSize) {
    for (let x = 0; x < canvas.width; x += cellSize) {
      let totalLuminance = 0
      let sampleCount = 0
      const sampleRight = Math.min(canvas.width, x + cellSize)
      const sampleBottom = Math.min(canvas.height, y + cellSize)

      // Average each cell so the chosen glyph represents local brightness.
      for (let sampleY = y; sampleY < sampleBottom; sampleY += 1) {
        for (let sampleX = x; sampleX < sampleRight; sampleX += 1) {
          const index = (sampleY * canvas.width + sampleX) * 4

          totalLuminance +=
            pixels[index] * 0.2126 +
            pixels[index + 1] * 0.7152 +
            pixels[index + 2] * 0.0722
          sampleCount += 1
        }
      }

      const luminance = totalLuminance / Math.max(1, sampleCount)
      const adjustedTone = clampUnit(((luminance / 255) - 0.5) * contrast + 0.5)
      const charIndex = Math.round(adjustedTone * (ramp.length - 1))

      context.fillText(
        ramp[charIndex],
        x + (sampleRight - x) / 2,
        y + (sampleBottom - y) / 2,
      )
    }
  }

  context.restore()
}

export const drawFilteredImage = (
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  settings: { filterLayers: FilterLayer[] },
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

  if (!context) {
    return
  }

  renderCanvas.width = renderWidth
  renderCanvas.height = renderHeight
  canvas.width = renderWidth
  canvas.height = renderHeight
  context.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
  context.drawImage(source, 0, 0, renderCanvas.width, renderCanvas.height)

  // The panel lists top layers first, so render from the bottom upward.
  for (const layer of [...settings.filterLayers].reverse()) {
    if (!layer.visible) {
      continue
    }

    const renderSettings = {
      ...layer.settings,
      bloomRadius: layer.settings.bloomRadius * renderScale,
      ditherScale: Math.max(1, Math.round(layer.settings.ditherScale * renderScale)),
      modulationAmplitude: layer.settings.modulationAmplitude * renderScale,
      modulationThickness: Math.max(
        1,
        Math.round(layer.settings.modulationThickness * renderScale),
      ),
      pixelSize: Math.max(1, Math.round(layer.settings.pixelSize * renderScale)),
      asciiCellSize: Math.max(
        4,
        Math.round(layer.settings.asciiCellSize * renderScale),
      ),
      scanLineSpacing: Math.max(
        1,
        Math.round(layer.settings.scanLineSpacing * renderScale),
      ),
      scanLineThickness: Math.max(
        1,
        Math.round(layer.settings.scanLineThickness * renderScale),
      ),
    }

    if (layer.type === "pixelate") {
      applyPixelation(context, renderCanvas, renderSettings.pixelSize)
    }

    if (layer.type === "noise") {
      applyNoise(context, renderCanvas, renderSettings.noiseAmount)
    }

    if (layer.type === "bloom") {
      applyBloom(context, renderCanvas, renderSettings)
    }

    if (layer.type === "colors") {
      applyColorLimit(context, renderCanvas, renderSettings)
    }

    if (layer.type === "dither") {
      applyDither(context, renderCanvas, renderSettings)
    }

    if (layer.type === "fisheye") {
      applyFisheye(context, renderCanvas, renderSettings)
    }

    if (layer.type === "pixel-sort") {
      applyPixelSort(context, renderCanvas, renderSettings)
    }

    if (layer.type === "scan-lines") {
      applyScanLines(context, renderCanvas, renderSettings)
    }

    if (layer.type === "modulation") {
      applyModulation(context, renderCanvas, renderSettings)
    }

    if (layer.type === "ascii") {
      applyAscii(context, renderCanvas, renderSettings)
    }
  }

  if (renderCanvas !== canvas) {
    outputContext.clearRect(0, 0, canvas.width, canvas.height)
    outputContext.imageSmoothingEnabled = true
    outputContext.drawImage(renderCanvas, 0, 0, canvas.width, canvas.height)
  }
}
