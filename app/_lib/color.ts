import type { RgbColor } from "../_types/editor"

export const getColorDistance = (left: RgbColor, right: RgbColor) => {
  return (
    (left[0] - right[0]) ** 2 +
    (left[1] - right[1]) ** 2 +
    (left[2] - right[2]) ** 2
  )
}

export const findNearestColor = (color: RgbColor, palette: RgbColor[]) => {
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

export const rgbToHex = ([red, green, blue]: RgbColor) => {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`
}

export const hexToRgb = (hexColor: string): RgbColor => {
  return [
    Number.parseInt(hexColor.slice(1, 3), 16),
    Number.parseInt(hexColor.slice(3, 5), 16),
    Number.parseInt(hexColor.slice(5, 7), 16),
  ]
}

export const getRandomHexColor = () => {
  const randomValue = Math.floor(Math.random() * 0xffffff)

  return `#${randomValue.toString(16).padStart(6, "0")}`
}

export const getLuminance = ([red, green, blue]: RgbColor) => {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

export const normalizeColorToLuminance = (
  color: RgbColor,
  targetLuminance: number,
) => {
  const currentLuminance = Math.max(1, getLuminance(color))
  const scale = targetLuminance / currentLuminance

  return color.map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * scale))),
  ) as RgbColor
}

export const buildSmartPalette = (palette: RgbColor[]) => {
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

export const extractCommonPalette = (
  sourceImage: HTMLImageElement,
  colorCount: number,
) => {
  const sampleCanvas = document.createElement("canvas")
  const sampleContext = sampleCanvas.getContext("2d")

  if (!sampleContext) {
    return Array.from({ length: colorCount }, () => "#000000")
  }

  sampleCanvas.width = Math.min(240, sourceImage.naturalWidth)
  sampleCanvas.height = Math.max(
    1,
    Math.round(
      (sampleCanvas.width / sourceImage.naturalWidth) *
        sourceImage.naturalHeight,
    ),
  )
  sampleContext.drawImage(
    sourceImage,
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height,
  )

  const pixels = sampleContext.getImageData(
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height,
  ).data
  const buckets = new Map<
    string,
    { blue: number; count: number; green: number; red: number }
  >()

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
