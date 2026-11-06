import { filterDefinitionMap } from "../../_lib/filter-registry"
import type { FilterLayer, StackableFilter } from "../../_types/editor"

export const formatBytes = (bytes: number) => {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent

  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safe / 60)
  const rest = Math.floor(safe % 60)

  return `${minutes}:${rest.toString().padStart(2, "0")}`
}

/** Numbers layers per type from the bottom of the stack, e.g. "Bloom 2". */
export const getLayerNames = (layers: FilterLayer[]) => {
  const counts = new Map<StackableFilter, number>()
  const totals = new Map<StackableFilter, number>()
  const names = new Map<string, string>()

  layers.forEach((layer) => totals.set(layer.type, (totals.get(layer.type) ?? 0) + 1))

  ;[...layers].reverse().forEach((layer) => {
    const count = (counts.get(layer.type) ?? 0) + 1
    const label = filterDefinitionMap[layer.type].label

    counts.set(layer.type, count)
    names.set(layer.id, (totals.get(layer.type) ?? 0) > 1 ? `${label} ${count}` : label)
  })

  return names
}

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName

  return (
    target.isContentEditable ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (tag === "INPUT" &&
      !["range", "checkbox", "radio", "button", "color"].includes(
        (target as HTMLInputElement).type,
      ))
  )
}
