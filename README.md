# Visual Lab

Visual Lab is a browser-based media effects workspace built with Next.js. It lets you upload an image or video, preview it on a canvas, and build visual treatments with adjustable filter layers.

<img width="1702" height="1189" alt="image" src="https://github.com/user-attachments/assets/80e0c3aa-e6c5-4cdc-a63f-c787854edaa5" />


## Features

- Open images or videos from disk, drag and drop them onto the stage, or paste them from the clipboard.
- Stack effect layers: add, drag to reorder, hide, duplicate, reset and delete them.
- Undo and redo every layer change. A slider drag counts as a single step.
- One-click presets (Game Boy, CRT, Newsprint, Terminal, Pixel art, Glitch, Dreamy, 1-bit, Vaporwave, Corrupted, Meltdown, Tunnel, and the video-only Mosh pit and Time warp), each previewed on your own image.
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

### Playground

- **Audio reactive.** Effects pulse with sound from the video's soundtrack or your microphone. Each layer picks a band (low, mid, high or beat), the setting it drives and how hard. "Make every layer react" wires up the whole stack in one click. Video exports react to their own soundtrack.
- **Breed mode.** Shows eight mutations of the current look around it. Pick one and it becomes the parent of the next brood. Gentle or wild mutations, reroll, and step back through generations. Keys `1`–`9` pick, `R` rerolls.
- **Patterns.** Turns the current look into a printable fuse-bead, cross-stitch or brick chart: numbered grid, pegboard outlines, symbols, and a color legend with counts. Colors come from a generic craft set, your look's palette, or the best colors for the picture. Download the chart as PNG and the shopping list as CSV.

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
| Pixel sort | Direction, threshold |
| ASCII | Cell size, contrast, invert, custom characters |
| Databend | Damage (scramble, shift, tables), amount, JPEG quality, seed, re-corrupt constantly |
| Pixel gravity | Loose pixels (bright or dark), direction, threshold, fall, scatter, loop |
| Feedback | Blend, zoom, rotate, persistence, hue drift |

Databend encodes the frame as a real JPEG, damages the bytes, and decodes the result with a forgiving built-in decoder that keeps going where a browser would give up.

### Video

Most filters run in a single WebGL pass. Stacks that include Databend, Pixel gravity, Feedback, Slit-scan or Datamosh switch to the Canvas 2D path, which caps its working size at 960 px in the preview and 1920 px in exports. Dither, Fisheye, Pixel sort and ASCII are image-only.

| Filter | Controls |
| --- | --- |
| Pixelation | Block size |
| Noise | Strength |
| Bloom | Strength, threshold, radius |
| Colors | Palette colors, smart coloring |
| Scan lines | Spacing, thickness, opacity |
| Modulation | Direction, lines, amplitude, thickness |
| Databend | As for images |
| Pixel gravity | As for images |
| Feedback | As for images; on video it trails across frames |
| Slit-scan | Direction time flows, time span. Every row (or column) comes from a different moment |
| Datamosh | Block size, motion boost, bleed, clean frame interval. Old pixels ride the new motion |

Slit-scan and Datamosh feed on earlier frames, so they only do something while the video plays.

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
