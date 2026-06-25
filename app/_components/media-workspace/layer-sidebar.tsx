import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react"

import type {
  FilterLayer,
  FilterLayerSettings,
  StackableFilter,
} from "../../_types/editor"

const filterLabels: Record<StackableFilter, string> = {
  bloom: "Bloom",
  colors: "Colors",
  dither: "Dither",
  modulation: "Modulation",
  noise: "Noise",
  pixelate: "Pixelation",
  "scan-lines": "Scan lines",
}

type LayerSidebarProps = {
  layers: FilterLayer[]
  onAddPaletteColor: (layerId: string) => void
  onDeleteLayer: (layerId: string) => void
  onDeletePaletteColor: (layerId: string, colorIndex: number) => void
  onMoveLayer: (layerId: string, direction: "up" | "down") => void
  onPaletteColorChange: (
    layerId: string,
    colorIndex: number,
    nextColor: string,
  ) => void
  onRandomizePaletteColors: (layerId: string) => void
  onSelectLayer: (layerId: string) => void
  onToggleLayerVisibility: (layerId: string) => void
  onUpdateLayerSettings: (
    layerId: string,
    settings: Partial<FilterLayerSettings>,
  ) => void
  selectedLayerId: string | null
}

export function LayerSidebar({
  layers,
  onAddPaletteColor,
  onDeleteLayer,
  onDeletePaletteColor,
  onMoveLayer,
  onPaletteColorChange,
  onRandomizePaletteColors,
  onSelectLayer,
  onToggleLayerVisibility,
  onUpdateLayerSettings,
  selectedLayerId,
}: LayerSidebarProps) {
  const layerNames = getLayerNames(layers)

  return (
    <aside className="flex max-h-[52vh] shrink-0 flex-col overflow-y-auto border-t border-white/10 px-4 py-4 md:max-h-screen md:w-80 md:border-l md:border-t-0 md:py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-zinc-500">Layers</div>
        <div className="text-[10px] leading-none text-zinc-700">
          {layers.length}
        </div>
      </div>

      {layers.length === 0 ? (
        <div className="mt-8 text-xs text-zinc-700">No layers</div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {layers.map((layer, index) => {
            const selected = layer.id === selectedLayerId

            return (
              <div
                key={layer.id}
                className={`border px-3 py-3 transition-colors ${
                  selected ? "border-white/20" : "border-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectLayer(layer.id)}
                    className={`min-w-0 flex-1 truncate text-left text-xs transition-colors ${
                      selected ? "text-white" : "text-zinc-500 hover:text-white"
                    }`}
                  >
                    {layerNames.get(layer.id)}
                  </button>

                  <button
                    type="button"
                    aria-label={`Move ${layerNames.get(layer.id)} up`}
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => onMoveLayer(layer.id, "up")}
                    className="grid size-8 shrink-0 place-items-center text-zinc-600 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-800"
                  >
                    <ChevronUp size={15} strokeWidth={1.5} />
                  </button>

                  <button
                    type="button"
                    aria-label={`Move ${layerNames.get(layer.id)} down`}
                    title="Move down"
                    disabled={index === layers.length - 1}
                    onClick={() => onMoveLayer(layer.id, "down")}
                    className="grid size-8 shrink-0 place-items-center text-zinc-600 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-800"
                  >
                    <ChevronDown size={15} strokeWidth={1.5} />
                  </button>

                  <button
                    type="button"
                    aria-label={
                      layer.visible
                        ? `Hide ${layerNames.get(layer.id)}`
                        : `Show ${layerNames.get(layer.id)}`
                    }
                    title={layer.visible ? "Hide" : "Show"}
                    onClick={() => onToggleLayerVisibility(layer.id)}
                    className="grid size-8 shrink-0 place-items-center text-zinc-600 transition-colors hover:text-white"
                  >
                    {layer.visible ? (
                      <Eye size={15} strokeWidth={1.5} />
                    ) : (
                      <EyeOff size={15} strokeWidth={1.5} />
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete ${layerNames.get(layer.id)}`}
                    title="Delete"
                    onClick={() => onDeleteLayer(layer.id)}
                    className="grid size-8 shrink-0 place-items-center text-zinc-600 transition-colors hover:text-white"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </div>

                {selected && (
                  <LayerSettings
                    layer={layer}
                    onAddPaletteColor={onAddPaletteColor}
                    onDeletePaletteColor={onDeletePaletteColor}
                    onPaletteColorChange={onPaletteColorChange}
                    onRandomizePaletteColors={onRandomizePaletteColors}
                    onUpdateLayerSettings={onUpdateLayerSettings}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

type LayerSettingsProps = {
  layer: FilterLayer
  onAddPaletteColor: (layerId: string) => void
  onDeletePaletteColor: (layerId: string, colorIndex: number) => void
  onPaletteColorChange: (
    layerId: string,
    colorIndex: number,
    nextColor: string,
  ) => void
  onRandomizePaletteColors: (layerId: string) => void
  onUpdateLayerSettings: (
    layerId: string,
    settings: Partial<FilterLayerSettings>,
  ) => void
}

function LayerSettings({
  layer,
  onAddPaletteColor,
  onDeletePaletteColor,
  onPaletteColorChange,
  onRandomizePaletteColors,
  onUpdateLayerSettings,
}: LayerSettingsProps) {
  const settings = layer.settings

  return (
    <div className="mt-4 flex flex-col gap-5 border-t border-white/10 pt-4">
      {layer.type === "pixelate" && (
        <NumberRange
          label="Block size"
          max={64}
          min={2}
          onChange={(pixelSize) => onUpdateLayerSettings(layer.id, { pixelSize })}
          value={settings.pixelSize}
        />
      )}

      {layer.type === "noise" && (
        <NumberRange
          label="Strength"
          max={100}
          min={0}
          onChange={(noiseAmount) =>
            onUpdateLayerSettings(layer.id, { noiseAmount })
          }
          value={settings.noiseAmount}
        />
      )}

      {layer.type === "bloom" && (
        <>
          <NumberRange
            label="Strength"
            max={150}
            min={0}
            onChange={(bloomStrength) =>
              onUpdateLayerSettings(layer.id, { bloomStrength })
            }
            value={settings.bloomStrength}
          />
          <NumberRange
            label="Threshold"
            max={255}
            min={0}
            onChange={(bloomThreshold) =>
              onUpdateLayerSettings(layer.id, { bloomThreshold })
            }
            value={settings.bloomThreshold}
          />
          <NumberRange
            label="Radius"
            max={60}
            min={0}
            onChange={(bloomRadius) =>
              onUpdateLayerSettings(layer.id, { bloomRadius })
            }
            value={settings.bloomRadius}
          />
        </>
      )}

      {(layer.type === "colors" || layer.type === "dither") && (
        <>
          {layer.type === "dither" && (
            <>
              <div className="flex flex-col gap-3 text-xs text-zinc-600">
                Pattern
                <div className="flex gap-3">
                  {(["bayer", "dots"] as const).map((pattern) => (
                    <button
                      key={pattern}
                      type="button"
                      onClick={() =>
                        onUpdateLayerSettings(layer.id, {
                          ditherPattern: pattern,
                        })
                      }
                      className={`text-xs capitalize transition-colors ${
                        settings.ditherPattern === pattern
                          ? "text-white"
                          : "text-zinc-600 hover:text-white"
                      }`}
                    >
                      {pattern}
                    </button>
                  ))}
                </div>
              </div>
              <NumberRange
                label="Scale"
                max={24}
                min={1}
                onChange={(ditherScale) =>
                  onUpdateLayerSettings(layer.id, { ditherScale })
                }
                value={settings.ditherScale}
              />
              <NumberRange
                label="Strength"
                max={100}
                min={0}
                onChange={(ditherStrength) =>
                  onUpdateLayerSettings(layer.id, { ditherStrength })
                }
                value={settings.ditherStrength}
              />
            </>
          )}

          <label className="flex items-start gap-3 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={settings.smartColoring}
              onChange={(event) =>
                onUpdateLayerSettings(layer.id, {
                  smartColoring: event.target.checked,
                })
              }
              className="mt-0.5 accent-zinc-200"
            />
            <span className="text-zinc-500">Smart coloring</span>
          </label>

          <div className="flex flex-col gap-2">
            {settings.paletteColors.map((color, index) => (
              <div key={index} className="flex items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-3 text-xs text-zinc-600">
                  <span
                    className="size-5 shrink-0 border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                  <span className="sr-only">Palette color {index + 1}</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(event) =>
                      onPaletteColorChange(layer.id, index, event.target.value)
                    }
                    className="h-8 w-full bg-transparent"
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Delete color ${index + 1}`}
                  title="Delete color"
                  disabled={settings.paletteColors.length === 1}
                  onClick={() => onDeletePaletteColor(layer.id, index)}
                  className="grid size-8 place-items-center text-zinc-600 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-800"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => onAddPaletteColor(layer.id)}
              className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
            >
              <Plus size={15} strokeWidth={1.5} />
              Add color
            </button>

            <button
              type="button"
              aria-label="Random colors"
              title="Random colors"
              onClick={() => onRandomizePaletteColors(layer.id)}
              className="grid size-8 place-items-center text-zinc-600 transition-colors hover:text-white"
            >
              <Shuffle size={15} strokeWidth={1.5} />
            </button>
          </div>
        </>
      )}

      {layer.type === "scan-lines" && (
        <>
          <NumberRange
            label="Spacing"
            max={32}
            min={2}
            onChange={(scanLineSpacing) =>
              onUpdateLayerSettings(layer.id, { scanLineSpacing })
            }
            value={settings.scanLineSpacing}
          />
          <NumberRange
            label="Thickness"
            max={12}
            min={1}
            onChange={(scanLineThickness) =>
              onUpdateLayerSettings(layer.id, { scanLineThickness })
            }
            value={settings.scanLineThickness}
          />
          <NumberRange
            label="Opacity"
            max={100}
            min={0}
            onChange={(scanLineOpacity) =>
              onUpdateLayerSettings(layer.id, { scanLineOpacity })
            }
            value={settings.scanLineOpacity}
          />
        </>
      )}

      {layer.type === "modulation" && (
        <>
          <div className="flex flex-col gap-3 text-xs text-zinc-600">
            Direction
            <div className="flex gap-3">
              {(["horizontal", "vertical"] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  onClick={() =>
                    onUpdateLayerSettings(layer.id, {
                      modulationDirection: direction,
                    })
                  }
                  className={`text-xs capitalize transition-colors ${
                    settings.modulationDirection === direction
                      ? "text-white"
                      : "text-zinc-600 hover:text-white"
                  }`}
                >
                  {direction}
                </button>
              ))}
            </div>
          </div>
          <NumberRange
            label="Lines"
            max={220}
            min={10}
            onChange={(modulationLineCount) =>
              onUpdateLayerSettings(layer.id, { modulationLineCount })
            }
            value={settings.modulationLineCount}
          />
          <NumberRange
            label="Amplitude"
            max={90}
            min={0}
            onChange={(modulationAmplitude) =>
              onUpdateLayerSettings(layer.id, { modulationAmplitude })
            }
            value={settings.modulationAmplitude}
          />
          <NumberRange
            label="Thickness"
            max={16}
            min={1}
            onChange={(modulationThickness) =>
              onUpdateLayerSettings(layer.id, { modulationThickness })
            }
            value={settings.modulationThickness}
          />
        </>
      )}
    </div>
  )
}

type NumberRangeProps = {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  value: number
}

function NumberRange({ label, max, min, onChange, value }: NumberRangeProps) {
  return (
    <label className="flex flex-col gap-3 text-xs text-zinc-600">
      <span className="flex items-center justify-between gap-4">
        <span>{label}</span>
        <span className="text-zinc-400">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-zinc-200"
      />
    </label>
  )
}

function getLayerNames(layers: FilterLayer[]) {
  const counts = new Map<StackableFilter, number>()
  const names = new Map<string, string>()
  const bottomUpLayers = [...layers].reverse()

  // Number from the bottom so names stay tied to creation-style stacking.
  bottomUpLayers.forEach((layer) => {
    const nextCount = (counts.get(layer.type) ?? 0) + 1

    counts.set(layer.type, nextCount)
    names.set(layer.id, `${filterLabels[layer.type]} ${nextCount}`)
  })

  return names
}
