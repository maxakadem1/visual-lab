import {
  ArrowDownToLine,
  ArrowDownWideNarrow,
  Binary,
  Blend,
  Grid3x3,
  Hourglass,
  Orbit,
  Palette,
  Rows3,
  ScanEye,
  Sparkles,
  Sun,
  Type,
  Waves,
  Waypoints,
  type LucideIcon,
} from "lucide-react"

import type { FilterLayerSettings, StackableFilter } from "../_types/editor"

type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T]

export type NumericKey = KeysOfType<FilterLayerSettings, number>
type BooleanKey = KeysOfType<FilterLayerSettings, boolean>
type StringKey = KeysOfType<FilterLayerSettings, string>

export type FilterControl =
  | {
      kind: "range"
      key: NumericKey
      label: string
      min: number
      max: number
      step?: number
      unit?: string
    }
  | {
      kind: "segment"
      key: StringKey
      label: string
      options: { value: string; label: string }[]
    }
  | { kind: "switch"; key: BooleanKey; label: string; hint?: string }
  | { kind: "text"; key: StringKey; label: string; showWhen?: BooleanKey }
  | { kind: "seed"; key: NumericKey; label: string }
  | { kind: "palette" }

export type FilterDefinition = {
  type: StackableFilter
  label: string
  description: string
  icon: LucideIcon
  /** Works on still images. Temporal effects need a moving picture. */
  image: boolean
  video: boolean
  /** Rendered by the single-pass WebGL video shader. Others use the Canvas 2D path. */
  gpu: boolean
  /** Feeds on earlier frames, so it only does something on playing video. */
  temporal?: boolean
  /** The setting audio-reactive mode drives unless the layer picks another. */
  reactiveKey?: NumericKey
  controls: FilterControl[]
}

const directionOptions = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
]

export const filterDefinitions: FilterDefinition[] = [
  {
    type: "pixelate",
    label: "Pixelate",
    description: "Snap the image to a coarse block grid",
    icon: Grid3x3,
    image: true,
    video: true,
    gpu: true,
    reactiveKey: "pixelSize",
    controls: [
      { kind: "range", key: "pixelSize", label: "Block size", min: 2, max: 64, unit: "px" },
    ],
  },
  {
    type: "noise",
    label: "Noise",
    description: "Film-like luminance grain",
    icon: Sparkles,
    image: true,
    video: true,
    gpu: true,
    reactiveKey: "noiseAmount",
    controls: [
      { kind: "range", key: "noiseAmount", label: "Strength", min: 0, max: 100, unit: "%" },
    ],
  },
  {
    type: "bloom",
    label: "Bloom",
    description: "Soft glow around bright highlights",
    icon: Sun,
    image: true,
    video: true,
    gpu: true,
    reactiveKey: "bloomStrength",
    controls: [
      { kind: "range", key: "bloomStrength", label: "Strength", min: 0, max: 150, unit: "%" },
      { kind: "range", key: "bloomThreshold", label: "Threshold", min: 0, max: 255 },
      { kind: "range", key: "bloomRadius", label: "Radius", min: 0, max: 60, unit: "px" },
    ],
  },
  {
    type: "colors",
    label: "Colors",
    description: "Remap pixels to a fixed palette",
    icon: Palette,
    image: true,
    video: true,
    gpu: true,
    controls: [
      {
        kind: "switch",
        key: "smartColoring",
        label: "Smart coloring",
        hint: "Match palette by luminance order",
      },
      { kind: "palette" },
    ],
  },
  {
    type: "dither",
    label: "Dither",
    description: "Ordered dithering with a palette",
    icon: Blend,
    image: true,
    video: false,
    gpu: false,
    reactiveKey: "ditherScale",
    controls: [
      {
        kind: "segment",
        key: "ditherPattern",
        label: "Pattern",
        options: [
          { value: "bayer", label: "Bayer" },
          { value: "dots", label: "Dots" },
        ],
      },
      { kind: "range", key: "ditherScale", label: "Scale", min: 1, max: 24, unit: "x" },
      { kind: "range", key: "ditherStrength", label: "Strength", min: 0, max: 100, unit: "%" },
      {
        kind: "switch",
        key: "smartColoring",
        label: "Smart coloring",
        hint: "Match palette by luminance order",
      },
      { kind: "palette" },
    ],
  },
  {
    type: "fisheye",
    label: "Fisheye",
    description: "Barrel lens distortion",
    icon: ScanEye,
    image: true,
    video: false,
    gpu: false,
    reactiveKey: "fisheyeStrength",
    controls: [
      { kind: "range", key: "fisheyeStrength", label: "Strength", min: 0, max: 100, unit: "%" },
      { kind: "range", key: "fisheyeRadius", label: "Radius", min: 10, max: 100, unit: "%" },
    ],
  },
  {
    type: "pixel-sort",
    label: "Pixel sort",
    description: "Sort pixel runs by brightness",
    icon: ArrowDownWideNarrow,
    image: true,
    video: false,
    gpu: false,
    reactiveKey: "pixelSortThreshold",
    controls: [
      {
        kind: "segment",
        key: "pixelSortDirection",
        label: "Direction",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
      { kind: "range", key: "pixelSortThreshold", label: "Threshold", min: 0, max: 255 },
    ],
  },
  {
    type: "scan-lines",
    label: "Scan lines",
    description: "CRT-style horizontal lines",
    icon: Rows3,
    image: true,
    video: true,
    gpu: true,
    reactiveKey: "scanLineOpacity",
    controls: [
      { kind: "range", key: "scanLineSpacing", label: "Spacing", min: 2, max: 32, unit: "px" },
      { kind: "range", key: "scanLineThickness", label: "Thickness", min: 1, max: 12, unit: "px" },
      { kind: "range", key: "scanLineOpacity", label: "Opacity", min: 0, max: 100, unit: "%" },
    ],
  },
  {
    type: "modulation",
    label: "Modulation",
    description: "Wave-displaced line rendering",
    icon: Waves,
    image: true,
    video: true,
    gpu: true,
    reactiveKey: "modulationAmplitude",
    controls: [
      {
        kind: "segment",
        key: "modulationDirection",
        label: "Direction",
        options: directionOptions,
      },
      { kind: "range", key: "modulationLineCount", label: "Lines", min: 10, max: 220 },
      { kind: "range", key: "modulationAmplitude", label: "Amplitude", min: 0, max: 90 },
      { kind: "range", key: "modulationThickness", label: "Thickness", min: 1, max: 16, unit: "px" },
    ],
  },
  {
    type: "ascii",
    label: "ASCII",
    description: "Render as a grid of characters",
    icon: Type,
    image: true,
    video: false,
    gpu: false,
    reactiveKey: "asciiCellSize",
    controls: [
      { kind: "range", key: "asciiCellSize", label: "Cell size", min: 4, max: 32, unit: "px" },
      { kind: "range", key: "asciiContrast", label: "Contrast", min: 50, max: 200, unit: "%" },
      { kind: "switch", key: "asciiInvert", label: "Invert tone" },
      { kind: "switch", key: "asciiCustomCharactersEnabled", label: "Custom characters" },
      {
        kind: "text",
        key: "asciiCustomCharacters",
        label: "Characters",
        showWhen: "asciiCustomCharactersEnabled",
      },
    ],
  },
  {
    type: "databend",
    label: "Databend",
    description: "Corrupt the bytes of a real JPEG and decode the wreck",
    icon: Binary,
    image: true,
    video: true,
    gpu: false,
    reactiveKey: "databendAmount",
    controls: [
      {
        kind: "segment",
        key: "databendMode",
        label: "Damage",
        options: [
          { value: "scramble", label: "Scramble" },
          { value: "shift", label: "Shift" },
          { value: "tables", label: "Tables" },
        ],
      },
      { kind: "range", key: "databendAmount", label: "Amount", min: 0, max: 100, unit: "%" },
      { kind: "range", key: "databendQuality", label: "JPEG quality", min: 5, max: 95, unit: "%" },
      { kind: "seed", key: "databendSeed", label: "Seed" },
      {
        kind: "switch",
        key: "databendAnimate",
        label: "Re-corrupt constantly",
        hint: "A fresh wreck every frame",
      },
    ],
  },
  {
    type: "gravity",
    label: "Pixel gravity",
    description: "Loose pixels break free, fall and pile up",
    icon: ArrowDownToLine,
    image: true,
    video: true,
    gpu: false,
    reactiveKey: "gravityFall",
    controls: [
      {
        kind: "segment",
        key: "gravityLoose",
        label: "Loose pixels",
        options: [
          { value: "bright", label: "Bright" },
          { value: "dark", label: "Dark" },
        ],
      },
      {
        kind: "segment",
        key: "gravityDirection",
        label: "Falls",
        options: [
          { value: "down", label: "Down" },
          { value: "up", label: "Up" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      { kind: "range", key: "gravityThreshold", label: "Threshold", min: 0, max: 255 },
      { kind: "range", key: "gravityFall", label: "Fall", min: 0, max: 100, unit: "%" },
      { kind: "range", key: "gravityScatter", label: "Scatter", min: 0, max: 100, unit: "%" },
      {
        kind: "switch",
        key: "gravityAnimate",
        label: "Loop the fall",
        hint: "Dissolve and reform, over and over",
      },
    ],
  },
  {
    type: "slit-scan",
    label: "Slit-scan",
    description: "Every row comes from a different moment",
    icon: Hourglass,
    image: false,
    video: true,
    gpu: false,
    temporal: true,
    reactiveKey: "slitDelay",
    controls: [
      {
        kind: "segment",
        key: "slitDirection",
        label: "Time flows",
        options: [
          { value: "down", label: "Down" },
          { value: "up", label: "Up" },
          { value: "right", label: "Right" },
          { value: "left", label: "Left" },
        ],
      },
      { kind: "range", key: "slitDelay", label: "Time span", min: 2, max: 120, unit: "f" },
    ],
  },
  {
    type: "datamosh",
    label: "Datamosh",
    description: "Old pixels ride the new motion",
    icon: Waypoints,
    image: false,
    video: true,
    gpu: false,
    temporal: true,
    reactiveKey: "moshBoost",
    controls: [
      { kind: "range", key: "moshBlockSize", label: "Block size", min: 8, max: 48, unit: "px" },
      { kind: "range", key: "moshBoost", label: "Motion boost", min: 50, max: 400, unit: "%" },
      { kind: "range", key: "moshBleed", label: "Bleed", min: 0, max: 50, unit: "%" },
      {
        kind: "range",
        key: "moshKeyframe",
        label: "Clean frame every",
        min: 0,
        max: 10,
        step: 0.5,
        unit: "s",
      },
    ],
  },
  {
    type: "feedback",
    label: "Feedback",
    description: "The output loops back into itself",
    icon: Orbit,
    image: true,
    video: true,
    gpu: false,
    reactiveKey: "feedbackZoom",
    controls: [
      {
        kind: "segment",
        key: "feedbackBlend",
        label: "Blend",
        options: [
          { value: "lighten", label: "Lighten" },
          { value: "screen", label: "Screen" },
          { value: "difference", label: "Diff" },
          { value: "mix", label: "Mix" },
        ],
      },
      { kind: "range", key: "feedbackZoom", label: "Zoom", min: 80, max: 120, step: 0.5, unit: "%" },
      { kind: "range", key: "feedbackRotate", label: "Rotate", min: -20, max: 20, step: 0.5, unit: "°" },
      { kind: "range", key: "feedbackPersistence", label: "Persistence", min: 0, max: 98, unit: "%" },
      { kind: "range", key: "feedbackHue", label: "Hue drift", min: 0, max: 90, unit: "°" },
    ],
  },
]

export const filterDefinitionMap = Object.fromEntries(
  filterDefinitions.map((definition) => [definition.type, definition]),
) as Record<StackableFilter, FilterDefinition>

export const imageFilters = filterDefinitions
  .filter((definition) => definition.image)
  .map((definition) => definition.type)
export const videoFilters = filterDefinitions
  .filter((definition) => definition.video)
  .map((definition) => definition.type)

/** Short label for where an effect works, or undefined when it works everywhere. */
export const getMediaBadge = (definition: FilterDefinition) =>
  !definition.video ? "Image" : !definition.image ? "Video" : undefined

/** Range controls of a filter: the settings audio can drive. */
export const getReactiveTargets = (type: StackableFilter) =>
  filterDefinitionMap[type].controls.filter(
    (control): control is Extract<FilterControl, { kind: "range" }> =>
      control.kind === "range",
  )
