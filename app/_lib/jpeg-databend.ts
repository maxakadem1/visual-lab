/**
 * Real databending: the browser encodes the frame as a JPEG, we damage the
 * actual bytes, then decode the broken file with a forgiving baseline decoder
 * that keeps going where a browser would give up and paint the rest gray.
 */

export type DatabendMode = "scramble" | "shift" | "tables"

/* --------------------------------- Random -------------------------------- */

/** Small seeded PRNG so a seed always produces the same wreck. */
export const createRandom = (seed: number) => {
  let state = (Math.floor(seed) ^ 0x9e3779b9) >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------- Corruption ------------------------------ */

const findMarker = (bytes: Uint8Array, marker: number, from = 2) => {
  for (let index = from; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === marker) return index
  }
  return -1
}

/** Where entropy-coded image data starts and ends. */
const findScanRange = (bytes: Uint8Array) => {
  const sos = findMarker(bytes, 0xda)
  if (sos < 0) return null
  const length = (bytes[sos + 2] << 8) | bytes[sos + 3]
  const start = sos + 2 + length
  let end = bytes.length

  for (let index = bytes.length - 2; index > start; index -= 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) {
      end = index
      break
    }
  }

  return end - start > 8 ? { start, end } : null
}

/** A random byte that can't be read as the start of a marker. */
const safeByte = (random: () => number) => {
  const value = Math.floor(random() * 256)
  return value === 0xff ? 0xfe : value
}

/** Avoid splitting an 0xFF 0x00 stuffing pair, which would create a fake marker. */
const isStuffed = (bytes: Uint8Array, index: number) =>
  bytes[index] === 0xff || bytes[index - 1] === 0xff

export const corruptJpeg = (
  source: Uint8Array,
  mode: DatabendMode,
  amount: number,
  random: () => number,
) => {
  if (amount <= 0) return source

  if (mode === "tables") {
    const bytes = source.slice()
    let index = 2

    // Walk header segments and rewrite quantization table entries.
    while (index < bytes.length - 4 && bytes[index] === 0xff) {
      const marker = bytes[index + 1]
      const length = (bytes[index + 2] << 8) | bytes[index + 3]
      if (marker === 0xda) break

      if (marker === 0xdb) {
        let cursor = index + 4
        const end = index + 2 + length

        while (cursor < end) {
          const precision = bytes[cursor] >> 4
          const tableStart = cursor + 1
          const entrySize = precision ? 2 : 1

          if (!precision) {
            const hits = Math.max(1, Math.round((amount / 100) * 20))
            for (let hit = 0; hit < hits; hit += 1) {
              // Low frequencies change the picture most, so favor them.
              const entry = Math.floor(random() ** 2 * 64)
              bytes[tableStart + entry] = 1 + Math.floor(random() * 254)
            }
          }

          cursor = tableStart + 64 * entrySize
        }
      }

      index += 2 + length
    }

    return bytes
  }

  const range = findScanRange(source)
  if (!range) return source
  const hits = Math.max(1, Math.round((amount / 100) ** 2 * 140))

  if (mode === "scramble") {
    const bytes = source.slice()

    for (let hit = 0; hit < hits; hit += 1) {
      const index = range.start + Math.floor(random() * (range.end - range.start))
      if (isStuffed(bytes, index)) continue
      bytes[index] = safeByte(random)
    }

    return bytes
  }

  // Shift: insert and delete short byte runs so everything after slips out of step.
  const edits = Array.from({ length: Math.max(1, Math.round(hits / 5)) }, () =>
    range.start + Math.floor(random() * (range.end - range.start)),
  ).sort((left, right) => left - right)
  const output: number[] = []
  let cursor = 0

  for (const position of edits) {
    let at = Math.max(cursor, position)
    if (isStuffed(source, at)) at += 1
    if (at >= range.end) break

    for (; cursor < at; cursor += 1) output.push(source[cursor])

    const run = 1 + Math.floor(random() * 4)
    if (random() < 0.5) {
      for (let count = 0; count < run; count += 1) output.push(safeByte(random))
    } else {
      cursor = Math.min(range.end, cursor + run)
      // Never leave a dangling 0xFF at the cut.
      if (output[output.length - 1] === 0xff) output.push(0x00)
    }
  }

  for (; cursor < source.length; cursor += 1) output.push(source[cursor])
  return Uint8Array.from(output)
}

/* -------------------------------- Decoder -------------------------------- */

const zigzag = new Int32Array([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27,
  20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58,
  59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
])

// idctTable[x * 8 + u] = C(u) / 2 * cos((2x + 1) u π / 16)
const idctTable = (() => {
  const table = new Float32Array(64)
  for (let x = 0; x < 8; x += 1) {
    for (let u = 0; u < 8; u += 1) {
      const scale = u === 0 ? Math.SQRT1_2 : 1
      table[x * 8 + u] = (scale / 2) * Math.cos(((2 * x + 1) * u * Math.PI) / 16)
    }
  }
  return table
})()

type HuffmanTable = {
  maxCode: Int32Array
  valPtr: Int32Array
  minCode: Int32Array
  values: Uint8Array
}

type Component = {
  id: number
  h: number
  v: number
  quantId: number
  dcTable: number
  acTable: number
  blocksPerLine: number
  blocksPerColumn: number
  plane: Uint8ClampedArray
  pred: number
}

const buildHuffman = (counts: Uint8Array, values: Uint8Array): HuffmanTable => {
  const maxCode = new Int32Array(18).fill(-1)
  const valPtr = new Int32Array(17)
  const minCode = new Int32Array(17)
  let code = 0
  let index = 0

  for (let length = 1; length <= 16; length += 1) {
    valPtr[length] = index
    minCode[length] = code
    code += counts[length - 1]
    index += counts[length - 1]
    maxCode[length] = counts[length - 1] ? code - 1 : -1
    code <<= 1
  }
  maxCode[17] = 0x7fffffff

  return { maxCode, valPtr, minCode, values }
}

export type DecodedImage = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> }

export const decodeJpeg = (bytes: Uint8Array): DecodedImage | null => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  const quantTables: Int32Array[] = []
  const dcTables: HuffmanTable[] = []
  const acTables: HuffmanTable[] = []
  let components: Component[] = []
  let width = 0
  let height = 0
  let maxH = 1
  let maxV = 1
  let mcusPerLine = 0
  let mcusPerColumn = 0
  let restartInterval = 0
  let index = 2
  let decodedAnyScan = false

  while (index < bytes.length - 3) {
    if (bytes[index] !== 0xff) {
      index += 1
      continue
    }

    const marker = bytes[index + 1]
    if (marker === 0xd9) break
    if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      index += 1
      continue
    }

    const length = (bytes[index + 2] << 8) | bytes[index + 3]
    const segmentStart = index + 4
    const segmentEnd = index + 2 + length

    switch (marker) {
      case 0xdb: {
        let cursor = segmentStart
        while (cursor < segmentEnd) {
          const precision = bytes[cursor] >> 4
          const id = bytes[cursor] & 15
          const table = new Int32Array(64)
          cursor += 1
          for (let k = 0; k < 64; k += 1) {
            table[k] = precision ? (bytes[cursor] << 8) | bytes[cursor + 1] : bytes[cursor]
            cursor += precision ? 2 : 1
          }
          quantTables[id] = table
        }
        break
      }

      case 0xc4: {
        let cursor = segmentStart
        while (cursor < segmentEnd) {
          const tableClass = bytes[cursor] >> 4
          const id = bytes[cursor] & 15
          const counts = bytes.subarray(cursor + 1, cursor + 17)
          let total = 0
          for (let k = 0; k < 16; k += 1) total += counts[k]
          const values = bytes.slice(cursor + 17, cursor + 17 + total)
          const table = buildHuffman(counts, values)
          if (tableClass === 0) dcTables[id] = table
          else acTables[id] = table
          cursor += 17 + total
        }
        break
      }

      case 0xc0:
      case 0xc1: {
        height = (bytes[segmentStart + 1] << 8) | bytes[segmentStart + 2]
        width = (bytes[segmentStart + 3] << 8) | bytes[segmentStart + 4]
        const count = bytes[segmentStart + 5]
        components = []

        for (let c = 0; c < count; c += 1) {
          const base = segmentStart + 6 + c * 3
          components.push({
            id: bytes[base],
            h: Math.max(1, bytes[base + 1] >> 4),
            v: Math.max(1, bytes[base + 1] & 15),
            quantId: bytes[base + 2],
            dcTable: 0,
            acTable: 0,
            blocksPerLine: 0,
            blocksPerColumn: 0,
            plane: new Uint8ClampedArray(0),
            pred: 0,
          })
        }

        if (!width || !height || !components.length) return null
        maxH = Math.max(...components.map((component) => component.h))
        maxV = Math.max(...components.map((component) => component.v))
        mcusPerLine = Math.ceil(width / (8 * maxH))
        mcusPerColumn = Math.ceil(height / (8 * maxV))

        for (const component of components) {
          component.blocksPerLine = mcusPerLine * component.h
          component.blocksPerColumn = mcusPerColumn * component.v
          component.plane = new Uint8ClampedArray(
            component.blocksPerLine * 8 * component.blocksPerColumn * 8,
          ).fill(128)
        }
        break
      }

      // Progressive and arithmetic JPEGs; canvas never writes these.
      case 0xc2:
      case 0xc3:
      case 0xc9:
      case 0xca:
        return null

      case 0xdd:
        restartInterval = (bytes[segmentStart] << 8) | bytes[segmentStart + 1]
        break

      case 0xda: {
        if (!components.length) return null
        const count = bytes[segmentStart]
        const scanComponents: Component[] = []

        for (let c = 0; c < count; c += 1) {
          const id = bytes[segmentStart + 1 + c * 2]
          const tables = bytes[segmentStart + 2 + c * 2]
          const component = components.find((item) => item.id === id)
          if (!component) continue
          component.dcTable = tables >> 4
          component.acTable = tables & 15
          scanComponents.push(component)
        }

        index = decodeScan(
          bytes,
          segmentEnd,
          scanComponents,
          components.length,
          { width, height, maxH, maxV, mcusPerLine, mcusPerColumn, restartInterval },
          { quantTables, dcTables, acTables },
        )
        decodedAnyScan = true
        continue
      }
    }

    index = segmentEnd
  }

  if (!decodedAnyScan || !width || !height) return null
  return { width, height, data: toRgba(components, width, height, maxH, maxV) }
}

type FrameInfo = {
  width: number
  height: number
  maxH: number
  maxV: number
  mcusPerLine: number
  mcusPerColumn: number
  restartInterval: number
}

type Tables = {
  quantTables: Int32Array[]
  dcTables: HuffmanTable[]
  acTables: HuffmanTable[]
}

/** Decodes entropy-coded data; corrupt input only ever produces wrong pixels. */
const decodeScan = (
  bytes: Uint8Array,
  start: number,
  scanComponents: Component[],
  totalComponents: number,
  frame: FrameInfo,
  tables: Tables,
) => {
  let position = start
  let bitBuffer = 0
  let bitCount = 0
  let markerHit = false

  const readBit = () => {
    if (bitCount === 0) {
      if (markerHit || position >= bytes.length) {
        bitBuffer = 0
      } else {
        const byte = bytes[position]
        if (byte === 0xff) {
          const next = bytes[position + 1]
          if (next === 0) {
            bitBuffer = 0xff
            position += 2
          } else {
            // A marker ends the data. Feed zeros from here on.
            markerHit = true
            bitBuffer = 0
          }
        } else {
          bitBuffer = byte
          position += 1
        }
      }
      bitCount = 8
    }
    bitCount -= 1
    return (bitBuffer >> bitCount) & 1
  }

  const receive = (length: number) => {
    let value = 0
    for (let bit = 0; bit < length; bit += 1) value = (value << 1) | readBit()
    return value
  }

  const extend = (value: number, length: number) =>
    length === 0 ? 0 : value < 1 << (length - 1) ? value - (1 << length) + 1 : value

  const decodeSymbol = (table: HuffmanTable | undefined) => {
    if (!table) return 0
    let code = readBit()
    let length = 1
    while (length <= 16 && code > table.maxCode[length]) {
      code = (code << 1) | readBit()
      length += 1
    }
    if (length > 16) return 0
    return table.values[table.valPtr[length] + code - table.minCode[length]] ?? 0
  }

  const coefficients = new Float32Array(64)
  const rows = new Float32Array(64)

  const decodeBlock = (component: Component, blockRow: number, blockColumn: number) => {
    const quant = tables.quantTables[component.quantId]
    coefficients.fill(0)

    const dcLength = decodeSymbol(tables.dcTables[component.dcTable])
    component.pred += extend(receive(dcLength), dcLength)
    coefficients[0] = component.pred * (quant?.[0] ?? 1)

    const acTable = tables.acTables[component.acTable]
    for (let k = 1; k < 64; ) {
      const symbol = decodeSymbol(acTable)
      const size = symbol & 15
      const run = symbol >> 4

      if (size === 0) {
        if (run === 15) {
          k += 16
          continue
        }
        break
      }

      k += run
      if (k > 63) break
      coefficients[zigzag[k]] = extend(receive(size), size) * (quant?.[k] ?? 1)
      k += 1
    }

    if (blockRow >= component.blocksPerColumn || blockColumn >= component.blocksPerLine) return
    writeIdct(component, blockRow, blockColumn, coefficients, rows)
  }

  const resetForRestart = () => {
    bitCount = 0
    markerHit = false
    // Skip to the next RSTn marker, wherever the damage left it.
    while (
      position < bytes.length - 1 &&
      !(bytes[position] === 0xff && bytes[position + 1] >= 0xd0 && bytes[position + 1] <= 0xd7)
    ) {
      position += 1
    }
    position += 2
    for (const component of scanComponents) component.pred = 0
  }

  for (const component of scanComponents) component.pred = 0

  if (scanComponents.length === 1 && totalComponents > 1) {
    // Non-interleaved scan: walk the component's own block grid.
    const component = scanComponents[0]
    const blocksWide = Math.ceil(Math.ceil((frame.width * component.h) / frame.maxH) / 8)
    const blocksHigh = Math.ceil(Math.ceil((frame.height * component.v) / frame.maxV) / 8)
    let count = 0

    for (let row = 0; row < blocksHigh; row += 1) {
      for (let column = 0; column < blocksWide; column += 1) {
        if (frame.restartInterval && count > 0 && count % frame.restartInterval === 0) {
          resetForRestart()
        }
        decodeBlock(component, row, column)
        count += 1
      }
    }
  } else {
    const totalMcus = frame.mcusPerLine * frame.mcusPerColumn

    for (let mcu = 0; mcu < totalMcus; mcu += 1) {
      if (frame.restartInterval && mcu > 0 && mcu % frame.restartInterval === 0) {
        resetForRestart()
      }

      const mcuRow = Math.floor(mcu / frame.mcusPerLine)
      const mcuColumn = mcu % frame.mcusPerLine

      for (const component of scanComponents) {
        for (let v = 0; v < component.v; v += 1) {
          for (let h = 0; h < component.h; h += 1) {
            decodeBlock(component, mcuRow * component.v + v, mcuColumn * component.h + h)
          }
        }
      }
    }
  }

  // Resume parsing at the next marker after the scan data.
  let next = position
  while (next < bytes.length - 1) {
    if (bytes[next] === 0xff && bytes[next + 1] !== 0 && !(bytes[next + 1] >= 0xd0 && bytes[next + 1] <= 0xd7)) {
      return next
    }
    next += 1
  }
  return bytes.length
}

const writeIdct = (
  component: Component,
  blockRow: number,
  blockColumn: number,
  coefficients: Float32Array,
  rows: Float32Array,
) => {
  // Rows: rows[v * 8 + x] = Σu T[x][u] F[v][u]
  for (let v = 0; v < 8; v += 1) {
    const base = v * 8
    for (let x = 0; x < 8; x += 1) {
      const tableBase = x * 8
      let sum = 0
      for (let u = 0; u < 8; u += 1) sum += idctTable[tableBase + u] * coefficients[base + u]
      rows[base + x] = sum
    }
  }

  const stride = component.blocksPerLine * 8
  const originX = blockColumn * 8
  const originY = blockRow * 8

  // Columns: out[y][x] = Σv T[y][v] rows[v][x]
  for (let y = 0; y < 8; y += 1) {
    const tableBase = y * 8
    const rowOffset = (originY + y) * stride + originX
    for (let x = 0; x < 8; x += 1) {
      let sum = 0
      for (let v = 0; v < 8; v += 1) sum += idctTable[tableBase + v] * rows[v * 8 + x]
      component.plane[rowOffset + x] = sum + 128
    }
  }
}

const toRgba = (
  components: Component[],
  width: number,
  height: number,
  maxH: number,
  maxV: number,
) => {
  const data = new Uint8ClampedArray(width * height * 4)
  const lookups = components.map((component) => {
    const xs = new Int32Array(width)
    for (let x = 0; x < width; x += 1) xs[x] = Math.floor((x * component.h) / maxH)
    return { component, xs, stride: component.blocksPerLine * 8 }
  })

  for (let y = 0; y < height; y += 1) {
    const rows = lookups.map(
      ({ component, stride }) => Math.floor((y * component.v) / maxV) * stride,
    )

    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4

      if (lookups.length >= 3) {
        const luma = lookups[0].component.plane[rows[0] + lookups[0].xs[x]]
        const cb = lookups[1].component.plane[rows[1] + lookups[1].xs[x]] - 128
        const cr = lookups[2].component.plane[rows[2] + lookups[2].xs[x]] - 128
        data[out] = luma + 1.402 * cr
        data[out + 1] = luma - 0.344136 * cb - 0.714136 * cr
        data[out + 2] = luma + 1.772 * cb
      } else {
        const luma = lookups[0].component.plane[rows[0] + lookups[0].xs[x]]
        data[out] = luma
        data[out + 1] = luma
        data[out + 2] = luma
      }
      data[out + 3] = 255
    }
  }

  return data
}

/* ------------------------------ Entry point ------------------------------ */

const dataUrlToBytes = (url: string) => {
  const binary = atob(url.slice(url.indexOf(",") + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export const databendCanvas = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  options: { mode: DatabendMode; amount: number; quality: number; seed: number },
) => {
  const url = canvas.toDataURL("image/jpeg", Math.max(0.05, Math.min(0.95, options.quality / 100)))
  if (!url.startsWith("data:image/jpeg")) return

  const bytes = corruptJpeg(dataUrlToBytes(url), options.mode, options.amount, createRandom(options.seed))
  const decoded = decodeJpeg(bytes)
  if (!decoded || decoded.width !== canvas.width || decoded.height !== canvas.height) return

  context.putImageData(new ImageData(decoded.data, decoded.width, decoded.height), 0, 0)
}
