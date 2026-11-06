import type { FilterLayer } from "../_types/editor"
import { sanitizePresetLayers, type Preset } from "./presets"

/* ---------------------------- Custom presets ----------------------------- */

const presetsKey = "vl-presets"
const presetListeners = new Set<() => void>()
let presetCache: { raw: string | null; value: Preset[] } = { raw: null, value: [] }
const emptyPresets: Preset[] = []

export const subscribeCustomPresets = (listener: () => void) => {
  presetListeners.add(listener)
  const onStorage = (event: StorageEvent) => event.key === presetsKey && listener()
  window.addEventListener("storage", onStorage)
  return () => {
    presetListeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export const getCustomPresets = (): Preset[] => {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(presetsKey)
  } catch {}

  // Keep a stable reference while storage is unchanged.
  if (raw === presetCache.raw) return presetCache.value

  let value: Preset[] = []
  try {
    const parsed = JSON.parse(raw ?? "[]") as Preset[]
    value = parsed.flatMap((preset) => {
      const layers = sanitizePresetLayers(preset.layers)
      return layers && typeof preset.name === "string"
        ? [{ ...preset, layers, custom: true }]
        : []
    })
  } catch {}

  presetCache = { raw, value }
  return value
}

export const getServerCustomPresets = () => emptyPresets

const writeCustomPresets = (presets: Preset[]) => {
  try {
    localStorage.setItem(presetsKey, JSON.stringify(presets))
  } catch {}
  presetListeners.forEach((listener) => listener())
}

export const saveCustomPreset = (preset: Preset) =>
  writeCustomPresets([...getCustomPresets(), preset])

export const deleteCustomPreset = (id: string) =>
  writeCustomPresets(getCustomPresets().filter((preset) => preset.id !== id))

/* ------------------------------ Session (IDB) ---------------------------- */

export type StoredSession = {
  file: Blob | null
  name: string | null
  type: string | null
  layers: FilterLayer[]
}

const dbName = "visual-lab"
const storeName = "session"
const maxPersistedBytes = 80 * 1024 * 1024

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(storeName, mode).objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

export const loadSession = async (): Promise<StoredSession | null> => {
  try {
    return ((await withStore("readonly", (store) => store.get("current"))) as StoredSession) ?? null
  } catch {
    return null
  }
}

// Serialize read-modify-write updates so media and layer saves never clobber each other.
let writeQueue: Promise<unknown> = Promise.resolve()
const enqueue = (task: () => Promise<void>) => {
  writeQueue = writeQueue.then(task, task)
  return writeQueue
}

export const saveSessionMedia = (file: File | null) =>
  enqueue(async () => {
    try {
      const current = (await loadSession()) ?? { layers: [] }
      const keep = file && file.size <= maxPersistedBytes
      await withStore("readwrite", (store) =>
        store.put(
          {
            ...current,
            file: keep ? file : null,
            name: keep ? file.name : null,
            type: keep ? file.type : null,
          },
          "current",
        ),
      )
    } catch {}
  })

export const saveSessionLayers = (layers: FilterLayer[]) =>
  enqueue(async () => {
    try {
      const current = (await loadSession()) ?? { file: null, name: null, type: null }
      await withStore("readwrite", (store) => store.put({ ...current, layers }, "current"))
    } catch {}
  })
