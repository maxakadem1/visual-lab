export type ActiveFilter =
  | "none"
  | "pixelate"
  | "noise"
  | "bloom"
  | "colors"
  | "scan-lines"
  | "modulation"

export type StackableFilter = Exclude<ActiveFilter, "none">

export type EditorMedia = {
  kind: "image" | "video"
  name: string
  url: string
}

export type FilterSettings = {
  activeFilters: StackableFilter[]
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
