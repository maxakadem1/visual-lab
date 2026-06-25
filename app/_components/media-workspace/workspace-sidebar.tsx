import {
  Aperture,
  Archive,
  Frame,
  Images,
  Plus,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react"

import type { StackableFilter } from "../../_types/editor"

const navItems = [
  { label: "Canvas", icon: Frame },
  { label: "Media", icon: Images },
  { label: "Adjust", icon: SlidersHorizontal },
  { label: "Archive", icon: Archive },
]

const filterItems: { label: string; value: StackableFilter }[] = [
  { label: "Pixelation", value: "pixelate" },
  { label: "Noise", value: "noise" },
  { label: "Bloom", value: "bloom" },
  { label: "Colors", value: "colors" },
  { label: "Dither", value: "dither" },
  { label: "Fisheye", value: "fisheye" },
  { label: "Scan lines", value: "scan-lines" },
  { label: "Modulation", value: "modulation" },
]

type WorkspaceSidebarProps = {
  canAddFilters: boolean
  hasMedia: boolean
  onAddFilter: (filter: StackableFilter) => void
  onAddImage: () => void
  onRemoveMedia: () => void
  supportedFilters: StackableFilter[]
}

export function WorkspaceSidebar({
  canAddFilters,
  hasMedia,
  onAddFilter,
  onAddImage,
  onRemoveMedia,
  supportedFilters,
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
        <div className="text-xs text-zinc-500">Media</div>
        <button
          type="button"
          onClick={onAddImage}
          className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
        >
          <Upload size={15} strokeWidth={1.5} />
          Add media
        </button>
        {hasMedia && (
          <button
            type="button"
            onClick={onRemoveMedia}
            className="flex w-fit items-center gap-2 text-xs text-zinc-600 transition-colors hover:text-white"
          >
            <X size={15} strokeWidth={1.5} />
            Remove media
          </button>
        )}
      </div>

      <div className="mt-8">
        <div className="text-xs text-zinc-500">Filters</div>
        <div className="mt-4 flex flex-wrap gap-4 md:flex-col md:gap-2">
          {filterItems.map((filter) => {
            const supported = supportedFilters.includes(filter.value)

            return (
              <button
                key={filter.value}
                type="button"
                aria-label={`Add ${filter.label} layer`}
                disabled={!canAddFilters || !supported}
                onClick={() => onAddFilter(filter.value)}
                className="flex w-fit items-center gap-2 text-left text-xs text-zinc-600 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-800"
              >
                <Plus size={14} strokeWidth={1.5} />
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
