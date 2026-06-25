# Visual Lab

Visual Lab is a browser-based media effects workspace built with Next.js. It lets you upload an image or video, preview it on a canvas, and build visual treatments with adjustable filter layers.

<img width="1702" height="1189" alt="image" src="https://github.com/user-attachments/assets/80e0c3aa-e6c5-4cdc-a63f-c787854edaa5" />


## Features

- Upload images or videos from the local filesystem.
- Preview media in a centered canvas workspace.
- Add, reorder, hide, show, tune, and delete supported filter layers.
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
- Tailwind CSS
- Canvas 2D for image rendering
- WebGL infrastructure for video rendering
