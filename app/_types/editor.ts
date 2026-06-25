export type ActiveFilter =
  | "none"
  | "pixelate"
  | "noise"
  | "bloom"
  | "colors"
  | "dither"
  | "fisheye"
  | "scan-lines"
  | "modulation"

export type StackableFilter = Exclude<ActiveFilter, "none">

export type EditorMedia = {
  kind: "image" | "video"
  name: string
  url: string
}

export type FilterLayerSettings = {
  bloomRadius: number
  bloomStrength: number
  bloomThreshold: number
  ditherPattern: "bayer" | "dots"
  ditherScale: number
  ditherStrength: number
  fisheyeRadius: number
  fisheyeStrength: number
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

export type FilterLayer = {
  id: string
  type: StackableFilter
  visible: boolean
  settings: FilterLayerSettings
}

export type FilterSettings = {
  activeFilters: StackableFilter[]
  bloomRadius: number
  bloomStrength: number
  bloomThreshold: number
  ditherPattern: "bayer" | "dots"
  ditherScale: number
  ditherStrength: number
  fisheyeRadius: number
  fisheyeStrength: number
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
