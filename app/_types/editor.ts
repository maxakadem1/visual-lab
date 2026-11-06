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
  | "databend"
  | "gravity"
  | "slit-scan"
  | "datamosh"
  | "feedback"

export type StackableFilter = Exclude<ActiveFilter, "none">

export type EditorMedia = {
  kind: "image" | "video"
  name: string
  url: string
}

export type AudioBand = "off" | "low" | "mid" | "high" | "beat"

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
  databendMode: "scramble" | "shift" | "tables"
  databendAmount: number
  databendQuality: number
  databendSeed: number
  databendAnimate: boolean
  gravityLoose: "bright" | "dark"
  gravityDirection: "down" | "up" | "left" | "right"
  gravityThreshold: number
  gravityFall: number
  gravityScatter: number
  gravityAnimate: boolean
  slitDirection: "down" | "up" | "right" | "left"
  slitDelay: number
  moshBlockSize: number
  moshBoost: number
  moshBleed: number
  moshKeyframe: number
  feedbackBlend: "lighten" | "screen" | "difference" | "mix"
  feedbackZoom: number
  feedbackRotate: number
  feedbackPersistence: number
  feedbackHue: number
  audioBand: AudioBand
  /** A numeric setting of this layer's filter; empty means the filter's default. */
  audioTarget: string
  audioAmount: number
}

export type FilterLayer = {
  id: string
  type: StackableFilter
  visible: boolean
  settings: FilterLayerSettings
}

/** Flattened settings for the single-pass video shader. */
export type FilterSettings = FilterLayerSettings & {
  activeFilters: StackableFilter[]
}

export type RgbColor = [number, number, number]
