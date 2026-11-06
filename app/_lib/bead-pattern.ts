import type { RgbColor } from "../_types/editor"
import { hexToRgb, rgbToHex } from "./color"

/**
 * Turns the processed frame into a craft pattern: a grid of cells, each one
 * a bead, stitch or brick from a limited color set, plus a shopping list.
 */

export type PatternKind = "beads" | "stitch" | "bricks"
export type PatternPaletteSource = "craft" | "look" | "image"

export type PatternColor = { name: string; hex: string; rgb: RgbColor; symbol: string; count: number }

export type Pattern = {
  columns: number
  rows: number
  /** Index into `colors` for every cell, row by row. */
  cells: Uint16Array
  colors: PatternColor[]
}

/** Generic craft colors. Real brands differ a little; match by eye. */
export const craftColors: { name: string; hex: string }[] = [
  { name: "Black", hex: "#1b1b1d" },
  { name: "Charcoal", hex: "#45474b" },
  { name: "Dark gray", hex: "#6c6e72" },
  { name: "Gray", hex: "#9a9ca0" },
  { name: "Light gray", hex: "#c8c9cb" },
  { name: "White", hex: "#f4f4f2" },
  { name: "Cream", hex: "#efe3c2" },
  { name: "Tan", hex: "#cfa977" },
  { name: "Light brown", hex: "#a2683c" },
  { name: "Brown", hex: "#6e3f22" },
  { name: "Dark brown", hex: "#3f2417" },
  { name: "Peach", hex: "#f5b99a" },
  { name: "Skin", hex: "#e0a07c" },
  { name: "Pastel pink", hex: "#f6b6c8" },
  { name: "Pink", hex: "#ee6a9a" },
  { name: "Magenta", hex: "#c3277a" },
  { name: "Red", hex: "#c8242f" },
  { name: "Dark red", hex: "#7d1a22" },
  { name: "Orange", hex: "#ee7a26" },
  { name: "Light orange", hex: "#f6a948" },
  { name: "Yellow", hex: "#f7d43a" },
  { name: "Pale yellow", hex: "#f7ec98" },
  { name: "Lime", hex: "#a7d03d" },
  { name: "Light green", hex: "#6fc06a" },
  { name: "Green", hex: "#2f9a48" },
  { name: "Dark green", hex: "#1e5a33" },
  { name: "Olive", hex: "#7c7a35" },
  { name: "Mint", hex: "#9fdcc0" },
  { name: "Teal", hex: "#1f8f8f" },
  { name: "Turquoise", hex: "#3fc1c9" },
  { name: "Sky blue", hex: "#8dc8ef" },
  { name: "Light blue", hex: "#5a9fdc" },
  { name: "Blue", hex: "#2b5cb8" },
  { name: "Dark blue", hex: "#1d2f6b" },
  { name: "Lavender", hex: "#b9a3dd" },
  { name: "Purple", hex: "#7542a6" },
  { name: "Plum", hex: "#4d2558" },
]

const symbols = [
  ..."ABCDEFGHJKLMNPQRSTUVWXYZ",
  ..."23456789",
  ..."+#%&@=?*<>",
  ..."abdefghkmnqrt",
]

/** "Redmean" distance: cheap and closer to how eyes compare colors than plain RGB. */
const colorDistance = (left: RgbColor, right: RgbColor) => {
  const redMean = (left[0] + right[0]) / 2
  const red = left[0] - right[0]
  const green = left[1] - right[1]
  const blue = left[2] - right[2]
  return (2 + redMean / 256) * red * red + 4 * green * green + (2 + (255 - redMean) / 256) * blue * blue
}

const nearest = (color: RgbColor, palette: RgbColor[]) => {
  let best = 0
  let bestDistance = Infinity
  for (let index = 0; index < palette.length; index += 1) {
    const distance = colorDistance(color, palette[index])
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/** Box-average the source into one color per cell. */
const sampleCells = (source: HTMLCanvasElement, columns: number, rows: number) => {
  const context = source.getContext("2d", { willReadFrequently: true })!
  const pixels = context.getImageData(0, 0, source.width, source.height).data
  const cells = new Float32Array(columns * rows * 3)

  for (let row = 0; row < rows; row += 1) {
    const top = Math.floor((row / rows) * source.height)
    const bottom = Math.max(top + 1, Math.floor(((row + 1) / rows) * source.height))
    for (let column = 0; column < columns; column += 1) {
      const left = Math.floor((column / columns) * source.width)
      const right = Math.max(left + 1, Math.floor(((column + 1) / columns) * source.width))
      let red = 0
      let green = 0
      let blue = 0
      let count = 0
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const index = (y * source.width + x) * 4
          red += pixels[index]
          green += pixels[index + 1]
          blue += pixels[index + 2]
          count += 1
        }
      }
      const cell = (row * columns + column) * 3
      cells[cell] = red / count
      cells[cell + 1] = green / count
      cells[cell + 2] = blue / count
    }
  }

  return cells
}

/** k-means on the cells, seeded with k-means++ so the result is stable-ish. */
const clusterColors = (cells: Float32Array, count: number): RgbColor[] => {
  const total = cells.length / 3
  const at = (index: number): RgbColor => [cells[index * 3], cells[index * 3 + 1], cells[index * 3 + 2]]
  const centers: RgbColor[] = [at(Math.floor(total / 2))]

  while (centers.length < Math.min(count, total)) {
    let farthest = 0
    let farthestDistance = -1
    for (let index = 0; index < total; index += 7) {
      const color = at(index)
      const distance = colorDistance(color, centers[nearest(color, centers)])
      if (distance > farthestDistance) {
        farthestDistance = distance
        farthest = index
      }
    }
    if (farthestDistance <= 0) break
    centers.push(at(farthest))
  }

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = centers.map(() => [0, 0, 0, 0])
    for (let index = 0; index < total; index += 1) {
      const color = at(index)
      const sum = sums[nearest(color, centers)]
      sum[0] += color[0]
      sum[1] += color[1]
      sum[2] += color[2]
      sum[3] += 1
    }
    sums.forEach((sum, index) => {
      if (sum[3]) centers[index] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]]
    })
  }

  return centers.map((color) => color.map(Math.round) as RgbColor)
}

export const buildPattern = (
  source: HTMLCanvasElement,
  options: {
    columns: number
    paletteSource: PatternPaletteSource
    lookColors: string[]
    maxColors: number
    dither: boolean
  },
): Pattern => {
  const columns = Math.max(4, Math.round(options.columns))
  const rows = Math.max(4, Math.round((columns * source.height) / source.width))
  const cells = sampleCells(source, columns, rows)
  const total = columns * rows

  let candidates: { name: string; hex: string }[]
  if (options.paletteSource === "image") {
    candidates = clusterColors(cells, options.maxColors).map((rgb, index) => ({
      name: `Color ${index + 1}`,
      hex: rgbToHex(rgb),
    }))
  } else if (options.paletteSource === "look" && options.lookColors.length) {
    candidates = [...new Set(options.lookColors.map((hex) => hex.toLowerCase()))].map((hex, index) => ({
      name: `Look ${index + 1}`,
      hex,
    }))
  } else {
    candidates = craftColors
  }

  let palette = candidates.map((color) => hexToRgb(color.hex))
  let assignment = new Uint16Array(total)
  const assign = () => {
    for (let index = 0; index < total; index += 1) {
      assignment[index] = nearest([cells[index * 3], cells[index * 3 + 1], cells[index * 3 + 2]], palette)
    }
  }
  assign()

  // Drop the least used colors until the pattern fits the color budget.
  while (palette.length > Math.max(2, options.maxColors)) {
    const usage = new Uint32Array(palette.length)
    assignment.forEach((value) => (usage[value] += 1))
    let rarest = 0
    for (let index = 1; index < palette.length; index += 1) {
      if (usage[index] < usage[rarest]) rarest = index
    }
    palette = palette.filter((_, index) => index !== rarest)
    candidates = candidates.filter((_, index) => index !== rarest)
    assign()
  }

  if (options.dither) {
    // Floyd–Steinberg across the cell grid for smoother gradients.
    const work = Float32Array.from(cells)
    assignment = new Uint16Array(total)
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column
        const color: RgbColor = [work[index * 3], work[index * 3 + 1], work[index * 3 + 2]]
        const choice = nearest(color, palette)
        assignment[index] = choice
        const target = palette[choice]
        const spread = (offset: number, weight: number, valid: boolean) => {
          if (!valid) return
          for (let channel = 0; channel < 3; channel += 1) {
            work[(index + offset) * 3 + channel] += (color[channel] - target[channel]) * weight
          }
        }
        spread(1, 7 / 16, column + 1 < columns)
        spread(columns - 1, 3 / 16, row + 1 < rows && column > 0)
        spread(columns, 5 / 16, row + 1 < rows)
        spread(columns + 1, 1 / 16, row + 1 < rows && column + 1 < columns)
      }
    }
  }

  // Keep only colors that ended up used, most used first.
  const usage = new Uint32Array(palette.length)
  assignment.forEach((value) => (usage[value] += 1))
  const order = palette
    .map((_, index) => index)
    .filter((index) => usage[index] > 0)
    .sort((left, right) => usage[right] - usage[left])
  const remap = new Uint16Array(palette.length)
  order.forEach((paletteIndex, position) => (remap[paletteIndex] = position))
  const finalCells = assignment.map((value) => remap[value])

  return {
    columns,
    rows,
    cells: finalCells,
    colors: order.map((paletteIndex, position) => ({
      name: candidates[paletteIndex].name,
      hex: candidates[paletteIndex].hex,
      rgb: palette[paletteIndex],
      symbol: symbols[position % symbols.length],
      count: usage[paletteIndex],
    })),
  }
}

/* -------------------------------- Drawing -------------------------------- */

const ink = (rgb: RgbColor) =>
  rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150 ? "#111111" : "#ffffff"

const shade = (rgb: RgbColor, amount: number) =>
  `rgb(${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value + amount)))).join(",")})`

/** Draws only the cells, for the live preview. */
export const drawPatternCells = (
  canvas: HTMLCanvasElement,
  pattern: Pattern,
  kind: PatternKind,
  cellSize: number,
  options: { symbols?: boolean; originX?: number; originY?: number } = {},
) => {
  const context = canvas.getContext("2d")!
  const originX = options.originX ?? 0
  const originY = options.originY ?? 0
  const size = cellSize

  for (let row = 0; row < pattern.rows; row += 1) {
    for (let column = 0; column < pattern.columns; column += 1) {
      const color = pattern.colors[pattern.cells[row * pattern.columns + column]]
      const x = originX + column * size
      const y = originY + row * size

      if (kind === "beads") {
        context.fillStyle = "#f3f1ec"
        context.fillRect(x, y, size, size)
        context.fillStyle = color.hex
        context.beginPath()
        context.arc(x + size / 2, y + size / 2, size * 0.46, 0, Math.PI * 2)
        context.fill()
        // The hole in the middle of a fuse bead.
        context.fillStyle = shade(color.rgb, -55)
        context.beginPath()
        context.arc(x + size / 2, y + size / 2, size * 0.16, 0, Math.PI * 2)
        context.fill()
      } else if (kind === "bricks") {
        context.fillStyle = color.hex
        context.fillRect(x, y, size, size)
        context.fillStyle = shade(color.rgb, -30)
        context.fillRect(x, y + size - Math.max(1, size * 0.08), size, Math.max(1, size * 0.08))
        // The stud on top of a 1×1 brick.
        context.fillStyle = shade(color.rgb, 22)
        context.beginPath()
        context.arc(x + size / 2, y + size / 2, size * 0.3, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = shade(color.rgb, -40)
        context.lineWidth = Math.max(1, size * 0.05)
        context.stroke()
      } else {
        context.fillStyle = color.hex
        context.fillRect(x, y, size, size)
      }

      if (options.symbols && size >= 9) {
        context.fillStyle = ink(color.rgb)
        context.font = `600 ${Math.round(size * 0.58)}px ui-sans-serif, system-ui, sans-serif`
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.fillText(color.symbol, x + size / 2, y + size / 2 + size * 0.03)
      }
    }
  }
}

/** Beads come on square pegboards; this is the common large size. */
export const pegboardSize = 29

/** Full printable chart: numbered grid, board outlines and a color legend. */
export const renderPatternSheet = (
  pattern: Pattern,
  options: { kind: PatternKind; symbols: boolean; title: string },
) => {
  const cell = Math.max(14, Math.min(30, Math.floor(3600 / Math.max(pattern.columns, pattern.rows))))
  const margin = 48
  const gridLeft = margin + 28
  const gridTop = margin + 70
  const gridWidth = pattern.columns * cell
  const gridHeight = pattern.rows * cell
  const legendColumns = Math.max(1, Math.min(3, Math.floor((gridWidth + 28) / 300)))
  const legendRows = Math.ceil(pattern.colors.length / legendColumns)
  const legendTop = gridTop + gridHeight + 56
  const width = Math.max(gridLeft + gridWidth + margin, 720)
  const height = legendTop + 40 + legendRows * 30 + margin

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")!

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)

  // Title block.
  const unit = options.kind === "beads" ? "beads" : options.kind === "bricks" ? "bricks" : "stitches"
  const total = pattern.columns * pattern.rows
  context.fillStyle = "#111111"
  context.textAlign = "left"
  context.textBaseline = "alphabetic"
  context.font = "600 22px ui-sans-serif, system-ui, sans-serif"
  context.fillText(options.title, margin, margin + 6)
  context.font = "14px ui-sans-serif, system-ui, sans-serif"
  context.fillStyle = "#555555"
  const boards =
    options.kind === "beads"
      ? ` · ${Math.ceil(pattern.columns / pegboardSize)}×${Math.ceil(pattern.rows / pegboardSize)} pegboards of ${pegboardSize}`
      : ""
  context.fillText(
    `${pattern.columns} × ${pattern.rows} · ${total.toLocaleString()} ${unit} · ${pattern.colors.length} colors${boards} · made with Visual Lab`,
    margin,
    margin + 30,
  )

  drawPatternCells(canvas, pattern, options.kind, cell, {
    symbols: options.symbols,
    originX: gridLeft,
    originY: gridTop,
  })

  // Grid lines, heavier every 10 cells so counting is easy.
  for (let column = 0; column <= pattern.columns; column += 1) {
    const x = gridLeft + column * cell + 0.5
    context.strokeStyle = column % 10 === 0 ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.14)"
    context.lineWidth = column % 10 === 0 ? 1.5 : 1
    context.beginPath()
    context.moveTo(x, gridTop)
    context.lineTo(x, gridTop + gridHeight)
    context.stroke()
  }
  for (let row = 0; row <= pattern.rows; row += 1) {
    const y = gridTop + row * cell + 0.5
    context.strokeStyle = row % 10 === 0 ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.14)"
    context.lineWidth = row % 10 === 0 ? 1.5 : 1
    context.beginPath()
    context.moveTo(gridLeft, y)
    context.lineTo(gridLeft + gridWidth, y)
    context.stroke()
  }

  if (options.kind === "beads") {
    context.strokeStyle = "#e5484d"
    context.lineWidth = 2.5
    context.setLineDash([8, 5])
    for (let x = pegboardSize; x < pattern.columns; x += pegboardSize) {
      context.beginPath()
      context.moveTo(gridLeft + x * cell, gridTop - 6)
      context.lineTo(gridLeft + x * cell, gridTop + gridHeight + 6)
      context.stroke()
    }
    for (let y = pegboardSize; y < pattern.rows; y += pegboardSize) {
      context.beginPath()
      context.moveTo(gridLeft - 6, gridTop + y * cell)
      context.lineTo(gridLeft + gridWidth + 6, gridTop + y * cell)
      context.stroke()
    }
    context.setLineDash([])
  }

  // Coordinates every 5 cells.
  context.fillStyle = "#666666"
  context.font = "11px ui-monospace, monospace"
  context.textAlign = "center"
  context.textBaseline = "bottom"
  for (let column = 5; column <= pattern.columns; column += 5) {
    context.fillText(String(column), gridLeft + (column - 0.5) * cell, gridTop - 4)
  }
  context.textAlign = "right"
  context.textBaseline = "middle"
  for (let row = 5; row <= pattern.rows; row += 5) {
    context.fillText(String(row), gridLeft - 6, gridTop + (row - 0.5) * cell)
  }

  // Legend: what to buy.
  context.textAlign = "left"
  context.textBaseline = "alphabetic"
  context.fillStyle = "#111111"
  context.font = "600 16px ui-sans-serif, system-ui, sans-serif"
  context.fillText("Colors", margin, legendTop)
  const columnWidth = Math.max(280, Math.floor((width - margin * 2) / legendColumns))

  pattern.colors.forEach((color, index) => {
    const x = margin + Math.floor(index / legendRows) * columnWidth
    const y = legendTop + 18 + (index % legendRows) * 30
    context.fillStyle = color.hex
    context.fillRect(x, y, 22, 22)
    context.strokeStyle = "rgba(0,0,0,0.25)"
    context.lineWidth = 1
    context.strokeRect(x + 0.5, y + 0.5, 21, 21)
    context.fillStyle = ink(color.rgb)
    context.font = "600 13px ui-sans-serif, system-ui, sans-serif"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(color.symbol, x + 11, y + 12)
    context.textAlign = "left"
    context.fillStyle = "#111111"
    context.font = "13px ui-sans-serif, system-ui, sans-serif"
    context.fillText(color.name, x + 32, y + 12)
    context.fillStyle = "#777777"
    context.font = "12px ui-monospace, monospace"
    context.fillText(`${color.hex}  ×${color.count.toLocaleString()}`, x + 32 + 110, y + 12)
  })

  return canvas
}

/** A shopping list for spreadsheets. */
export const patternToCsv = (pattern: Pattern) =>
  ["symbol,name,hex,count", ...pattern.colors.map((color) => `${color.symbol},${color.name},${color.hex},${color.count}`)].join("\n")
