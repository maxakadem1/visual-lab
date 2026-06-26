export type ActiveFilter =
  | "none"
  | "pixelate"
  | "noise"
  | "bloom"
  | "colors"
  | "dither"
  | "fisheye"
  | "pixel-sort"
  | "scan-lines"
  | "modulation"
  | "ascii"

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
  pixelSortDirection: "horizontal" | "vertical"
  pixelSortThreshold: number
  pixelSize: number
  asciiCellSize: number
  asciiContrast: number
  asciiCustomCharacters: string
  asciiCustomCharactersEnabled: boolean
  asciiInvert: boolean
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
  pixelSortDirection: "horizontal" | "vertical"
  pixelSortThreshold: number
  pixelSize: number
  asciiCellSize: number
  asciiContrast: number
  asciiCustomCharacters: string
  asciiCustomCharactersEnabled: boolean
  asciiInvert: boolean
  scanLineOpacity: number
  scanLineSpacing: number
  scanLineThickness: number
  smartColoring: boolean
}

export type RgbColor = [number, number, number]
