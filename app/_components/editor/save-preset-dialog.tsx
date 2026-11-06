"use client"

import { useState } from "react"
import { createPortal } from "react-dom"

import { filterDefinitionMap } from "../../_lib/filter-registry"
import type { FilterLayer } from "../../_types/editor"
import { Button } from "../ui/button"
import { Input, Kbd } from "../ui/primitives"

export function SavePresetDialog({
  open,
  layers,
  onClose,
  onSave,
}: {
  open: boolean
  layers: FilterLayer[]
  onClose: () => void
  onSave: (name: string) => void
}) {
  if (!open) return null

  return createPortal(
    <SavePresetForm layers={layers} onClose={onClose} onSave={onSave} />,
    document.body,
  )
}

function SavePresetForm({
  layers,
  onClose,
  onSave,
}: {
  layers: FilterLayer[]
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(() =>
    layers
      .slice(0, 2)
      .map((layer) => filterDefinitionMap[layer.type].label)
      .join(" + "),
  )

  const submit = () => {
    if (!name.trim()) return
    onSave(name)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-background/60 backdrop-blur-[4px]"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-preset-title"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="dropdown-glass relative flex w-full max-w-sm animate-pop-in flex-col gap-4 rounded-xl p-4 shadow-[0_24px_64px_-24px_rgb(0_0_0/65%)]"
      >
        <div>
          <h2 id="save-preset-title" className="text-sm font-semibold">
            Save as preset
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Saves the current {layers.length}-layer stack to this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {layers.map((layer) => {
            const definition = filterDefinitionMap[layer.type]
            const Icon = definition.icon
            return (
              <span
                key={layer.id}
                className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2 text-xs text-muted-foreground"
              >
                <Icon className="size-3" />
                {definition.label}
              </span>
            )
          })}
        </div>
        <Input
          autoFocus
          aria-label="Preset name"
          placeholder="Preset name"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
            <Kbd>Esc</Kbd>
          </Button>
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Save preset
          </Button>
        </div>
      </form>
    </div>
  )
}
