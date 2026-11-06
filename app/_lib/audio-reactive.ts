import type { AudioBand, FilterLayer, FilterLayerSettings } from "../_types/editor"
import { filterDefinitionMap, getReactiveTargets } from "./filter-registry"

export type AudioLevels = Record<Exclude<AudioBand, "off">, number>

export const silentLevels: AudioLevels = { low: 0, mid: 0, high: 0, beat: 0 }

const bandRanges = {
  low: [20, 160],
  mid: [160, 2000],
  high: [2000, 9000],
} as const

/**
 * Turns an AnalyserNode into smoothed 0–1 levels per band plus a beat pulse.
 * Each band normalizes against its own recent peak, so quiet and loud tracks
 * both use the full range.
 */
export class AudioAnalyser {
  readonly node: AnalyserNode
  private bins: Uint8Array<ArrayBuffer>
  private levels: AudioLevels = { ...silentLevels }
  private peaks = { low: 0.2, mid: 0.2, high: 0.2 }
  private lowAverage = 0
  private beat = 0
  private lastBeatAt = 0
  private lastSampleAt = 0

  constructor(readonly context: AudioContext, source: AudioNode) {
    this.node = context.createAnalyser()
    this.node.fftSize = 2048
    this.node.smoothingTimeConstant = 0.55
    this.bins = new Uint8Array(this.node.frequencyBinCount)
    source.connect(this.node)
  }

  disconnect() {
    try {
      this.node.disconnect()
    } catch {}
  }

  /** Safe to call every frame; repeated calls within a few ms reuse the last read. */
  sample(now = performance.now()): AudioLevels {
    if (now - this.lastSampleAt < 8) return this.levels
    const elapsed = Math.min(0.1, (now - (this.lastSampleAt || now)) / 1000)
    this.lastSampleAt = now
    this.node.getByteFrequencyData(this.bins)

    const binHz = this.context.sampleRate / this.node.fftSize
    const raw = { low: 0, mid: 0, high: 0 }

    for (const band of ["low", "mid", "high"] as const) {
      const [from, to] = bandRanges[band]
      const start = Math.max(1, Math.floor(from / binHz))
      const end = Math.min(this.bins.length - 1, Math.ceil(to / binHz))
      let sum = 0
      for (let bin = start; bin <= end; bin += 1) sum += this.bins[bin]
      raw[band] = sum / Math.max(1, end - start + 1) / 255
    }

    const next: AudioLevels = { ...this.levels }

    for (const band of ["low", "mid", "high"] as const) {
      // Peaks decay slowly so the level re-normalizes when the music gets quieter.
      this.peaks[band] = Math.max(raw[band], this.peaks[band] * (1 - elapsed * 0.25), 0.08)
      const target = Math.min(1, raw[band] / this.peaks[band]) ** 1.5
      const previous = this.levels[band]
      // Fast attack, slower release, like a VU meter.
      const rate = target > previous ? 0.6 : 0.18
      next[band] = previous + (target - previous) * rate
    }

    // A beat is a jump in bass energy above its running average.
    this.lowAverage += (raw.low - this.lowAverage) * Math.min(1, elapsed * 3)
    if (raw.low > this.lowAverage * 1.35 && raw.low > 0.18 && now - this.lastBeatAt > 180) {
      this.beat = 1
      this.lastBeatAt = now
    } else {
      this.beat = Math.max(0, this.beat - elapsed * 5)
    }
    next.beat = this.beat

    this.levels = next
    return next
  }
}

/** The numeric setting a layer's audio drives, or null when it has none. */
export const getAudioTarget = (layer: FilterLayer) => {
  const targets = getReactiveTargets(layer.type)
  const chosen = targets.find((control) => control.key === layer.settings.audioTarget)
  const fallback = targets.find(
    (control) => control.key === filterDefinitionMap[layer.type].reactiveKey,
  )
  return chosen ?? fallback ?? targets[0] ?? null
}

export const isAudioReactive = (layer: FilterLayer) =>
  layer.visible && layer.settings.audioBand !== "off" && getAudioTarget(layer) !== null

/** Returns the stack with each reactive layer's target pushed by its band. */
export const applyAudioModulation = (layers: FilterLayer[], levels: AudioLevels) => {
  if (!layers.some(isAudioReactive)) return layers

  return layers.map((layer) => {
    if (!isAudioReactive(layer)) return layer
    const control = getAudioTarget(layer)!
    const band = layer.settings.audioBand as keyof AudioLevels
    const base = layer.settings[control.key]
    const span = control.max - control.min
    const value = Math.max(
      control.min,
      Math.min(control.max, base + levels[band] * (layer.settings.audioAmount / 100) * span),
    )
    const settings: FilterLayerSettings = { ...layer.settings, [control.key]: value }
    return { ...layer, settings }
  })
}

/** Sensible pairings for the one-click "make everything react" button. */
const autoBands: Partial<Record<FilterLayer["type"], Exclude<AudioBand, "off">>> = {
  pixelate: "beat",
  noise: "high",
  bloom: "low",
  dither: "beat",
  fisheye: "low",
  "pixel-sort": "mid",
  "scan-lines": "high",
  modulation: "low",
  ascii: "beat",
  databend: "beat",
  gravity: "low",
  "slit-scan": "mid",
  datamosh: "low",
  feedback: "low",
}

export const autoMapAudio = (layers: FilterLayer[]) =>
  layers.map((layer) => {
    const band = autoBands[layer.type]
    if (!band || !getReactiveTargets(layer.type).length) return layer
    return {
      ...layer,
      settings: {
        ...layer.settings,
        audioBand: band,
        audioTarget: "",
        // Pixel thresholds read better pushed down; everything else up.
        audioAmount: layer.type === "pixel-sort" ? -45 : 55,
      },
    }
  })
