import type { FilterLayer, FilterLayerSettings, StackableFilter } from "../_types/editor"
import { getRandomHexColor, hexToRgb, rgbToHex } from "./color"
import { filterDefinitionMap } from "./filter-registry"
import { createLayerId, createLayerSettings, paletteLibrary } from "./presets"

/**
 * Breed mode: random variations of a stack. Each child tweaks numbers, flips
 * options, nudges palettes and sometimes adds, drops or reorders a layer.
 */

export type MutationStrength = "gentle" | "wild"

type MutateOptions = {
  strength: MutationStrength
  /** Filters a child may gain. Temporal ones are left out of thumbnails. */
  allowed: StackableFilter[]
  sourcePalette: string[]
}

const rates = {
  gentle: { numeric: 0.12, chance: 0.35, structure: 0.18 },
  wild: { numeric: 0.32, chance: 0.6, structure: 0.42 },
} as const

/** Audio wiring and text are the user's, not the gene pool's. */
const frozenKeys = new Set<keyof FilterLayerSettings>([
  "audioBand",
  "audioTarget",
  "audioAmount",
  "asciiCustomCharacters",
  "paletteColors",
])

const gaussian = () => {
  // Box–Muller; mostly small nudges with the occasional big jump.
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]

const jitterColor = (hex: string, amount: number) => {
  const [red, green, blue] = hexToRgb(hex)
  const shift = () => Math.round(gaussian() * 60 * amount)
  const clamp = (value: number) => Math.max(0, Math.min(255, value))
  return rgbToHex([clamp(red + shift()), clamp(green + shift()), clamp(blue + shift())])
}

const mutatePalette = (colors: string[], strength: MutationStrength) => {
  const roll = Math.random()
  if (roll < (strength === "wild" ? 0.25 : 0.1)) return [...pick(paletteLibrary).colors]
  if (roll < (strength === "wild" ? 0.4 : 0.18)) return colors.map(() => getRandomHexColor())
  if (roll < 0.6) return colors.map((color) => jitterColor(color, strength === "wild" ? 1 : 0.5))
  return [...colors]
}

const mutateLayer = (layer: FilterLayer, options: MutateOptions): FilterLayer => {
  const rate = rates[options.strength]
  const definition = filterDefinitionMap[layer.type]
  const settings: FilterLayerSettings = { ...layer.settings, paletteColors: [...layer.settings.paletteColors] }
  const target = settings as Record<keyof FilterLayerSettings, unknown>

  for (const control of definition.controls) {
    if (control.kind === "palette") {
      if (Math.random() < rate.chance) settings.paletteColors = mutatePalette(settings.paletteColors, options.strength)
      continue
    }
    if (control.kind === "text" || frozenKeys.has(control.key)) continue
    if (Math.random() > rate.chance) continue

    if (control.kind === "range") {
      const span = control.max - control.min
      const step = control.step ?? 1
      const next = (settings[control.key] as number) + gaussian() * rate.numeric * span
      const snapped = Math.round(next / step) * step
      target[control.key] = Math.max(control.min, Math.min(control.max, snapped))
    } else if (control.kind === "seed") {
      target[control.key] = Math.floor(Math.random() * 1000)
    } else if (control.kind === "segment") {
      target[control.key] = pick(control.options).value
    } else if (control.kind === "switch") {
      // Flipping switches is drastic; do it less often than nudging numbers.
      if (Math.random() < 0.5) target[control.key] = !settings[control.key]
    }
  }

  return { ...layer, id: createLayerId(), settings }
}

const randomLayer = (options: MutateOptions): FilterLayer => {
  const type = pick(options.allowed)
  const seed: FilterLayer = {
    id: createLayerId(),
    type,
    visible: true,
    settings: createLayerSettings(options.sourcePalette),
  }
  // Start from a mutated default so new layers aren't all identical.
  return mutateLayer(seed, { ...options, strength: "wild" })
}

const signature = (layers: FilterLayer[]) =>
  JSON.stringify(layers.map((layer) => [layer.type, layer.visible, layer.settings]))

export const mutateStack = (parent: FilterLayer[], options: MutateOptions): FilterLayer[] => {
  const rate = rates[options.strength]
  const visible = parent.filter((layer) => layer.visible)

  if (!visible.length) {
    return Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => randomLayer(options))
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    let child = parent.map((layer) => (layer.visible ? mutateLayer(layer, options) : { ...layer }))

    if (options.allowed.length && Math.random() < rate.structure && child.length < 6) {
      child.splice(Math.floor(Math.random() * (child.length + 1)), 0, randomLayer(options))
    }
    const visibleIndexes = child.flatMap((layer, index) => (layer.visible ? [index] : []))
    // Never drop the last visible layer, or the child is just the original.
    if (visibleIndexes.length > 1 && Math.random() < rate.structure * 0.5) {
      child.splice(pick(visibleIndexes), 1)
    }
    if (child.length > 1 && Math.random() < rate.structure * 0.6) {
      const index = Math.floor(Math.random() * (child.length - 1))
      child = [...child]
      ;[child[index], child[index + 1]] = [child[index + 1], child[index]]
    }

    if (signature(child) !== signature(parent)) return child
  }

  return [...parent.map((layer) => mutateLayer(layer, { ...options, strength: "wild" }))]
}

/** A brood of distinct children. */
export const breed = (parent: FilterLayer[], count: number, options: MutateOptions) => {
  const seen = new Set([signature(parent)])
  const children: FilterLayer[][] = []

  for (let attempt = 0; children.length < count && attempt < count * 6; attempt += 1) {
    const child = mutateStack(parent, options)
    const key = signature(child)
    if (seen.has(key)) continue
    seen.add(key)
    children.push(child)
  }

  return children
}
