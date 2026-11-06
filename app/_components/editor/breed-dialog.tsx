"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Check, Dna, RefreshCw } from "lucide-react"

import { breed, type MutationStrength } from "../../_lib/breed"
import { filterDefinitionMap } from "../../_lib/filter-registry"
import { drawFilteredImage } from "../../_lib/image-filters"
import type { FilterLayer } from "../../_types/editor"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Kbd, Segmented } from "../ui/primitives"
import type { MediaEditor } from "./use-media-editor"
import { scaleSettings } from "./use-preset-thumbnails"

const thumbEdge = 420
const childCount = 8
/** Grid slot of the parent: the middle of a 3×3. */
const parentSlot = 4

export function BreedDialog({
  open,
  editor,
  onClose,
}: {
  open: boolean
  editor: MediaEditor
  onClose: () => void
}) {
  if (!open || !editor.media) return null
  return createPortal(<BreedBoard editor={editor} onClose={onClose} />, document.body)
}

type Brood = { parent: FilterLayer[]; children: FilterLayer[][] }

function BreedBoard({ editor, onClose }: { editor: MediaEditor; onClose: () => void }) {
  const { media, mediaInfo, supportedFilters, sourcePalette, actions } = editor
  const [strength, setStrength] = useState<MutationStrength>("gentle")
  const allowed = supportedFilters.filter((type) => !filterDefinitionMap[type].temporal)
  const [brood, setBrood] = useState<Brood>(() => ({
    parent: editor.layers,
    children: breed(editor.layers, childCount, { strength: "gentle", allowed, sourcePalette }),
  }))
  const [lineage, setLineage] = useState<FilterLayer[][]>([])
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const renderToken = useRef(0)

  const aspect = source ? source.width / source.height : 4 / 3

  const spawn = (parent: FilterLayer[], withStrength = strength) =>
    setBrood({
      parent,
      children: breed(parent, childCount, { strength: withStrength, allowed, sourcePalette }),
    })

  const changeStrength = (next: MutationStrength) => {
    setStrength(next)
    spawn(brood.parent, next)
  }

  // Grab the source once; video uses the frame on screen.
  useEffect(() => {
    let cancelled = false
    void actions.captureSourceFrame(thumbEdge * Math.min(2, window.devicePixelRatio || 1)).then((canvas) => {
      if (!cancelled) setSource(canvas)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render thumbnails one per task so the dialog stays responsive.
  useEffect(() => {
    if (!source || !mediaInfo) return
    const token = ++renderToken.current
    const longEdge = Math.max(mediaInfo.width, mediaInfo.height) || Math.max(source.width, source.height)
    const workingEdge = media?.kind === "video" ? Math.min(longEdge, 960) : Math.min(longEdge, 1200)
    const effectScale = Math.min(1, Math.max(source.width, source.height) / workingEdge)
    const stacks = slots(brood)
    let index = 0
    let timeout = 0

    const renderNext = () => {
      if (renderToken.current !== token || index >= stacks.length) return
      const slot = index
      const stack = stacks[slot]
      index += 1
      if (!stack) {
        timeout = window.setTimeout(renderNext, 0)
        return
      }

      const canvas = document.createElement("canvas")
      drawFilteredImage(canvas, source, source.width, source.height, {
        filterLayers: stack.map((layer) => ({
          ...layer,
          settings: scaleSettings(layer.settings, effectScale),
        })),
      })
      const url = canvas.toDataURL("image/jpeg", 0.85)
      setThumbs((current) => ({ ...current, [slot]: url }))
      timeout = window.setTimeout(renderNext, 0)
    }

    timeout = window.setTimeout(() => {
      setThumbs({})
      renderNext()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [brood, source, mediaInfo, media?.kind])

  const adopt = (child: FilterLayer[]) => {
    setLineage((current) => [...current, brood.parent])
    actions.replaceLayers(child)
    spawn(child)
  }

  const goBack = () => {
    const previous = lineage.at(-1)
    if (!previous) return
    setLineage((current) => current.slice(0, -1))
    actions.replaceLayers(previous)
    spawn(previous)
  }

  const pickSlot = (slot: number) => {
    if (slot === parentSlot) {
      onClose()
      return
    }
    const child = slots(brood)[slot]
    if (child) adopt(child)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      } else if (/^[1-9]$/.test(event.key)) {
        event.preventDefault()
        pickSlot(Number(event.key) - 1)
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault()
        spawn(brood.parent)
      } else if (event.key === "Backspace") {
        event.preventDefault()
        goBack()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  })

  const stacks = slots(brood)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-background/80 px-4 py-4 backdrop-blur-md animate-fade-in sm:py-6">
      <header className="flex w-full max-w-5xl flex-wrap items-center gap-2 pb-4">
        <span className="grid size-8 place-items-center rounded-lg border bg-card shadow-xs/5">
          <Dna className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            Breed mode
            <span className="ms-2 font-normal text-muted-foreground tabular-nums">
              Generation {lineage.length + 1}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Pick the child you like best. It becomes the parent of the next brood.
          </p>
        </div>
        <Segmented
          aria-label="Mutation strength"
          value={strength}
          onValueChange={changeStrength}
          options={[
            { value: "gentle", label: "Gentle" },
            { value: "wild", label: "Wild" },
          ]}
        />
        <Button variant="ghost" size="sm" disabled={!lineage.length} onClick={goBack}>
          <ArrowLeft />
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => spawn(brood.parent)}>
          <RefreshCw />
          Reroll
          <Kbd>R</Kbd>
        </Button>
        <Button size="sm" onClick={onClose}>
          <Check />
          Done
        </Button>
      </header>

      <div
        className="grid min-h-0 w-full grid-cols-3 gap-2 sm:gap-3"
        style={{ maxWidth: `min(64rem, calc((100dvh - 9rem) * ${aspect.toFixed(4)}))` }}
      >
        {Array.from({ length: 9 }, (_, slot) => {
          const stack = stacks[slot]
          const isParent = slot === parentSlot
          const thumb = thumbs[slot]

          return (
            <button
              key={slot}
              type="button"
              disabled={!stack}
              onClick={() => pickSlot(slot)}
              className={cn(
                "group/child relative overflow-hidden rounded-lg bg-card text-left shadow-sm outline-none ring-1 ring-border transition-[transform,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30",
                isParent
                  ? "ring-2 ring-primary"
                  : "hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/60",
              )}
              style={{ aspectRatio: aspect }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- generated data URL
                <img src={thumb} alt="" className="size-full animate-fade-in object-cover" />
              ) : (
                <span className="block size-full animate-pulse bg-input/40" />
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-white">
                <span className="flex min-w-0 flex-wrap gap-1">
                  {(stack ?? []).filter((layer) => layer.visible).slice(0, 5).map((layer, index) => {
                    const Icon = filterDefinitionMap[layer.type].icon
                    return (
                      <span
                        key={index}
                        title={filterDefinitionMap[layer.type].label}
                        className="grid size-5 place-items-center rounded-md bg-black/45 backdrop-blur-sm"
                      >
                        <Icon className="size-3" />
                      </span>
                    )
                  })}
                </span>
                <span className="shrink-0 text-2xs font-medium text-white/80">
                  {isParent ? "Current · keep" : <Kbd className="bg-white/15 text-white/90">{slot + 1}</Kbd>}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {media?.kind === "video" && (
        <p className="pt-3 text-2xs text-muted-foreground">
          Previews use the current frame. Time effects like slit-scan only show while playing.
        </p>
      )}
    </div>
  )
}

/** Children fill the eight outer slots around the parent. */
const slots = (brood: Brood) => {
  const result: (FilterLayer[] | undefined)[] = []
  let child = 0
  for (let slot = 0; slot < 9; slot += 1) {
    result.push(slot === parentSlot ? brood.parent : brood.children[child++])
  }
  return result
}
