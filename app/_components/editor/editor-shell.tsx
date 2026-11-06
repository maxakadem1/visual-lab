"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import {
  AudioLines,
  BookmarkPlus,
  ClipboardCopy,
  ClipboardPaste,
  Dna,
  Download,
  Eraser,
  Grid2x2,
  ImagePlus,
  LoaderCircle,
  Mic,
  Moon,
  PanelLeft,
  PanelRight,
  Redo2,
  Share2,
  SunMedium,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react"

import { filterDefinitions, getMediaBadge } from "../../_lib/filter-registry"
import { builtInPresets, presetSupportsMedia } from "../../_lib/presets"
import {
  getCustomPresets,
  getServerCustomPresets,
  subscribeCustomPresets,
} from "../../_lib/storage"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Badge, Separator } from "../ui/primitives"
import { Toaster, useToaster } from "../ui/toaster"
import { Tooltip } from "../ui/tooltip"
import { AppSidebar } from "./app-sidebar"
import { BreedDialog } from "./breed-dialog"
import { CommandMenu, type CommandItem } from "./command-menu"
import { isEditableTarget } from "./format"
import { Inspector } from "./inspector"
import { PatternDialog } from "./pattern-dialog"
import { SavePresetDialog } from "./save-preset-dialog"
import { Stage } from "./stage"
import { useMediaEditor, type Notify } from "./use-media-editor"
import { useTheme } from "./use-theme"

const useMediaQuery = (query: string, serverValue: boolean) =>
  useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  )

export function EditorShell() {
  const toaster = useToaster()
  const { push } = toaster
  const notify = useCallback<Notify>(
    (message, options) => push({ message, ...options }),
    [push],
  )
  const editor = useMediaEditor({ notify })
  const customPresets = useSyncExternalStore(
    subscribeCustomPresets,
    getCustomPresets,
    getServerCustomPresets,
  )
  const { media, layers, selectedLayerId, actions, fileInputRef } = editor
  const { theme, toggleTheme } = useTheme()
  const isWide = useMediaQuery("(min-width: 768px)", true)
  const isXWide = useMediaQuery("(min-width: 1180px)", true)
  const [sidebarPref, setSidebarPref] = useState<boolean | null>(null)
  const [inspectorPref, setInspectorPref] = useState<boolean | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [savePresetOpen, setSavePresetOpen] = useState(false)
  const [breedOpen, setBreedOpen] = useState(false)
  const [patternOpen, setPatternOpen] = useState(false)

  const sidebarOpen = sidebarPref ?? isWide
  const inspectorOpen = inspectorPref ?? isXWide
  const toggleSidebar = () => setSidebarPref(!sidebarOpen)
  const toggleInspector = () => setInspectorPref(!inspectorOpen)
  const canExport = Boolean(media)
  const canCopyImage = media?.kind === "image"
  const isVideo = media?.kind === "video"
  const exportLabel = isVideo ? "Export video" : "Export PNG"
  const isRecording = editor.isExporting && editor.exportProgress !== null
  const canSavePreset = Boolean(media) && layers.length > 0

  const onKey = (event: KeyboardEvent) => {
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()

    if (mod && key === "k") {
      event.preventDefault()
      setCommandOpen((open) => !open)
      return
    }
    if (commandOpen || savePresetOpen || breedOpen || patternOpen) return

    if (mod && key === "o") {
      event.preventDefault()
      actions.openFilePicker()
    } else if (mod && key === "e") {
      event.preventDefault()
      if (isRecording) actions.cancelExport()
      else if (canExport) void actions.exportMedia()
    } else if (mod && key === "b") {
      event.preventDefault()
      toggleSidebar()
    } else if (mod && key === "i") {
      event.preventDefault()
      toggleInspector()
    } else if (mod && key === "d" && selectedLayerId) {
      event.preventDefault()
      actions.duplicateLayer(selectedLayerId)
    } else if (mod && key === "s") {
      event.preventDefault()
      if (canSavePreset) setSavePresetOpen(true)
    } else if (isEditableTarget(event.target)) {
      // Leave native text undo, copy and shortcuts to inputs.
      return
    } else if (mod && key === "z") {
      event.preventDefault()
      if (event.shiftKey) actions.redo()
      else actions.undo()
    } else if (mod && key === "y") {
      event.preventDefault()
      actions.redo()
    } else if (mod && key === "c" && canCopyImage && !window.getSelection()?.toString()) {
      event.preventDefault()
      void actions.copyImage()
    } else if (key === " " && media?.kind === "video") {
      event.preventDefault()
      actions.toggleVideoPlayback()
    } else if ((key === "delete" || key === "backspace") && selectedLayerId) {
      event.preventDefault()
      actions.deleteLayer(selectedLayerId)
    } else if (key === "h" && selectedLayerId && !mod) {
      actions.toggleLayerVisibility(selectedLayerId)
    }
  }

  // Re-bind each render so the handler sees current state without stale closures.
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const commands: CommandItem[] = [
    ...filterDefinitions.map(
      (definition): CommandItem => ({
        id: `add-${definition.type}`,
        group: "Add effect",
        label: definition.label,
        description: definition.description,
        icon: <definition.icon />,
        badge: getMediaBadge(definition),
        disabled: !media || !editor.supportedFilters.includes(definition.type),
        keywords: "filter layer effect",
        run: () => actions.addLayer(definition.type),
      }),
    ),
    ...[...customPresets, ...builtInPresets].map(
      (preset): CommandItem => ({
        id: `preset-${preset.id}`,
        group: "Presets",
        label: preset.name,
        description: preset.description,
        icon: <WandSparkles />,
        badge: preset.custom ? "Yours" : undefined,
        disabled: !media || !presetSupportsMedia(preset, media.kind),
        keywords: "preset look style",
        run: () => actions.applyPreset(preset),
      }),
    ),
    {
      id: "breed",
      group: "Play",
      label: "Breed mode",
      description: "Evolve the look: pick the best of 8 mutations, repeat",
      icon: <Dna />,
      disabled: !media,
      keywords: "evolve mutate random variations genetic surprise",
      run: () => setBreedOpen(true),
    },
    {
      id: "pattern",
      group: "Play",
      label: "Make a pattern",
      description: "Printable bead, cross-stitch or brick chart",
      icon: <Grid2x2 />,
      disabled: !media,
      keywords: "bead perler hama fuse cross stitch embroidery lego brick mosaic print craft",
      run: () => setPatternOpen(true),
    },
    {
      id: "audio-media",
      group: "Play",
      label: "React to the soundtrack",
      description: "Effects pulse with the video's audio",
      icon: <AudioLines />,
      disabled: media?.kind !== "video" || editor.audioSource === "media",
      keywords: "audio music sound reactive beat",
      run: () => void actions.startAudio("media"),
    },
    {
      id: "audio-mic",
      group: "Play",
      label: "React to the microphone",
      description: "Effects pulse with sound around you",
      icon: <Mic />,
      disabled: !media || editor.audioSource === "mic",
      keywords: "audio music sound reactive beat mic",
      run: () => void actions.startAudio("mic"),
    },
    ...(editor.audioSource !== "off"
      ? [
          {
            id: "audio-off",
            group: "Play",
            label: "Stop listening",
            icon: <X />,
            keywords: "audio off mute",
            run: () => void actions.startAudio("off"),
          } satisfies CommandItem,
        ]
      : []),
    {
      id: "undo",
      group: "Edit",
      label: "Undo",
      icon: <Undo2 />,
      shortcut: "mod+z",
      disabled: !editor.canUndo,
      run: actions.undo,
    },
    {
      id: "redo",
      group: "Edit",
      label: "Redo",
      icon: <Redo2 />,
      shortcut: "mod+shift+z",
      disabled: !editor.canRedo,
      run: actions.redo,
    },
    {
      id: "save-preset",
      group: "Edit",
      label: "Save look as preset",
      icon: <BookmarkPlus />,
      shortcut: "mod+s",
      disabled: !canSavePreset,
      run: () => setSavePresetOpen(true),
    },
    {
      id: "share",
      group: "Edit",
      label: "Copy share link",
      description: "A URL that recreates this layer stack",
      icon: <Share2 />,
      disabled: layers.length === 0,
      keywords: "url link share look",
      run: () => void actions.copyShareLink(),
    },
    {
      id: "open",
      group: "File",
      label: media ? "Replace media" : "Open media",
      icon: <ImagePlus />,
      shortcut: "mod+o",
      keywords: "upload import file image video",
      run: actions.openFilePicker,
    },
    {
      id: "export",
      group: "File",
      label: exportLabel,
      description: isVideo ? "Records the filtered video in real time" : undefined,
      icon: <Download />,
      shortcut: "mod+e",
      disabled: !canExport || editor.isExporting,
      keywords: "download save render mp4 webm png",
      run: () => void actions.exportMedia(),
    },
    ...(isRecording
      ? [
          {
            id: "cancel-export",
            group: "File",
            label: "Cancel video export",
            icon: <X />,
            run: actions.cancelExport,
          } satisfies CommandItem,
        ]
      : []),
    {
      id: "copy-image",
      group: "File",
      label: "Copy image",
      icon: <ClipboardCopy />,
      shortcut: "mod+c",
      disabled: !canCopyImage,
      keywords: "clipboard",
      run: () => void actions.copyImage(),
    },
    {
      id: "paste",
      group: "File",
      label: "Paste from clipboard",
      icon: <ClipboardPaste />,
      shortcut: "mod+v",
      keywords: "clipboard import",
      run: () => void actions.pasteFromClipboard(),
    },
    {
      id: "clear-layers",
      group: "File",
      label: "Remove all layers",
      icon: <Eraser />,
      disabled: layers.length === 0,
      run: actions.clearLayers,
    },
    {
      id: "remove-media",
      group: "File",
      label: "Close media",
      icon: <X />,
      disabled: !media,
      run: actions.clearMedia,
    },
    {
      id: "sidebar",
      group: "View",
      label: sidebarOpen ? "Hide sidebar" : "Show sidebar",
      icon: <PanelLeft />,
      shortcut: "mod+b",
      run: toggleSidebar,
    },
    {
      id: "inspector",
      group: "View",
      label: inspectorOpen ? "Hide inspector" : "Show inspector",
      icon: <PanelRight />,
      shortcut: "mod+i",
      run: toggleInspector,
    },
    {
      id: "theme",
      group: "View",
      label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: theme === "dark" ? <SunMedium /> : <Moon />,
      keywords: "theme appearance",
      run: toggleTheme,
    },
  ]

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-sm text-foreground">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => actions.selectFile(event.target.files?.[0])}
      />

      {/* Left sidebar: inline on desktop, drawer on mobile. */}
      {sidebarOpen && !isWide && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-background/60 backdrop-blur-[2px]"
          onClick={() => setSidebarPref(false)}
        />
      )}
      <div
        className={cn(
          "h-full shrink-0 overflow-hidden transition-[width,translate] duration-300 ease-drawer",
          isWide
            ? sidebarOpen
              ? "w-(--sidebar-width)"
              : "w-0"
            : cn(
                "fixed inset-y-0 left-0 z-40 shadow-2xl",
                sidebarOpen ? "translate-x-0" : "-translate-x-full",
              ),
        )}
      >
        <AppSidebar
          editor={editor}
          onCollapse={() => setSidebarPref(false)}
          onOpenCommandMenu={() => setCommandOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSavePreset={() => setSavePresetOpen(true)}
        />
      </div>

      <main className="surface-grain flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-(--topbar-height) shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          {!sidebarOpen && (
            <Tooltip content="Show sidebar" shortcut="mod+b" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Show sidebar"
                onClick={toggleSidebar}
                className="-ms-1"
              >
                <PanelLeft />
              </Button>
            </Tooltip>
          )}

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Workspace</span>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <span className="truncate font-medium text-foreground">
              {media ? media.name : "Untitled"}
            </span>
          </nav>
          {media && (
            <Badge variant="outline" className="capitalize">
              {media.kind}
            </Badge>
          )}

          <div className="flex-1" />

          {media && (
            <div className="hidden items-center gap-2 font-mono text-2xs text-muted-foreground tabular-nums lg:flex">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    editor.canvasRenderMode === "webgl-video" ? "bg-success" : "bg-info",
                  )}
                />
                {editor.canvasRenderMode === "webgl-video" ? "WebGL" : "Canvas 2D"}
              </span>
              {editor.renderMs !== null && media.kind === "image" && (
                <span>{editor.renderMs.toFixed(0)} ms</span>
              )}
              <span>
                {layers.filter((layer) => layer.visible).length}/{layers.length} layers
              </span>
            </div>
          )}

          {media && (
            <div className="flex items-center">
              <Separator orientation="vertical" className="mx-2 my-2 hidden lg:block" />
              <Tooltip content="Undo" shortcut="mod+z" side="bottom">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Undo"
                  disabled={!editor.canUndo}
                  onClick={actions.undo}
                >
                  <Undo2 />
                </Button>
              </Tooltip>
              <Tooltip content="Redo" shortcut="mod+shift+z" side="bottom">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Redo"
                  disabled={!editor.canRedo}
                  onClick={actions.redo}
                >
                  <Redo2 />
                </Button>
              </Tooltip>
              <Separator orientation="vertical" className="mx-1.5 my-2 hidden sm:block" />
              <Tooltip content="Copy share link" side="bottom">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy share link"
                  disabled={layers.length === 0}
                  onClick={() => void actions.copyShareLink()}
                  className="hidden sm:inline-flex"
                >
                  <Share2 />
                </Button>
              </Tooltip>
              <Tooltip content="Copy image" shortcut="mod+c" side="bottom">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy image"
                  disabled={!canCopyImage}
                  onClick={() => void actions.copyImage()}
                  className="hidden sm:inline-flex"
                >
                  <ClipboardCopy />
                </Button>
              </Tooltip>
            </div>
          )}

          <Tooltip
            content={isRecording ? "Cancel export" : exportLabel}
            shortcut={canExport ? "mod+e" : undefined}
            side="bottom"
          >
            <span className="inline-flex">
              <Button
                size="sm"
                variant={isRecording ? "outline" : undefined}
                disabled={!canExport || (editor.isExporting && !isRecording)}
                onClick={() =>
                  isRecording ? actions.cancelExport() : void actions.exportMedia()
                }
                aria-label={
                  isRecording
                    ? `Cancel export, ${Math.round((editor.exportProgress ?? 0) * 100)}% done`
                    : undefined
                }
                className="group/export relative isolate ms-1 overflow-hidden"
              >
                {isRecording && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 -z-10 bg-primary/15 transition-[width] duration-300"
                    style={{ width: `${(editor.exportProgress ?? 0) * 100}%` }}
                  />
                )}
                {isRecording ? (
                  <>
                    <LoaderCircle className="animate-spin group-hover/export:hidden" />
                    <X className="hidden group-hover/export:block" />
                  </>
                ) : editor.isExporting ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Download />
                )}
                <span className="hidden tabular-nums sm:inline">
                  {isRecording
                    ? `${Math.round((editor.exportProgress ?? 0) * 100)}%`
                    : editor.isExporting
                      ? "Exporting…"
                      : "Export"}
                </span>
              </Button>
            </span>
          </Tooltip>

          {!inspectorOpen && (
            <Tooltip content="Show inspector" shortcut="mod+i" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Show inspector"
                onClick={toggleInspector}
                className="-me-1"
              >
                <PanelRight />
              </Button>
            </Tooltip>
          )}
        </header>

        <Stage
          editor={editor}
          onOpenCommandMenu={() => setCommandOpen(true)}
          onOpenBreed={() => setBreedOpen(true)}
          onOpenPattern={() => setPatternOpen(true)}
        />
      </main>

      {inspectorOpen && !isXWide && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-background/60 backdrop-blur-[2px]"
          onClick={() => setInspectorPref(false)}
        />
      )}
      <div
        className={cn(
          "h-full shrink-0 overflow-hidden transition-[width,translate] duration-300 ease-drawer",
          isXWide
            ? inspectorOpen
              ? "w-(--inspector-width)"
              : "w-0"
            : cn(
                "fixed inset-y-0 right-0 z-40 max-w-[92vw] shadow-2xl",
                inspectorOpen ? "translate-x-0" : "translate-x-full",
              ),
        )}
      >
        <Inspector
          editor={editor}
          onCollapse={() => setInspectorPref(false)}
          onOpenCommandMenu={() => setCommandOpen(true)}
        />
      </div>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} items={commands} />
      <SavePresetDialog
        open={savePresetOpen}
        layers={layers}
        onClose={() => setSavePresetOpen(false)}
        onSave={actions.saveStackAsPreset}
      />
      <BreedDialog open={breedOpen} editor={editor} onClose={() => setBreedOpen(false)} />
      <PatternDialog open={patternOpen} editor={editor} onClose={() => setPatternOpen(false)} />
      <Toaster toasts={toaster.toasts} onDismiss={toaster.dismiss} />

      <span className="sr-only" aria-live="polite">
        {media ? `${media.name} loaded with ${layers.length} layers` : ""}
      </span>
    </div>
  )
}
