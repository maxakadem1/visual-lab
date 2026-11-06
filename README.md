# Visual Lab

Visual Lab is a browser-based media effects workspace built with Next.js. It lets you upload an image or video, preview it on a canvas, and build visual treatments with adjustable filter layers.

<img width="1702" height="1189" alt="image" src="https://github.com/user-attachments/assets/80e0c3aa-e6c5-4cdc-a63f-c787854edaa5" />


## Features

- Open images or videos from disk or drag and drop them anywhere on the stage.
- Stack effect layers: add, drag to reorder, hide, duplicate, reset and delete them.
- Tune each layer in the inspector with sliders, segmented toggles, switches and palette swatches.
- Sample a working palette from the source, or randomize it.
- Hold to compare the processed image with the original.
- Switch between Fit and 1:1 zoom.
- Play, pause and scrub video. Video preview renders through WebGL.
- Export the processed image as a full-resolution PNG.
- Command menu, dark and light themes, collapsible panels, and mobile drawers.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ K` | Command menu (add effects, run actions) |
| `Ctrl/⌘ O` | Open media |
| `Ctrl/⌘ E` | Export PNG |
| `Ctrl/⌘ B` / `Ctrl/⌘ I` | Toggle sidebar / inspector |
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
