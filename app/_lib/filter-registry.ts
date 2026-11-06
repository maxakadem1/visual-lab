import {
  ArrowDownWideNarrow,
  Blend,
  Grid3x3,
  Palette,
  Rows3,
  ScanEye,
  Sparkles,
  Sun,
  Type,
  Waves,
  type LucideIcon,
} from "lucide-react"

import type { FilterLayerSettings, StackableFilter } from "../_types/editor"

type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never
}[keyof T]

type NumericKey = KeysOfType<FilterLayerSettings, number>
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
  | { kind: "palette" }

export type FilterDefinition = {
  type: StackableFilter
  label: string
  description: string
  icon: LucideIcon
  video: boolean
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
    video: true,
    controls: [
      { kind: "range", key: "pixelSize", label: "Block size", min: 2, max: 64, unit: "px" },
    ],
  },
  {
    type: "noise",
    label: "Noise",
    description: "Film-like luminance grain",
    icon: Sparkles,
    video: true,
    controls: [
      { kind: "range", key: "noiseAmount", label: "Strength", min: 0, max: 100, unit: "%" },
    ],
  },
  {
    type: "bloom",
    label: "Bloom",
    description: "Soft glow around bright highlights",
    icon: Sun,
    video: true,
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
    video: true,
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
    video: false,
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
    video: false,
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
    video: false,
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
    video: true,
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
    video: true,
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
    video: false,
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
]

export const filterDefinitionMap = Object.fromEntries(
  filterDefinitions.map((definition) => [definition.type, definition]),
) as Record<StackableFilter, FilterDefinition>

export const imageFilters = filterDefinitions.map((definition) => definition.type)
export const videoFilters = filterDefinitions
  .filter((definition) => definition.video)
  .map((definition) => definition.type)
