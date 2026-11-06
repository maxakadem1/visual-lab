import type {
  FilterLayer,
  FilterLayerSettings,
  StackableFilter,
} from "../_types/editor"
import { filterDefinitionMap } from "./filter-registry"

export const defaultPalette = ["#000000", "#ffffff", "#808080"]

export const createLayerSettings = (
  paletteColors: string[] = defaultPalette,
): FilterLayerSettings => ({
  bloomRadius: 18,
  bloomStrength: 70,
  bloomThreshold: 190,
  ditherPattern: "bayer",
  ditherScale: 4,
  ditherStrength: 100,
  fisheyeRadius: 100,
  fisheyeStrength: 45,
  modulationAmplitude: 34,
  modulationDirection: "horizontal",
  modulationLineCount: 90,
  modulationThickness: 1,
  noiseAmount: 24,
  paletteColors: [...paletteColors],
  pixelSortDirection: "vertical",
  pixelSortThreshold: 160,
  pixelSize: 12,
  asciiCellSize: 10,
  asciiContrast: 120,
  asciiCustomCharacters: " .:-=+*#%@",
  asciiCustomCharactersEnabled: false,
  asciiInvert: false,
  scanLineOpacity: 35,
  scanLineSpacing: 8,
  scanLineThickness: 1,
  smartColoring: false,
  databendMode: "scramble",
  databendAmount: 30,
  databendQuality: 55,
  databendSeed: 7,
  databendAnimate: false,
  gravityLoose: "bright",
  gravityDirection: "down",
  gravityThreshold: 150,
  gravityFall: 35,
  gravityScatter: 45,
  gravityAnimate: false,
  slitDirection: "down",
  slitDelay: 40,
  moshBlockSize: 16,
  moshBoost: 100,
  moshBleed: 3,
  moshKeyframe: 0,
  feedbackBlend: "lighten",
  feedbackZoom: 96,
  feedbackRotate: 2,
  feedbackPersistence: 85,
  feedbackHue: 0,
  audioBand: "off",
  audioTarget: "",
  audioAmount: 60,
})

/** Fills settings added since a layer was saved, so old sessions keep working. */
export const normalizeLayers = (layers: FilterLayer[]): FilterLayer[] =>
  layers
    .filter((layer) => layer && layer.type in filterDefinitionMap)
    .map((layer) => ({
      ...layer,
      settings: { ...createLayerSettings(), ...layer.settings },
    }))

let layerCounter = 0

export const createLayerId = () => {
  layerCounter += 1
  return `layer-${Date.now().toString(36)}-${layerCounter}`
}

/* -------------------------------- Palettes ------------------------------- */

export type NamedPalette = { name: string; colors: string[] }

export const paletteLibrary: NamedPalette[] = [
  { name: "1-bit", colors: ["#000000", "#ffffff"] },
  { name: "Grayscale", colors: ["#000000", "#555555", "#aaaaaa", "#ffffff"] },
  { name: "Game Boy", colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { name: "Newsprint", colors: ["#1a1a1a", "#f2ecdf"] },
  { name: "CGA", colors: ["#000000", "#55ffff", "#ff55ff", "#ffffff"] },
  { name: "Green phosphor", colors: ["#001a00", "#00661a", "#33ff66", "#ccffdd"] },
  { name: "Amber CRT", colors: ["#0d0700", "#4d2a00", "#ff9900", "#ffd27a"] },
  { name: "Sepia", colors: ["#2b1d0e", "#6b4f2a", "#b08d57", "#e8d5a9"] },
  {
    name: "Vaporwave",
    colors: ["#2d1b4e", "#b967ff", "#ff71ce", "#01cdfe", "#05ffa1", "#fffb96"],
  },
  {
    name: "Sunset",
    colors: ["#1b1b3a", "#693668", "#a74482", "#f84aa7", "#ff3562", "#ffb26b"],
  },
  {
    name: "PICO-8",
    colors: [
      "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f",
      "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436",
      "#29adff", "#83769c", "#ff77a8", "#ffccaa",
    ],
  },
]

const palette = (name: string) =>
  paletteLibrary.find((entry) => entry.name === name)?.colors ?? defaultPalette

/* -------------------------------- Presets -------------------------------- */

export type PresetLayer = {
  type: StackableFilter
  visible?: boolean
  settings?: Partial<FilterLayerSettings>
}

export type Preset = {
  id: string
  name: string
  description: string
  /** Top layer first, same as the layer panel. */
  layers: PresetLayer[]
  custom?: boolean
}

export const builtInPresets: Preset[] = [
  {
    id: "game-boy",
    name: "Game Boy",
    description: "Four greens, ordered dither",
    layers: [
      {
        type: "dither",
        settings: { paletteColors: palette("Game Boy"), smartColoring: true, ditherScale: 3 },
      },
      { type: "pixelate", settings: { pixelSize: 4 } },
    ],
  },
  {
    id: "crt",
    name: "CRT",
    description: "Glow, grain and scan lines",
    layers: [
      { type: "scan-lines", settings: { scanLineSpacing: 4, scanLineThickness: 1, scanLineOpacity: 45 } },
      { type: "bloom", settings: { bloomStrength: 80, bloomThreshold: 165, bloomRadius: 14 } },
      { type: "noise", settings: { noiseAmount: 12 } },
    ],
  },
  {
    id: "newsprint",
    name: "Newsprint",
    description: "Halftone ink on paper",
    layers: [
      {
        type: "dither",
        settings: {
          ditherPattern: "dots",
          ditherScale: 4,
          paletteColors: palette("Newsprint"),
          smartColoring: true,
        },
      },
      { type: "noise", settings: { noiseAmount: 10 } },
    ],
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Green phosphor ASCII",
    layers: [
      { type: "colors", settings: { paletteColors: palette("Green phosphor"), smartColoring: true } },
      { type: "ascii", settings: { asciiCellSize: 9, asciiContrast: 140 } },
    ],
  },
  {
    id: "pico",
    name: "Pixel art",
    description: "Chunky pixels, PICO-8 colors",
    layers: [
      { type: "colors", settings: { paletteColors: palette("PICO-8") } },
      { type: "pixelate", settings: { pixelSize: 10 } },
    ],
  },
  {
    id: "glitch",
    name: "Glitch",
    description: "Sorted pixels and static",
    layers: [
      { type: "scan-lines", settings: { scanLineSpacing: 3, scanLineOpacity: 20 } },
      { type: "noise", settings: { noiseAmount: 18 } },
      { type: "pixel-sort", settings: { pixelSortThreshold: 120 } },
    ],
  },
  {
    id: "dreamy",
    name: "Dreamy",
    description: "Heavy bloom, soft lens",
    layers: [
      { type: "noise", settings: { noiseAmount: 8 } },
      { type: "bloom", settings: { bloomStrength: 130, bloomThreshold: 140, bloomRadius: 32 } },
      { type: "fisheye", settings: { fisheyeStrength: 18 } },
    ],
  },
  {
    id: "one-bit",
    name: "1-bit",
    description: "Pure black and white",
    layers: [
      {
        type: "dither",
        settings: { paletteColors: palette("1-bit"), smartColoring: true, ditherScale: 2 },
      },
    ],
  },
  {
    id: "vaporwave",
    name: "Vaporwave",
    description: "Neon palette, soft glow",
    layers: [
      { type: "scan-lines", settings: { scanLineSpacing: 5, scanLineOpacity: 25 } },
      { type: "colors", settings: { paletteColors: palette("Vaporwave"), smartColoring: true } },
      { type: "bloom", settings: { bloomStrength: 90, bloomThreshold: 170 } },
    ],
  },
  {
    id: "corrupted",
    name: "Corrupted",
    description: "A JPEG that went very wrong",
    layers: [
      { type: "scan-lines", settings: { scanLineSpacing: 3, scanLineOpacity: 18 } },
      { type: "databend", settings: { databendMode: "shift", databendAmount: 40, databendQuality: 40 } },
    ],
  },
  {
    id: "meltdown",
    name: "Meltdown",
    description: "Highlights drip and pile up",
    layers: [
      { type: "bloom", settings: { bloomStrength: 60, bloomThreshold: 200, bloomRadius: 10 } },
      { type: "gravity", settings: { gravityThreshold: 140, gravityFall: 45, gravityScatter: 60 } },
    ],
  },
  {
    id: "tunnel",
    name: "Tunnel",
    description: "Infinite spiraling echo",
    layers: [
      {
        type: "feedback",
        settings: { feedbackZoom: 92, feedbackRotate: 6, feedbackPersistence: 90, feedbackHue: 24 },
      },
    ],
  },
  {
    id: "mosh-pit",
    name: "Mosh pit",
    description: "Motion smears the last scene",
    layers: [
      { type: "noise", settings: { noiseAmount: 8 } },
      { type: "datamosh", settings: { moshBoost: 160, moshBleed: 2 } },
    ],
  },
  {
    id: "time-warp",
    name: "Time warp",
    description: "Slit-scan with a feedback glow",
    layers: [
      { type: "feedback", settings: { feedbackZoom: 100, feedbackRotate: 0, feedbackPersistence: 70 } },
      { type: "slit-scan", settings: { slitDelay: 60 } },
    ],
  },
]

export const presetSupportsMedia = (preset: Preset, kind: "image" | "video") =>
  preset.layers.every((layer) => filterDefinitionMap[layer.type][kind])

export const instantiatePreset = (
  preset: Pick<Preset, "layers">,
  sourcePalette: string[],
): FilterLayer[] =>
  preset.layers.map((layer) => ({
    id: createLayerId(),
    type: layer.type,
    visible: layer.visible ?? true,
    settings: {
      ...createLayerSettings(sourcePalette),
      ...layer.settings,
      paletteColors: [...(layer.settings?.paletteColors ?? sourcePalette)],
    },
  }))

/** Strips a live stack down to what differs from defaults. */
export const toPresetLayers = (layers: FilterLayer[]): PresetLayer[] => {
  const defaults = createLayerSettings()

  return layers.map((layer) => {
    const usesPalette = filterDefinitionMap[layer.type].controls.some(
      (control) => control.kind === "palette",
    )
    const settings: Partial<FilterLayerSettings> = {}
    const target = settings as Record<string, unknown>

    for (const key of Object.keys(layer.settings) as (keyof FilterLayerSettings)[]) {
      if (key === "paletteColors") {
        if (usesPalette) target[key] = [...layer.settings.paletteColors]
        continue
      }
      if (layer.settings[key] !== defaults[key]) target[key] = layer.settings[key]
    }

    return {
      type: layer.type,
      ...(layer.visible ? {} : { visible: false }),
      ...(Object.keys(settings).length ? { settings } : {}),
    }
  })
}

/* ------------------------------ Share links ------------------------------ */

const shareKey = "look"

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export const buildShareUrl = (layers: FilterLayer[]) => {
  const payload = toBase64Url(JSON.stringify({ v: 1, l: toPresetLayers(layers) }))
  return `${window.location.origin}${window.location.pathname}#${shareKey}=${payload}`
}

export const readSharedLayers = (hash: string): PresetLayer[] | null => {
  const match = new URLSearchParams(hash.replace(/^#/, "")).get(shareKey)
  if (!match) return null

  try {
    const parsed = JSON.parse(fromBase64Url(match)) as { v: number; l: PresetLayer[] }
    return sanitizePresetLayers(parsed.l)
  } catch {
    return null
  }
}

/** Drops unknown types and settings with the wrong value type. */
export const sanitizePresetLayers = (input: unknown): PresetLayer[] | null => {
  if (!Array.isArray(input)) return null
  const defaults = createLayerSettings()

  const layers = input.flatMap((raw): PresetLayer[] => {
    if (!raw || typeof raw !== "object") return []
    const { type, visible, settings } = raw as Record<string, unknown>
    if (typeof type !== "string" || !(type in filterDefinitionMap)) return []

    const clean: Record<string, unknown> = {}
    if (settings && typeof settings === "object") {
      for (const [key, value] of Object.entries(settings)) {
        if (!(key in defaults)) continue
        const expected = defaults[key as keyof FilterLayerSettings]
        if (Array.isArray(expected)) {
          if (Array.isArray(value) && value.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))) {
            clean[key] = value.slice(0, 32)
          }
        } else if (typeof value === typeof expected) {
          clean[key] = value
        }
      }
    }

    return [
      {
        type: type as StackableFilter,
        visible: visible !== false,
        settings: clean as Partial<FilterLayerSettings>,
      },
    ]
  })

  return layers.length ? layers.slice(0, 24) : null
}
