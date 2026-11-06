"use client"

import { useState } from "react"
import {
  AudioLines,
  Check,
  Copy,
  Dices,
  Eye,
  EyeOff,
  GripVertical,
  Layers2,
  PanelRight,
  Pipette,
  Plus,
  RotateCcw,
  Shuffle,
  SwatchBook,
  Trash2,
  X,
} from "lucide-react"

import { getAudioTarget } from "../../_lib/audio-reactive"
import {
  filterDefinitionMap,
  getReactiveTargets,
  type FilterControl,
} from "../../_lib/filter-registry"
import { paletteLibrary } from "../../_lib/presets"
import type { FilterLayer, FilterLayerSettings } from "../../_types/editor"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Badge, Input, Segmented, Shortcut, Slider, Switch } from "../ui/primitives"
import { Tooltip } from "../ui/tooltip"
import { LevelMeters, ListenHint } from "./audio-panel"
import { getLayerNames } from "./format"
import type { MediaEditor } from "./use-media-editor"

export function Inspector({
  editor,
  onCollapse,
  onOpenCommandMenu,
}: {
  editor: MediaEditor
  onCollapse: () => void
  onOpenCommandMenu: () => void
}) {
  const { media, layers, selectedLayer, actions } = editor
  const names = getLayerNames(layers)
  const videoShadowed = getVideoShadowedLayers(
    layers,
    media?.kind === "video" && editor.canvasRenderMode === "webgl-video",
  )

  return (
    <aside className="surface-grain flex h-full w-(--inspector-width) shrink-0 flex-col border-l bg-sidebar">
      <header className="flex h-(--topbar-height) shrink-0 items-center gap-2 border-b pr-2 pl-4">
        <span className="text-sm font-medium">Layers</span>
        <span className="text-xs text-muted-foreground tabular-nums">{layers.length}</span>
        <div className="flex-1" />
        {layers.length > 0 && (
          <Tooltip content="Remove all layers" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove all layers"
              onClick={actions.clearLayers}
            >
              <Trash2 />
            </Button>
          </Tooltip>
        )}
        <Tooltip content="Add effect" shortcut="mod+k" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Add effect"
            disabled={!media}
            onClick={onOpenCommandMenu}
          >
            <Plus />
          </Button>
        </Tooltip>
        <Tooltip content="Hide inspector" shortcut="mod+i" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hide inspector"
            onClick={onCollapse}
          >
            <PanelRight />
          </Button>
        </Tooltip>
      </header>

      {!media || layers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="grid size-10 place-items-center rounded-xl border bg-card shadow-xs/5">
            <Layers2 className="size-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">No layers yet</div>
            <p className="mt-1 text-xs text-balance text-muted-foreground">
              {media
                ? "Pick an effect from the sidebar or the command menu."
                : "Open an image or video to start stacking effects."}
            </p>
          </div>
          {media && (
            <Button variant="outline" size="sm" onClick={onOpenCommandMenu}>
              <Plus />
              Add effect
              <Shortcut keys="mod+k" className="-me-1" />
            </Button>
          )}
        </div>
      ) : (
        <>
          <LayerList
            editor={editor}
            names={names}
            videoShadowed={videoShadowed}
          />

          <div className="min-h-0 flex-1 overflow-y-auto border-t">
            {selectedLayer ? (
              <LayerSettingsPanel
                key={selectedLayer.id}
                editor={editor}
                layer={selectedLayer}
                name={names.get(selectedLayer.id) ?? ""}
                shadowed={videoShadowed.has(selectedLayer.id)}
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-xs text-muted-foreground">
                Select a layer to edit its settings
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

/* ------------------------------- Layer list ------------------------------ */

function LayerList({
  editor,
  names,
  videoShadowed,
}: {
  editor: MediaEditor
  names: Map<string, string>
  videoShadowed: Set<string>
}) {
  const { layers, selectedLayerId, actions } = editor
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const finishDrag = () => {
    setDragId(null)
    setDropIndex(null)
  }

  return (
    <div className="flex max-h-[42%] shrink-0 flex-col">
      <div
        role="listbox"
        aria-label="Layers"
        className="flex flex-col gap-0.5 overflow-y-auto p-2"
        onKeyDown={(event) => {
          const index = layers.findIndex((layer) => layer.id === selectedLayerId)
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            const delta = event.key === "ArrowDown" ? 1 : -1
            if (event.altKey && selectedLayerId) {
              actions.moveLayer(selectedLayerId, index + delta)
              return
            }
            const next = layers[Math.max(0, Math.min(layers.length - 1, index + delta))]
            if (next) actions.selectLayer(next.id)
          }
        }}
      >
        {layers.map((layer, index) => {
          const definition = filterDefinitionMap[layer.type]
          const Icon = definition.icon
          const selected = layer.id === selectedLayerId
          const name = names.get(layer.id)
          const showDropBefore = dropIndex === index && dragId !== layer.id
          const shadowed = videoShadowed.has(layer.id)

          return (
            <div
              key={layer.id}
              role="option"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", layer.id)
                setDragId(layer.id)
              }}
              onDragOver={(event) => {
                if (!dragId) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const after = event.clientY > rect.top + rect.height / 2
                setDropIndex(after ? index + 1 : index)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragId && dropIndex !== null) {
                  const from = layers.findIndex((item) => item.id === dragId)
                  actions.moveLayer(dragId, dropIndex > from ? dropIndex - 1 : dropIndex)
                }
                finishDrag()
              }}
              onDragEnd={finishDrag}
              onClick={() => actions.selectLayer(layer.id)}
              className={cn(
                "group/layer relative flex min-h-9 cursor-default items-center gap-2 rounded-md py-1 pr-1 pl-1 text-sm outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                selected
                  ? "bg-sidebar-row-active text-sidebar-foreground not-dark:shadow-xs/5 not-dark:ring-1 not-dark:ring-border/70"
                  : "text-sidebar-muted-foreground/75 hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
                dragId === layer.id && "opacity-40",
              )}
            >
              {showDropBefore && <DropIndicator position="top" />}
              {dropIndex === layers.length && index === layers.length - 1 && (
                <DropIndicator position="bottom" />
              )}
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/0 transition-colors group-hover/layer:text-muted-foreground/70" />
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md border bg-card shadow-xs/5",
                  selected && "border-primary/40 bg-primary/10 text-primary dark:text-[oklch(0.75_0.12_264)]",
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  !layer.visible && "text-muted-foreground line-through decoration-muted-foreground/40",
                )}
              >
                {name}
              </span>
              {shadowed && (
                <Tooltip content="Video renders only the top layer of each type">
                  <Badge variant="warning">Skipped</Badge>
                </Tooltip>
              )}
              <Tooltip content={layer.visible ? "Hide layer" : "Show layer"}>
                <Button
                  variant="muted"
                  size="icon-xs"
                  aria-label={layer.visible ? `Hide ${name}` : `Show ${name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    actions.toggleLayerVisibility(layer.id)
                  }}
                  className={cn(
                    layer.visible &&
                      "opacity-0 group-hover/layer:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  {layer.visible ? <Eye /> : <EyeOff />}
                </Button>
              </Tooltip>
              <Tooltip content="Delete layer" shortcut="del">
                <Button
                  variant="muted"
                  size="icon-xs"
                  aria-label={`Delete ${name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    actions.deleteLayer(layer.id)
                  }}
                  className="opacity-0 group-hover/layer:opacity-100 focus-visible:opacity-100"
                >
                  <X />
                </Button>
              </Tooltip>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between px-4 pb-2 text-2xs text-muted-foreground">
        <span>Top layer renders last</span>
        <span className="hidden items-center gap-1 lg:flex">
          <Shortcut keys="alt+↑" /> reorder
        </span>
      </div>
    </div>
  )
}

function DropIndicator({ position }: { position: "top" | "bottom" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-primary",
        position === "top" ? "-top-[2px]" : "-bottom-[2px]",
      )}
    />
  )
}

/* ----------------------------- Layer settings ---------------------------- */

function LayerSettingsPanel({
  editor,
  layer,
  name,
  shadowed,
}: {
  editor: MediaEditor
  layer: FilterLayer
  name: string
  shadowed: boolean
}) {
  const { actions } = editor
  const definition = filterDefinitionMap[layer.type]
  const update = (settings: Partial<FilterLayerSettings>) =>
    actions.updateLayerSettings(layer.id, settings)
  const visibleControls = definition.controls.filter(
    (control) =>
      !(control.kind === "text" && control.showWhen && !layer.settings[control.showWhen]),
  )

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-start gap-2 px-1 pt-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{name}</h2>
            {!layer.visible && <Badge variant="secondary">Hidden</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{definition.description}</p>
        </div>
        <div className="-mt-0.5 flex shrink-0 items-center">
          <Tooltip content="Duplicate" shortcut="mod+d">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Duplicate layer"
              onClick={() => actions.duplicateLayer(layer.id)}
            >
              <Copy />
            </Button>
          </Tooltip>
          <Tooltip content="Reset to defaults">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reset layer"
              onClick={() => actions.resetLayer(layer.id)}
            >
              <RotateCcw />
            </Button>
          </Tooltip>
        </div>
      </div>

      {shadowed && (
        <div className="rounded-lg bg-warning/8 px-3 py-2 text-xs text-warning-foreground dark:bg-warning/16">
          Video preview applies only the top {definition.label} layer. This one is skipped.
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card/40 shadow-xs/5 [&>*+*]:border-t [&>*+*]:border-border/50">
        {visibleControls.map((control, index) => (
          <ControlRow
            key={control.kind === "palette" ? `palette-${index}` : control.key}
            control={control}
            layer={layer}
            update={update}
            editor={editor}
          />
        ))}
      </div>

      {definition.temporal && editor.media?.kind === "video" && !editor.video.playing && (
        <p className="px-1 text-2xs text-muted-foreground">
          This effect feeds on earlier frames. Press play to see it.
        </p>
      )}

      <AudioControl layer={layer} editor={editor} update={update} />

      <Button
        variant="destructive"
        size="sm"
        className="self-start"
        onClick={() => actions.deleteLayer(layer.id)}
      >
        <Trash2 />
        Delete layer
      </Button>
    </div>
  )
}

function ControlRow({
  control,
  layer,
  update,
  editor,
}: {
  control: FilterControl
  layer: FilterLayer
  update: (settings: Partial<FilterLayerSettings>) => void
  editor: MediaEditor
}) {
  const settings = layer.settings

  switch (control.kind) {
    case "range": {
      const value = settings[control.key]

      return (
        <div className="px-3 pt-2.5 pb-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${layer.id}-${control.key}`} className="text-xs font-medium">
              {control.label}
            </label>
            <span className="flex items-baseline gap-0.5 font-mono text-xs text-muted-foreground tabular-nums">
              <input
                type="number"
                aria-label={`${control.label} value`}
                min={control.min}
                max={control.max}
                step={control.step ?? 1}
                value={value}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) {
                    update({ [control.key]: Math.max(control.min, Math.min(control.max, next)) })
                  }
                }}
                className="w-10 rounded bg-transparent text-right text-foreground outline-none [appearance:textfield] focus-visible:bg-accent [&::-webkit-inner-spin-button]:appearance-none"
              />
              {control.unit && <span>{control.unit}</span>}
            </span>
          </div>
          <Slider
            id={`${layer.id}-${control.key}`}
            min={control.min}
            max={control.max}
            step={control.step}
            value={value}
            onValueChange={(next) => update({ [control.key]: next })}
          />
        </div>
      )
    }

    case "segment": {
      // Four options don't fit beside the label in the inspector's width.
      const stacked = control.options.length > 3

      return (
        <div
          className={cn(
            "flex gap-3 px-3 py-2.5",
            stacked ? "flex-col gap-2" : "items-center justify-between",
          )}
        >
          <span className="text-xs font-medium">{control.label}</span>
          <Segmented
            aria-label={control.label}
            value={settings[control.key]}
            options={control.options}
            onValueChange={(next) => update({ [control.key]: next })}
            className={cn(stacked && "w-full")}
          />
        </div>
      )
    }

    case "seed":
      return (
        <div className="flex items-center gap-3 px-3 py-2.5">
          <label htmlFor={`${layer.id}-${control.key}`} className="text-xs font-medium">
            {control.label}
          </label>
          <Slider
            id={`${layer.id}-${control.key}`}
            min={0}
            max={999}
            value={settings[control.key]}
            onValueChange={(next) => update({ [control.key]: next })}
            className="min-w-0 flex-1"
          />
          <span className="w-7 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {settings[control.key]}
          </span>
          <Tooltip content="Roll a new seed">
            <Button
              variant="muted"
              size="icon-xs"
              aria-label="Roll a new seed"
              onClick={() => update({ [control.key]: Math.floor(Math.random() * 1000) })}
              className="-me-1.5"
            >
              <Dices />
            </Button>
          </Tooltip>
        </div>
      )

    case "switch":
      return (
        <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-xs font-medium">{control.label}</span>
            {control.hint && (
              <span className="mt-0.5 block text-2xs text-muted-foreground">{control.hint}</span>
            )}
          </span>
          <Switch
            aria-label={control.label}
            checked={settings[control.key]}
            onCheckedChange={(checked) => update({ [control.key]: checked })}
          />
        </label>
      )

    case "text":
      return (
        <div className="flex flex-col gap-2 px-3 py-2.5">
          <span className="text-xs font-medium">{control.label}</span>
          <Input
            aria-label={control.label}
            value={settings[control.key]}
            onChange={(event) => update({ [control.key]: event.target.value })}
            className="font-mono"
            spellCheck={false}
          />
          <span className="text-2xs text-muted-foreground">Ordered dark → light</span>
        </div>
      )

    case "palette":
      return <PaletteControl layer={layer} editor={editor} />
  }
}

function PaletteControl({ layer, editor }: { layer: FilterLayer; editor: MediaEditor }) {
  const { actions, sourcePalette } = editor
  const [showLibrary, setShowLibrary] = useState(false)
  const colors = layer.settings.paletteColors
  const setColors = (next: string[], coalesce = false) =>
    actions.updatePalette(layer.id, next, coalesce)
  const activeName = paletteLibrary.find(
    (entry) => entry.colors.join() === colors.join(),
  )?.name

  return (
    <div className="flex flex-col gap-2.5 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          Palette{" "}
          <span className="font-normal text-muted-foreground tabular-nums">{colors.length}</span>
        </span>
        <div className="-me-1.5 flex items-center">
          <Tooltip content="Palette library">
            <Button
              variant="muted"
              size="icon-xs"
              aria-label="Palette library"
              aria-expanded={showLibrary}
              data-pressed={showLibrary}
              onClick={() => setShowLibrary((open) => !open)}
            >
              <SwatchBook />
            </Button>
          </Tooltip>
          <Tooltip content="Sample from source">
            <Button
              variant="muted"
              size="icon-xs"
              aria-label="Sample palette from source"
              onClick={() => setColors([...sourcePalette])}
            >
              <Pipette />
            </Button>
          </Tooltip>
          <Tooltip content="Randomize">
            <Button
              variant="muted"
              size="icon-xs"
              aria-label="Randomize palette"
              onClick={() => actions.randomizePalette(layer.id)}
            >
              <Shuffle />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((color, index) => (
          <div key={index} className="group/swatch relative aspect-square">
            <label
              className="block size-full cursor-pointer rounded-md shadow-xs/10 ring-1 ring-black/10 ring-inset transition-transform hover:scale-105 dark:ring-white/12"
              style={{ backgroundColor: color }}
              title={color}
            >
              <span className="sr-only">Palette color {index + 1}</span>
              <input
                type="color"
                value={color}
                onChange={(event) =>
                  setColors(
                    colors.map((current, i) => (i === index ? event.target.value : current)),
                    true,
                  )
                }
                className="sr-only"
              />
            </label>
            {colors.length > 1 && (
              <button
                type="button"
                aria-label={`Remove color ${index + 1}`}
                onClick={() => setColors(colors.filter((_, i) => i !== index))}
                className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full border bg-popover text-muted-foreground opacity-0 shadow-xs transition-opacity group-hover/swatch:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          aria-label="Add color"
          onClick={() => setColors([...colors, "#ffffff"])}
          className="grid aspect-square place-items-center rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/10">
        {colors.map((color, index) => (
          <span key={index} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      {showLibrary && (
        <div className="-mx-1 flex animate-fade-in flex-col gap-0.5 rounded-lg bg-input/24 p-1">
          {paletteLibrary.map((entry) => {
            const active = entry.name === activeName

            return (
              <button
                key={entry.name}
                type="button"
                aria-pressed={active}
                onClick={() => setColors([...entry.colors])}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-xs/10 dark:bg-input/72"
                    : "text-muted-foreground hover:bg-background/55 hover:text-foreground dark:hover:bg-input/32",
                )}
              >
                <span className="flex-1 truncate font-medium">{entry.name}</span>
                <span className="flex h-3 w-20 shrink-0 overflow-hidden rounded-sm ring-1 ring-black/10 ring-inset dark:ring-white/10">
                  {entry.colors.map((color, index) => (
                    <span key={index} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </span>
                {active ? (
                  <Check className="size-3 shrink-0 text-foreground" />
                ) : (
                  <span className="size-3 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Audio reactive --------------------------- */

const bandOptions = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
  { value: "beat", label: "Beat" },
] as const

function AudioControl({
  layer,
  editor,
  update,
}: {
  layer: FilterLayer
  editor: MediaEditor
  update: (settings: Partial<FilterLayerSettings>) => void
}) {
  const targets = getReactiveTargets(layer.type)
  if (!targets.length) return null

  const band = layer.settings.audioBand
  const target = getAudioTarget(layer)
  const listening = editor.audioSource !== "off"

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 shadow-xs/5 [&>*+*]:border-t [&>*+*]:border-border/50">
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <AudioLines className="size-3.5 text-muted-foreground" />
          React to sound
        </span>
        <Segmented
          aria-label="Audio band"
          value={band}
          options={[...bandOptions]}
          onValueChange={(next) => update({ audioBand: next })}
          className="w-full"
        />
        {band !== "off" && listening && <LevelMeters editor={editor} highlight={band} compact />}
      </div>

      {band !== "off" && (
        <>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <label htmlFor={`${layer.id}-audio-target`} className="text-xs font-medium">
              Drives
            </label>
            <select
              id={`${layer.id}-audio-target`}
              value={target?.key ?? ""}
              onChange={(event) => update({ audioTarget: event.target.value })}
              className="h-7 min-w-0 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/32"
            >
              {targets.map((control) => (
                <option key={control.key} value={control.key}>
                  {control.label}
                </option>
              ))}
            </select>
          </div>
          <div className="px-3 pt-2.5 pb-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${layer.id}-audio-amount`} className="text-xs font-medium">
                Amount
              </label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {layer.settings.audioAmount > 0 ? "+" : ""}
                {layer.settings.audioAmount}%
              </span>
            </div>
            <Slider
              id={`${layer.id}-audio-amount`}
              min={-100}
              max={100}
              value={layer.settings.audioAmount}
              onValueChange={(next) => update({ audioAmount: next })}
            />
          </div>
          {!listening && <ListenHint editor={editor} />}
        </>
      )}
    </div>
  )
}

/** Video only renders the first visible layer of each type. */
const getVideoShadowedLayers = (layers: FilterLayer[], isVideo: boolean) => {
  const shadowed = new Set<string>()
  if (!isVideo) return shadowed

  const seen = new Set<string>()
  for (const layer of layers) {
    if (!layer.visible) continue
    if (seen.has(layer.type)) shadowed.add(layer.id)
    seen.add(layer.type)
  }
  return shadowed
}
