import {
  Aperture,
  Archive,
  Frame,
  Images,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import type { ActiveFilter } from "../../_types/editor"

const navItems = [
  { label: "Canvas", icon: Frame },
  { label: "Media", icon: Images },
  { label: "Adjust", icon: SlidersHorizontal },
  { label: "Archive", icon: Archive },
]

const filterItems: { label: string; value: ActiveFilter }[] = [
  { label: "None", value: "none" },
  { label: "Pixelation", value: "pixelate" },
  { label: "Noise", value: "noise" },
  { label: "Bloom", value: "bloom" },
  { label: "Colors", value: "colors" },
  { label: "Scan lines", value: "scan-lines" },
  { label: "Modulation", value: "modulation" },
]

type WorkspaceSidebarProps = {
  activeFilter: ActiveFilter
  bloomRadius: number
  bloomStrength: number
  bloomThreshold: number
  hasImage: boolean
  modulationAmplitude: number
  modulationDirection: "horizontal" | "vertical"
  modulationLineCount: number
  modulationThickness: number
  noiseAmount: number
  onActiveFilterChange: (filter: ActiveFilter) => void
  onAddImage: () => void
  onAddPaletteColor: () => void
  onBloomRadiusChange: (value: number) => void
  onBloomStrengthChange: (value: number) => void
  onBloomThresholdChange: (value: number) => void
  onDeletePaletteColor: (index: number) => void
  onModulationAmplitudeChange: (value: number) => void
  onModulationDirectionChange: (value: "horizontal" | "vertical") => void
  onModulationLineCountChange: (value: number) => void
  onModulationThicknessChange: (value: number) => void
  onNoiseAmountChange: (value: number) => void
  onPaletteColorChange: (index: number, color: string) => void
  onPixelSizeChange: (value: number) => void
  onRandomizePaletteColors: () => void
  onRemoveImage: () => void
  onScanLineOpacityChange: (value: number) => void
  onScanLineSpacingChange: (value: number) => void
  onScanLineThicknessChange: (value: number) => void
  onSmartColoringChange: (checked: boolean) => void
  paletteColors: string[]
  pixelSize: number
  scanLineOpacity: number
  scanLineSpacing: number
  scanLineThickness: number
  smartColoring: boolean
}

export function WorkspaceSidebar({
  activeFilter,
  bloomRadius,
  bloomStrength,
  bloomThreshold,
  hasImage,
  modulationAmplitude,
  modulationDirection,
  modulationLineCount,
  modulationThickness,
  noiseAmount,
  onActiveFilterChange,
  onAddImage,
  onAddPaletteColor,
  onBloomRadiusChange,
  onBloomStrengthChange,
  onBloomThresholdChange,
  onDeletePaletteColor,
  onModulationAmplitudeChange,
  onModulationDirectionChange,
  onModulationLineCountChange,
  onModulationThicknessChange,
  onNoiseAmountChange,
  onPaletteColorChange,
  onPixelSizeChange,
  onRandomizePaletteColors,
  onRemoveImage,
  onScanLineOpacityChange,
  onScanLineSpacingChange,
  onScanLineThicknessChange,
  onSmartColoringChange,
  paletteColors,
  pixelSize,
  scanLineOpacity,
  scanLineSpacing,
  scanLineThickness,
  smartColoring,
}: WorkspaceSidebarProps) {
  return (
    <aside className="flex max-h-[52vh] shrink-0 flex-col overflow-y-auto border-b border-white/10 px-4 py-4 md:max-h-screen md:w-72 md:border-b-0 md:border-r md:py-5">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Visual Lab home"
          className="flex items-center gap-3 text-zinc-200 transition-colors hover:text-white"
        >
          <Aperture size={20} strokeWidth={1.5} />
          <span className="text-xs">Visual Lab</span>
        </button>

        <div className="text-[10px] leading-none text-zinc-700">VL 01</div>
      </div>

      <nav
        aria-label="Workspace sections"
        className="mt-6 flex gap-4 md:flex-col md:gap-2"
      >
        {navItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            title={label}
            className="group flex items-center gap-3 text-xs text-zinc-600 transition-colors hover:text-white"
          >
            {/* Icons keep secondary navigation compact. */}
            <Icon
              size={17}
              strokeWidth={1.4}
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-8 flex flex-col gap-3">
        <div className="text-xs text-zinc-500">Image</div>
        <button
          type="button"
          onClick={onAddImage}
          className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
        >
          <Upload size={15} strokeWidth={1.5} />
          Add image
        </button>
        {hasImage && (
          <button
            type="button"
            onClick={onRemoveImage}
            className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
          >
            <X size={15} strokeWidth={1.5} />
            Remove image
          </button>
        )}
      </div>

      <div className="mt-8">
        <div className="text-xs text-zinc-500">Filters</div>
        <div className="mt-4 flex flex-wrap gap-4 md:flex-col md:gap-2">
          {filterItems.map((filter) => (
            <button
              key={filter.value}
              type="button"
              disabled={filter.value !== "none" && !hasImage}
              onClick={() => onActiveFilterChange(filter.value)}
              className={`w-fit text-left text-xs transition-colors disabled:cursor-not-allowed disabled:text-zinc-800 ${
                activeFilter === filter.value
                  ? "text-white"
                  : "text-zinc-600 hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-5">
        {activeFilter === "pixelate" && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs text-zinc-500">Pixel size</div>
              <div className="mt-1 text-2xl text-zinc-300">{pixelSize}</div>
              <p className="mt-2 text-xs leading-5 text-zinc-700">
                Bigger numbers make chunkier square blocks.
              </p>
            </div>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Block size
              <span className="text-zinc-700">
                Slide right to make each square bigger.
              </span>
              <input
                type="range"
                min="2"
                max="64"
                step="1"
                value={pixelSize}
                onChange={(event) => onPixelSizeChange(Number(event.target.value))}
                className="w-full accent-zinc-200"
              />
            </label>
          </div>
        )}

        {activeFilter === "noise" && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs text-zinc-500">Noise amount</div>
              <div className="mt-1 text-2xl text-zinc-300">{noiseAmount}</div>
              <p className="mt-2 text-xs leading-5 text-zinc-700">
                Bigger numbers add more tiny speckles.
              </p>
            </div>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Strength
              <span className="text-zinc-700">
                Slide right to add more speckles.
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={noiseAmount}
                onChange={(event) =>
                  onNoiseAmountChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>
          </div>
        )}

        {activeFilter === "bloom" && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs text-zinc-500">Bloom</div>
              <div className="mt-1 text-2xl text-zinc-300">{bloomStrength}</div>
              <p className="mt-2 text-xs leading-5 text-zinc-700">
                Bloom makes bright parts shine like a soft light.
              </p>
            </div>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Strength
              <span className="text-zinc-700">How strong the glow looks.</span>
              <input
                type="range"
                min="0"
                max="150"
                step="1"
                value={bloomStrength}
                onChange={(event) =>
                  onBloomStrengthChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Threshold
              <span className="text-zinc-700">
                How bright a spot must be before it starts glowing.
              </span>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={bloomThreshold}
                onChange={(event) =>
                  onBloomThresholdChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Radius
              <span className="text-zinc-700">How far the glow spreads out.</span>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={bloomRadius}
                onChange={(event) =>
                  onBloomRadiusChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>
          </div>
        )}

        {activeFilter === "colors" && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs text-zinc-500">Palette</div>
              <div className="mt-1 text-2xl text-zinc-300">
                {paletteColors.length}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-700">
                The picture can only use these crayons.
              </p>
            </div>

            <label className="flex items-start gap-3 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={smartColoring}
                onChange={(event) => onSmartColoringChange(event.target.checked)}
                className="mt-0.5 accent-zinc-200"
              />
              <span className="flex flex-col gap-1">
                <span className="text-zinc-500">Smart coloring</span>
                <span className="leading-5 text-zinc-700">
                  Keep your colors, but stretch them into dark and light versions
                  so the picture stays easy to see.
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-2">
              {paletteColors.map((color, index) => (
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
                        onPaletteColorChange(index, event.target.value)
                      }
                      className="h-8 w-full bg-transparent"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Delete color ${index + 1}`}
                    title="Delete color"
                    onClick={() => onDeletePaletteColor(index)}
                    disabled={paletteColors.length === 1}
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
                onClick={onAddPaletteColor}
                className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
              >
                <Plus size={15} strokeWidth={1.5} />
                Add color
              </button>

              <button
                type="button"
                onClick={onRandomizePaletteColors}
                className="w-fit text-xs text-zinc-600 transition-colors hover:text-white"
              >
                Random colors
              </button>
            </div>
          </div>
        )}

        {activeFilter === "scan-lines" && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs text-zinc-500">Scan lines</div>
              <div className="mt-1 text-2xl text-zinc-300">
                {scanLineSpacing}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-700">
                Adds dark stripes like an old TV screen.
              </p>
            </div>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Spacing
              <span className="text-zinc-700">
                How much empty space sits between stripes.
              </span>
              <input
                type="range"
                min="2"
                max="32"
                step="1"
                value={scanLineSpacing}
                onChange={(event) =>
                  onScanLineSpacingChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Thickness
              <span className="text-zinc-700">
                How tall each dark stripe is.
              </span>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={scanLineThickness}
                onChange={(event) =>
                  onScanLineThicknessChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Opacity
              <span className="text-zinc-700">
                How dark the stripes look.
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={scanLineOpacity}
                onChange={(event) =>
                  onScanLineOpacityChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>
          </div>
        )}

        {activeFilter === "modulation" && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs text-zinc-500">Modulation</div>
              <div className="mt-1 text-2xl text-zinc-300">
                {modulationLineCount}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-700">
                Cuts the image into strips and bends only those strips.
              </p>
            </div>

            <div className="flex flex-col gap-3 text-xs text-zinc-600">
              Direction
              <span className="text-zinc-700">
                Choose whether the strips run sideways or up and down.
              </span>
              <div className="flex gap-3">
                {(["horizontal", "vertical"] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => onModulationDirectionChange(direction)}
                    className={`text-xs capitalize transition-colors ${
                      modulationDirection === direction
                        ? "text-white"
                        : "text-zinc-600 hover:text-white"
                    }`}
                  >
                    {direction}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Lines
              <span className="text-zinc-700">
                How many strips are drawn across the image.
              </span>
              <input
                type="range"
                min="10"
                max="220"
                step="1"
                value={modulationLineCount}
                onChange={(event) =>
                  onModulationLineCountChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Amplitude
              <span className="text-zinc-700">
                How far each strip moves from its normal place.
              </span>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={modulationAmplitude}
                onChange={(event) =>
                  onModulationAmplitudeChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>

            <label className="flex flex-col gap-3 text-xs text-zinc-600">
              Thickness
              <span className="text-zinc-700">
                How wide each strip is.
              </span>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={modulationThickness}
                onChange={(event) =>
                  onModulationThicknessChange(Number(event.target.value))
                }
                className="w-full accent-zinc-200"
              />
            </label>
          </div>
        )}
      </div>
    </aside>
  )
}
