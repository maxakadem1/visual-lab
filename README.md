# Visual Lab

Visual Lab is a browser-based media effects workspace built with Next.js. It lets you upload an image or video, preview it on a canvas, and build visual treatments with adjustable filter layers.

<img width="1702" height="1189" alt="image" src="https://github.com/user-attachments/assets/80e0c3aa-e6c5-4cdc-a63f-c787854edaa5" />


## Features

- Open images or videos from disk, drag and drop them onto the stage, or paste them from the clipboard.
- Stack effect layers: add, drag to reorder, hide, duplicate, reset and delete them.
- Undo and redo every layer change. A slider drag counts as a single step.
- One-click presets (Game Boy, CRT, Newsprint, Terminal, Pixel art, Glitch, Dreamy, 1-bit, Vaporwave), each previewed on your own image.
- Save your current stack as a custom preset. Custom presets are stored in this browser.
- Pick from a palette library (Game Boy, PICO-8, CGA, 1-bit, phosphor, sepia and more), sample colors from the source, or randomize.
- Share a look as a link: the URL carries the layer stack, not the image.
- Autosave: the current media and stack come back after a refresh. Media is stored in IndexedDB, up to 80 MB.
- Hold to compare the processed image with the original.
- Fit and 1:1 zoom.
- Video: play, pause and scrub, with a WebGL preview.
- Export the processed image as a full-resolution PNG, or copy it to the clipboard.
- Export the processed video with its original audio, at full resolution. It records in real time as MP4 where the browser supports it (Chrome, Edge, Safari) and as WebM otherwise. A progress bar shows on the Export button, which you can click to cancel. Recording pauses while the tab is in the background.
- Command menu, dark and light themes, collapsible panels, and mobile drawers.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ K` | Command menu (add effects, run actions) |
| `Ctrl/⌘ O` | Open media |
| `Ctrl/⌘ E` | Export PNG or video (press again to cancel a video export) |
| `Ctrl/⌘ B` / `Ctrl/⌘ I` | Toggle sidebar / inspector |
| `Ctrl/⌘ Z` / `Ctrl/⌘ Shift Z` | Undo / redo |
| `Ctrl/⌘ C` / `Ctrl/⌘ V` | Copy result / paste media |
| `Ctrl/⌘ S` | Save current look as preset |
| `Ctrl/⌘ D` | Duplicate selected layer |
| `Delete` | Delete selected layer |
| `H` | Hide/show selected layer |
| `Alt ↑/↓` | Move selected layer (layer list focused) |
| `Space` | Play/pause video |
| Hold `\` | Compare with original |

## Supported Filters

### Images

Image filters are supported as stackable layers. Layers render from the bottom of the layer list upward.

| Filter | Controls |
| --- | --- |
| Pixelation | Block size |
| Noise | Strength |
| Bloom | Strength, threshold, radius |
| Colors | Palette colors, smart coloring |
| Dither | Pattern, scale, strength, palette colors, smart coloring |
| Fisheye | Strength, radius |
| Scan lines | Spacing, thickness, opacity |
| Modulation | Direction, lines, amplitude, thickness |

### Video

Video filters are supported through the WebGL preview path. Dither and Fisheye are currently image-only.

| Filter | Controls |
| --- | --- |
| Pixelation | Block size |
| Noise | Strength |
| Bloom | Strength, threshold, radius |
| Colors | Palette colors, smart coloring |
| Scan lines | Spacing, thickness, opacity |
| Modulation | Direction, lines, amplitude, thickness |

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4 (design tokens in `app/globals.css`, visual language modeled on T3 Code)
- Canvas 2D for image rendering
- WebGL infrastructure for video rendering
