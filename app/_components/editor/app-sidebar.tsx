"use client"

import {
  Command,
  Film,
  ImagePlus,
  Moon,
  PanelLeft,
  Plus,
  SunMedium,
  X,
} from "lucide-react"

import { useState, useSyncExternalStore } from "react"

import { filterDefinitions, getMediaBadge } from "../../_lib/filter-registry"
import { builtInPresets } from "../../_lib/presets"
import {
  getCustomPresets,
  getServerCustomPresets,
  subscribeCustomPresets,
} from "../../_lib/storage"
import { Button } from "../ui/button"
import { cn } from "../ui/cn"
import { Badge, Segmented, Shortcut } from "../ui/primitives"
import { Tooltip } from "../ui/tooltip"
import { formatBytes } from "./format"
import { LogoMark } from "./logo"
import { PresetsPanel } from "./presets-panel"
import type { MediaEditor } from "./use-media-editor"

export function AppSidebar({
  editor,
  onCollapse,
  onOpenCommandMenu,
  theme,
  onToggleTheme,
  onSavePreset,
}: {
  editor: MediaEditor
  onCollapse: () => void
  onOpenCommandMenu: () => void
  theme: "dark" | "light"
  onToggleTheme: () => void
  onSavePreset: () => void
}) {
  const { media, mediaInfo, layers, supportedFilters, actions } = editor
  const [tab, setTab] = useState<"effects" | "presets">("effects")
  const customPresets = useSyncExternalStore(
    subscribeCustomPresets,
    getCustomPresets,
    getServerCustomPresets,
  )
  const countsByType = new Map<string, number>()

  layers.forEach((layer) =>
    countsByType.set(layer.type, (countsByType.get(layer.type) ?? 0) + 1),
  )

  return (
    <aside className="surface-grain flex h-full w-(--sidebar-width) shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <header className="flex h-(--topbar-height) shrink-0 items-center gap-2.5 pr-2 pl-4">
        <LogoMark />
        <span className="text-sm font-semibold tracking-tight">Visual Lab</span>
        <Badge variant="secondary" className="font-mono">
          beta
        </Badge>
        <div className="flex-1" />
        <Tooltip content="Hide sidebar" shortcut="mod+b" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hide sidebar"
            onClick={onCollapse}
          >
            <PanelLeft />
          </Button>
        </Tooltip>
      </header>

      <div className="px-2 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={actions.openFilePicker}
        >
          <ImagePlus />
          <span className="flex-1 text-left">{media ? "Replace media" : "Open media"}</span>
          <Shortcut keys="mod+o" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SidebarGroup label="Source">
          {media ? (
            <div className="group/source flex items-center gap-2.5 rounded-md bg-sidebar-row-selected px-2 py-1.5 not-dark:shadow-xs/5 not-dark:ring-1 not-dark:ring-border/70">
              <div className="checkerboard grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border/60">
                {media.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob URL thumbnail
                  <img src={media.url} alt="" className="size-full object-cover" />
                ) : (
                  <Film className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={media.name}>
                  {media.name}
                </div>
                <div className="truncate font-mono text-2xs text-muted-foreground tabular-nums">
                  {mediaInfo?.width
                    ? `${mediaInfo.width}×${mediaInfo.height}`
                    : media.kind}
                  {" · "}
                  {formatBytes(mediaInfo?.size ?? 0)}
                </div>
              </div>
              <Tooltip content="Remove media">
                <Button
                  variant="muted"
                  size="icon-xs"
                  aria-label="Remove media"
                  onClick={actions.clearMedia}
                  className="opacity-0 group-hover/source:opacity-100 focus-visible:opacity-100"
                >
                  <X />
                </Button>
              </Tooltip>
            </div>
          ) : (
            <button
              type="button"
              onClick={actions.openFilePicker}
              className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-border px-2.5 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground"
            >
              No media loaded
            </button>
          )}
        </SidebarGroup>

        <section className="flex w-full min-w-0 flex-col p-2">
          <Segmented
            aria-label="Sidebar view"
            value={tab}
            onValueChange={setTab}
            className="mb-2 w-full"
            options={[
              { value: "effects", label: "Effects" },
              {
                value: "presets",
                label: (
                  <>
                    Presets
                    <span className="text-muted-foreground tabular-nums">
                      {builtInPresets.length + customPresets.length}
                    </span>
                  </>
                ),
              },
            ]}
          />
          {tab === "effects" ? (
            <div className="flex flex-col gap-0.5">
              {filterDefinitions.map((definition) => {
                const supported = supportedFilters.includes(definition.type)
                const disabled = !media || !supported
                const count = countsByType.get(definition.type) ?? 0
                const Icon = definition.icon

                return (
                  <button
                    key={definition.type}
                    type="button"
                    disabled={disabled}
                    onClick={() => actions.addLayer(definition.type)}
                    title={
                      !media
                        ? "Open media to add effects"
                        : !supported
                          ? `${getMediaBadge(definition)} only`
                          : definition.description
                    }
                    className={cn(
                      "group/item flex h-8 w-full items-center gap-2.5 overflow-hidden rounded-(--control-radius) px-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      "text-sidebar-muted-foreground/80 hover:bg-sidebar-row-hover hover:text-sidebar-foreground active:bg-sidebar-row-active",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{definition.label}</span>
                    {media && !supported ? (
                      <Badge variant="secondary">{getMediaBadge(definition)}</Badge>
                    ) : count > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums group-hover/item:hidden">
                        {count}
                      </span>
                    ) : null}
                    {supported && media && (
                      <Plus className="hidden size-3.5 text-muted-foreground group-hover/item:block" />
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <PresetsPanel
              editor={editor}
              customPresets={customPresets}
              onSavePreset={onSavePreset}
            />
          )}
        </section>
      </div>

      <footer className="flex flex-col gap-0.5 border-t p-2">
        <SidebarFooterButton onClick={onOpenCommandMenu}>
          <Command className="size-4" />
          <span className="flex-1">Command menu</span>
          <Shortcut keys="mod+k" />
        </SidebarFooterButton>
        <SidebarFooterButton onClick={onToggleTheme}>
          {theme === "dark" ? (
            <SunMedium className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          <span className="flex-1">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </SidebarFooterButton>
      </footer>
    </aside>
  )
}

function SidebarGroup({
  label,
  trailing,
  children,
}: {
  label: string
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex w-full min-w-0 flex-col p-2">
      <div className="flex h-7 items-center justify-between px-2.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {trailing}
      </div>
      {children}
    </section>
  )
}

function SidebarFooterButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2.5 rounded-(--control-radius) px-2.5 text-left text-sm font-medium text-sidebar-muted-foreground/80 outline-none transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}
