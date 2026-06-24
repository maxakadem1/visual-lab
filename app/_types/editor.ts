export type ActiveFilter =
  | "none"
  | "pixelate"
  | "noise"
  | "bloom"
  | "colors"
  | "scan-lines"
  | "modulation"

export type EditorImage = {
  name: string
  url: string
}

export type FilterSettings = {
  activeFilter: ActiveFilter
  bloomRadius: number
  bloomStrength: number
  bloomThreshold: number
  modulationAmplitude: number
  modulationDirection: "horizontal" | "vertical"
  modulationLineCount: number
  modulationThickness: number
  noiseAmount: number
  paletteColors: string[]
  pixelSize: number
  scanLineOpacity: number
  scanLineSpacing: number
  scanLineThickness: number
  smartColoring: boolean
}

export type RgbColor = [number, number, number]
