# Visual Lab

Visual Lab is a browser-based media effects workspace built with Next.js. It lets you upload an image or video, preview it on a canvas, and build visual treatments with adjustable filter layers.

## Features

- Upload images or videos from the local filesystem.
- Preview media in a centered canvas workspace.
- Add, reorder, hide, show, tune, and delete image filter layers.
- Extract a small working palette from uploaded media for color-based effects.
- Play, pause, and scrub uploaded videos.

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

Video upload, preview, playback, pause, and timeline scrubbing are supported.

Video filter layers are not currently exposed in the UI, so the supported video filter list is:

| Filter | Status |
| --- | --- |
| None | Video effects are not currently user-selectable |

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
- Tailwind CSS
- Canvas 2D for image rendering
- WebGL infrastructure for video rendering
