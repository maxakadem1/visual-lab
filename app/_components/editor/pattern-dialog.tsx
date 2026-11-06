"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Camera, Download, FileSpreadsheet, Grid2x2, LoaderCircle, X } from "lucide-react"

import {
  buildPattern,
  drawPatternCells,
  patternToCsv,
  pegboardSize,
  renderPatternSheet,
  type PatternKind,
  type PatternPaletteSource,
} from "../../_lib/bead-pattern"
import { filterDefinitionMap } from "../../_lib/filter-registry"
import { Button } from "../ui/button"
import { Kbd, Segmented, Slider, Switch } from "../ui/primitives"
import { downloadBlob, type MediaEditor } from "./use-media-editor"

const kinds: { value: PatternKind; label: string; unit: string }[] = [
  { value: "beads", label: "Beads", unit: "beads" },
  { value: "stitch", label: "Cross-stitch", unit: "stitches" },
  { value: "bricks", label: "Bricks", unit: "bricks" },
]

export function PatternDialog({
  open,
  editor,
  onClose,
}: {
  open: boolean
  editor: MediaEditor
  onClose: () => void
}) {
  if (!open || !editor.media) return null
  return createPortal(<PatternMaker editor={editor} onClose={onClose} />, document.body)
}

function PatternMaker({ editor, onClose }: { editor: MediaEditor; onClose: () => void }) {
  const { media, layers, sourcePalette, actions, notify } = editor
  const [source, setSource] = useState<HTMLCanvasElement | null>(() => actions.captureProcessedFrame())
  const [kind, setKind] = useState<PatternKind>("beads")
  const [columns, setColumns] = useState(pegboardSize * 2)
  const [paletteSource, setPaletteSource] = useState<PatternPaletteSource>("craft")
  const [maxColors, setMaxColors] = useState(16)
  const [dither, setDither] = useState(false)
  const [symbols, setSymbols] = useState(true)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)

  // Colors from the look's own palette layers, else the source's main colors.
  const lookColors = useMemo(() => {
    const fromLayers = layers
      .filter(
        (layer) =>
          layer.visible &&
          filterDefinitionMap[layer.type].controls.some((control) => control.kind === "palette"),
      )
      .flatMap((layer) => layer.settings.paletteColors)
    return fromLayers.length ? fromLayers : sourcePalette
  }, [layers, sourcePalette])

  const pattern = useMemo(
    () =>
      source
        ? buildPattern(source, { columns, paletteSource, lookColors, maxColors, dither })
        : null,
    [source, columns, paletteSource, lookColors, maxColors, dither],
  )

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !pattern) return
    const box = canvas.parentElement!.getBoundingClientRect()
    const cell = Math.max(2, Math.floor(Math.min(box.width / pattern.columns, box.height / pattern.rows)))
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = pattern.columns * cell * ratio
    canvas.height = pattern.rows * cell * ratio
    canvas.style.width = `${pattern.columns * cell}px`
    canvas.style.height = `${pattern.rows * cell}px`
    drawPatternCells(canvas, pattern, kind, cell * ratio, { symbols: symbols && kind === "stitch" })
  }, [pattern, kind, symbols])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onClose])

  const unit = kinds.find((entry) => entry.value === kind)!.unit
  const fileBase = (media?.name ?? "pattern").replace(/\.[^.]+$/, "").trim() || "pattern"

  const downloadSheet = () => {
    if (!pattern || !media) return
    setSaving(true)
    // Let the spinner paint before the big canvas render blocks the thread.
    window.setTimeout(() => {
      try {
        const sheet = renderPatternSheet(pattern, {
          kind,
          symbols,
          title: `${fileBase} · ${kinds.find((entry) => entry.value === kind)!.label} pattern`,
        })
        sheet.toBlob((blob) => {
          setSaving(false)
          if (!blob) {
            notify("Couldn't render the pattern", { tone: "error" })
            return
          }
          const name = `${fileBase}-${kind}-pattern.png`
          downloadBlob(blob, name)
          notify(`Saved ${name}`)
        }, "image/png")
      } catch (error) {
        console.error(error)
        setSaving(false)
        notify("Couldn't render the pattern", { tone: "error" })
      }
    }, 30)
  }

  const downloadCsv = () => {
    if (!pattern) return
    downloadBlob(
      new Blob([patternToCsv(pattern)], { type: "text/csv" }),
      `${fileBase}-${kind}-colors.csv`,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-background/70 backdrop-blur-md" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pattern-title"
        className="dropdown-glass relative flex max-h-full w-full max-w-5xl animate-pop-in flex-col overflow-hidden rounded-xl shadow-[0_24px_64px_-24px_rgb(0_0_0/65%)] md:flex-row"
      >
        <div className="flex min-h-[18rem] flex-1 items-center justify-center bg-[repeating-conic-gradient(rgb(0_0_0/4%)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4 md:min-h-[34rem]">
          <div className="flex size-full items-center justify-center">
            {pattern ? (
              <canvas ref={previewRef} className="rounded-sm shadow-md ring-1 ring-black/10" />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to turn into a pattern yet.</p>
            )}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t p-4 md:w-80 md:border-t-0 md:border-l">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="pattern-title" className="flex items-center gap-2 text-sm font-semibold">
                <Grid2x2 className="size-4 text-primary" />
                Make a pattern
              </h2>
              <p className="mt-1 text-xs text-balance text-muted-foreground">
                Turns the current look into a printable chart with a shopping list.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
              <X />
            </Button>
          </div>

          <Segmented
            aria-label="Pattern type"
            value={kind}
            onValueChange={setKind}
            options={kinds.map(({ value, label }) => ({ value, label }))}
            className="w-full"
          />

          <Field label="Width" value={`${columns} ${unit}`}>
            <Slider aria-label="Width" min={12} max={200} value={columns} onValueChange={setColumns} />
            {kind === "beads" && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[1, 2, 3, 4].map((boards) => (
                  <button
                    key={boards}
                    type="button"
                    onClick={() => setColumns(boards * pegboardSize)}
                    className="rounded-md border border-input px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:text-foreground data-[on=true]:border-primary data-[on=true]:text-foreground"
                    data-on={columns === boards * pegboardSize}
                  >
                    {boards} board{boards > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">Colors from</span>
            <Segmented
              aria-label="Colors from"
              value={paletteSource}
              onValueChange={setPaletteSource}
              options={[
                { value: "craft", label: "Craft set" },
                { value: "look", label: "The look" },
                { value: "image", label: "Image" },
              ]}
              className="w-full"
            />
            <span className="text-2xs text-muted-foreground">
              {paletteSource === "craft"
                ? "Common bead and thread colors."
                : paletteSource === "look"
                  ? "The palette of your Colors and Dither layers."
                  : "The best colors for this picture."}
            </span>
          </div>

          <Field label="Max colors" value={String(maxColors)}>
            <Slider aria-label="Max colors" min={2} max={40} value={maxColors} onValueChange={setMaxColors} />
          </Field>

          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-xs font-medium">Dither</span>
            <Switch aria-label="Dither" checked={dither} onCheckedChange={setDither} />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-xs font-medium">Symbols on the chart</span>
              <span className="block text-2xs text-muted-foreground">Easier to follow in print</span>
            </span>
            <Switch aria-label="Symbols on the chart" checked={symbols} onCheckedChange={setSymbols} />
          </label>

          {pattern && (
            <div className="rounded-lg bg-input/30 p-2.5">
              <div className="font-mono text-2xs text-muted-foreground tabular-nums">
                {pattern.columns} × {pattern.rows} · {(pattern.columns * pattern.rows).toLocaleString()} {unit}
                {kind === "beads" &&
                  ` · ${Math.ceil(pattern.columns / pegboardSize) * Math.ceil(pattern.rows / pegboardSize)} boards`}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {pattern.colors.map((color) => (
                  <span
                    key={color.hex + color.symbol}
                    title={`${color.symbol} · ${color.name} · ${color.count}`}
                    className="size-4 rounded-sm ring-1 ring-black/10 ring-inset dark:ring-white/12"
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            {media?.kind === "video" && (
              <Button variant="outline" size="sm" onClick={() => setSource(actions.captureProcessedFrame())}>
                <Camera />
                Use the current frame
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!pattern} onClick={downloadCsv} className="flex-1">
                <FileSpreadsheet />
                Color list
              </Button>
              <Button size="sm" disabled={!pattern || saving} onClick={downloadSheet} className="flex-1">
                {saving ? <LoaderCircle className="animate-spin" /> : <Download />}
                Chart PNG
              </Button>
            </div>
            <span className="text-center text-2xs text-muted-foreground">
              <Kbd>Esc</Kbd> to close
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  )
}
