import type { FilterLayerSettings } from "../_types/editor"

/* --------------------------------- Memory -------------------------------- */

/**
 * Effects that look at earlier frames keep their buffers here, one entry per
 * layer. The preview and each export own a separate memory.
 */
export type EffectMemory = Map<string, LayerMemory>

type LayerMemory = SlitMemory | MoshMemory | FeedbackMemory

export const createEffectMemory = (): EffectMemory => new Map()

export type FrameInfo = {
  memory?: EffectMemory
  /** Seconds, used to animate effects. */
  time: number
  /** Media time of the video frame. Absent for still images. */
  frameTime?: number
}

type Step = "advance" | "same" | "reset"

/** Same frame (paused, settings changed), next frame, or a seek. */
const classifyStep = (lastTime: number | null, frameTime: number): Step => {
  if (lastTime === null) return "reset"
  if (frameTime === lastTime) return "same"
  if (frameTime < lastTime || frameTime - lastTime > 1) return "reset"
  return "advance"
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

const get2d = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!

const copyCanvas = (target: HTMLCanvasElement, source: CanvasImageSource) => {
  const context = get2d(target)
  context.globalAlpha = 1
  context.globalCompositeOperation = "source-over"
  context.clearRect(0, 0, target.width, target.height)
  context.drawImage(source, 0, 0, target.width, target.height)
}

const hash = (a: number, b: number) => {
  let value = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

/* ----------------------------- Pixel gravity ----------------------------- */

export const applyGravity = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
  time: number,
) => {
  const { width, height } = canvas
  let fall = settings.gravityFall / 100

  // Ease in and out so the loop dissolves, then reforms without a jump.
  if (settings.gravityAnimate) fall *= 0.5 - 0.5 * Math.cos((time * Math.PI * 2) / 4)
  if (fall <= 0) return

  const source = context.getImageData(0, 0, width, height).data
  const output = context.createImageData(width, height)
  const out = output.data
  for (let index = 3; index < out.length; index += 4) out[index] = 255

  const vertical = settings.gravityDirection === "down" || settings.gravityDirection === "up"
  const lines = vertical ? width : height
  const length = vertical ? height : width
  const maxFall = fall * length
  const scatter = settings.gravityScatter / 100
  const threshold = settings.gravityThreshold
  const bright = settings.gravityLoose !== "dark"

  // Position 0 is the floor the pixels fall toward.
  const pixelIndex: (line: number, position: number) => number =
    settings.gravityDirection === "down"
      ? (line, position) => ((height - 1 - position) * width + line) * 4
      : settings.gravityDirection === "up"
        ? (line, position) => (position * width + line) * 4
        : settings.gravityDirection === "right"
          ? (line, position) => (line * width + (width - 1 - position)) * 4
          : (line, position) => (line * width + position) * 4

  const looseFlags = new Uint8Array(length)

  for (let line = 0; line < lines; line += 1) {
    const lineSpeed = hash(line, 7919)
    looseFlags.fill(0)

    // Fixed pixels stay put; loose ones leave a dark hole behind.
    for (let position = 0; position < length; position += 1) {
      const from = pixelIndex(line, position)
      const luma = source[from] * 0.2126 + source[from + 1] * 0.7152 + source[from + 2] * 0.0722
      if (bright ? luma >= threshold : luma <= threshold) {
        looseFlags[position] = 1
        continue
      }
      out[from] = source[from]
      out[from + 1] = source[from + 1]
      out[from + 2] = source[from + 2]
    }

    // Loose pixels fall over the scene and stack on the floor and each other.
    let landing = 0
    for (let position = 0; position < length; position += 1) {
      if (!looseFlags[position]) continue
      const speed = 1 - scatter * (0.5 * lineSpeed + 0.5 * hash(line, position))
      const target = Math.max(position - Math.floor(maxFall * speed), landing)
      const from = pixelIndex(line, position)
      const to = pixelIndex(line, target)
      out[to] = source[from]
      out[to + 1] = source[from + 1]
      out[to + 2] = source[from + 2]
      landing = target + 1
    }
  }

  context.putImageData(output, 0, 0)
}

/* -------------------------------- Slit-scan ------------------------------ */

type SlitMemory = {
  kind: "slit"
  width: number
  height: number
  frames: HTMLCanvasElement[]
  head: number
  count: number
  lastTime: number | null
}

/** Keep the frame history under roughly 200 MB. */
const maxHistoryPixels = 48_000_000

export const applySlitScan = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
  layerId: string,
  info: FrameInfo,
  renderScale: number,
) => {
  if (!info.memory || info.frameTime === undefined) return
  const { width, height } = canvas
  const capacity = Math.max(
    2,
    Math.min(Math.round(settings.slitDelay), Math.floor(maxHistoryPixels / (width * height))),
  )
  let memory = info.memory.get(layerId) as SlitMemory | undefined

  if (!memory || memory.kind !== "slit" || memory.width !== width || memory.height !== height) {
    memory = { kind: "slit", width, height, frames: [], head: -1, count: 0, lastTime: null }
    info.memory.set(layerId, memory)
  }

  if (memory.frames.length !== capacity) {
    // Keep the newest frames, in order, when the time span changes.
    const keep = Math.min(memory.count, capacity)
    const ordered = Array.from(
      { length: keep },
      (_, age) =>
        memory!.frames[(memory!.head - (keep - 1 - age) + memory!.frames.length) % memory!.frames.length],
    )
    const spare = memory.frames.filter((frame) => !ordered.includes(frame))
    const frames = [...ordered]
    while (frames.length < capacity) frames.push(spare.pop() ?? createCanvas(width, height))
    memory.frames = frames
    memory.head = keep - 1
    memory.count = keep
  }

  const step = classifyStep(memory.lastTime, info.frameTime)
  if (step === "reset") memory.count = 0

  if (step !== "same" || memory.count === 0) {
    memory.head = (memory.head + 1 + capacity) % capacity
    copyCanvas(memory.frames[memory.head], canvas)
    memory.count = Math.min(capacity, memory.count + 1)
    memory.lastTime = info.frameTime
  }

  if (memory.count <= 1) return

  const rows = settings.slitDirection === "down" || settings.slitDirection === "up"
  const reverse = settings.slitDirection === "up" || settings.slitDirection === "left"
  const length = rows ? height : width
  const band = Math.max(1, Math.round(2 * renderScale))

  for (let position = 0; position < length; position += band) {
    const size = Math.min(band, length - position)
    const fraction = position / Math.max(1, length - 1)
    const delay = Math.round((reverse ? 1 - fraction : fraction) * (memory.count - 1))
    const frame = memory.frames[(memory.head - delay + capacity) % capacity]

    if (rows) context.drawImage(frame, 0, position, width, size, 0, position, width, size)
    else context.drawImage(frame, position, 0, size, height, position, 0, size, height)
  }
}

/* -------------------------------- Datamosh ------------------------------- */

type MoshMemory = {
  kind: "mosh"
  width: number
  height: number
  analysisWidth: number
  analysisHeight: number
  previousLuma: Float32Array | null
  output: HTMLCanvasElement
  scratch: HTMLCanvasElement
  analysis: HTMLCanvasElement
  lastTime: number | null
  lastKeyframe: number
}

const readLuma = (memory: MoshMemory, source: HTMLCanvasElement) => {
  const context = memory.analysis.getContext("2d", { willReadFrequently: true })!
  context.drawImage(source, 0, 0, memory.analysisWidth, memory.analysisHeight)
  const pixels = context.getImageData(0, 0, memory.analysisWidth, memory.analysisHeight).data
  const luma = new Float32Array(memory.analysisWidth * memory.analysisHeight)
  for (let index = 0; index < luma.length; index += 1) {
    const offset = index * 4
    luma[index] = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114
  }
  return luma
}

export const applyDatamosh = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
  layerId: string,
  info: FrameInfo,
  renderScale: number,
) => {
  if (!info.memory || info.frameTime === undefined) return
  const { width, height } = canvas
  let memory = info.memory.get(layerId) as MoshMemory | undefined

  if (!memory || memory.kind !== "mosh" || memory.width !== width || memory.height !== height) {
    const scale = Math.min(1, 320 / width)
    const analysisWidth = Math.max(8, Math.round(width * scale))
    const analysisHeight = Math.max(8, Math.round(height * scale))
    memory = {
      kind: "mosh",
      width,
      height,
      analysisWidth,
      analysisHeight,
      previousLuma: null,
      output: createCanvas(width, height),
      scratch: createCanvas(width, height),
      analysis: createCanvas(analysisWidth, analysisHeight),
      lastTime: null,
      lastKeyframe: 0,
    }
    info.memory.set(layerId, memory)
  }

  const step = classifyStep(memory.lastTime, info.frameTime)

  if (step === "same" && memory.previousLuma) {
    context.drawImage(memory.output, 0, 0)
    return
  }

  const luma = readLuma(memory, canvas)
  const keyframeDue =
    settings.moshKeyframe > 0 && info.frameTime - memory.lastKeyframe >= settings.moshKeyframe

  memory.lastTime = info.frameTime

  if (step === "reset" || !memory.previousLuma || keyframeDue) {
    copyCanvas(memory.output, canvas)
    memory.previousLuma = luma
    memory.lastKeyframe = info.frameTime
    return
  }

  const { analysisWidth: aw, analysisHeight: ah } = memory
  const scaleX = width / aw
  const scaleY = height / ah
  const block = Math.max(4, Math.round((settings.moshBlockSize * renderScale) / scaleX))
  const search = 4
  const boost = settings.moshBoost / 100
  const previous = memory.previousLuma
  const scratch = get2d(memory.scratch)

  scratch.globalAlpha = 1
  scratch.globalCompositeOperation = "source-over"
  scratch.drawImage(memory.output, 0, 0)

  for (let by = 0; by < ah; by += block) {
    for (let bx = 0; bx < aw; bx += block) {
      const bw = Math.min(block, aw - bx)
      const bh = Math.min(block, ah - by)
      let bestX = 0
      let bestY = 0
      let bestCost = Infinity

      // Block matching: where in the previous frame did this block come from?
      for (let dy = -search; dy <= search; dy += 1) {
        if (by + dy < 0 || by + dy + bh > ah) continue
        for (let dx = -search; dx <= search; dx += 1) {
          if (bx + dx < 0 || bx + dx + bw > aw) continue
          let cost = 0
          for (let y = 0; y < bh; y += 1) {
            const row = (by + y) * aw + bx
            const previousRow = (by + y + dy) * aw + bx + dx
            for (let x = 0; x < bw; x += 1) cost += Math.abs(luma[row + x] - previous[previousRow + x])
          }
          // Favor standing still so flat areas don't jitter.
          if (dx === 0 && dy === 0) cost *= 0.85
          if (cost < bestCost) {
            bestCost = cost
            bestX = dx
            bestY = dy
          }
        }
      }

      if (bestX === 0 && bestY === 0) continue

      const x = Math.round(bx * scaleX)
      const y = Math.round(by * scaleY)
      const w = Math.min(width - x, Math.ceil(bw * scaleX))
      const h = Math.min(height - y, Math.ceil(bh * scaleY))
      const sx = Math.max(0, Math.min(width - w, Math.round(x + bestX * scaleX * boost)))
      const sy = Math.max(0, Math.min(height - h, Math.round(y + bestY * scaleY * boost)))

      // Drag the old picture along the new motion instead of showing the new frame.
      scratch.drawImage(memory.output, sx, sy, w, h, x, y, w, h)
    }
  }

  if (settings.moshBleed > 0) {
    scratch.globalAlpha = settings.moshBleed / 100
    scratch.drawImage(canvas, 0, 0)
    scratch.globalAlpha = 1
  }

  const finished = memory.scratch
  memory.scratch = memory.output
  memory.output = finished
  memory.previousLuma = luma
  context.drawImage(memory.output, 0, 0)
}

/* -------------------------------- Feedback ------------------------------- */

type FeedbackMemory = {
  kind: "feedback"
  width: number
  height: number
  state: HTMLCanvasElement
  base: HTMLCanvasElement
  lastTime: number | null
}

const blendModes: Record<FilterLayerSettings["feedbackBlend"], GlobalCompositeOperation> = {
  lighten: "lighten",
  screen: "screen",
  difference: "difference",
  mix: "source-over",
}

const compositeFeedback = (
  target: HTMLCanvasElement,
  input: CanvasImageSource,
  previous: CanvasImageSource,
  settings: FilterLayerSettings,
) => {
  const context = get2d(target)
  const { width, height } = target

  context.save()
  context.globalAlpha = 1
  context.globalCompositeOperation = "source-over"
  context.clearRect(0, 0, width, height)
  context.drawImage(input, 0, 0, width, height)
  context.globalAlpha = settings.feedbackPersistence / 100
  context.globalCompositeOperation = blendModes[settings.feedbackBlend] ?? "lighten"
  if (settings.feedbackHue > 0) context.filter = `hue-rotate(${settings.feedbackHue}deg)`
  context.translate(width / 2, height / 2)
  context.rotate((settings.feedbackRotate * Math.PI) / 180)
  context.scale(settings.feedbackZoom / 100, settings.feedbackZoom / 100)
  context.translate(-width / 2, -height / 2)
  context.drawImage(previous, 0, 0, width, height)
  context.restore()
}

const stillIterations = 28

export const applyFeedback = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  settings: FilterLayerSettings,
  layerId: string,
  info: FrameInfo,
) => {
  const { width, height } = canvas

  if (!info.memory || info.frameTime === undefined) {
    // A still has no past, so iterate the loop to build the echo in one go.
    const input = createCanvas(width, height)
    copyCanvas(input, canvas)
    let accumulator = createCanvas(width, height)
    let next = createCanvas(width, height)
    copyCanvas(accumulator, input)

    for (let iteration = 0; iteration < stillIterations; iteration += 1) {
      compositeFeedback(next, input, accumulator, settings)
      ;[accumulator, next] = [next, accumulator]
    }

    context.clearRect(0, 0, width, height)
    context.drawImage(accumulator, 0, 0)
    return
  }

  let memory = info.memory.get(layerId) as FeedbackMemory | undefined
  if (!memory || memory.kind !== "feedback" || memory.width !== width || memory.height !== height) {
    memory = {
      kind: "feedback",
      width,
      height,
      state: createCanvas(width, height),
      base: createCanvas(width, height),
      lastTime: null,
    }
    info.memory.set(layerId, memory)
  }

  const step = classifyStep(memory.lastTime, info.frameTime)

  if (step === "reset") {
    copyCanvas(memory.base, canvas)
  } else if (step === "advance") {
    const previous = memory.state
    memory.state = memory.base
    memory.base = previous
  }

  // "same" recomposes from the same base so paused tweaks don't snowball.
  compositeFeedback(memory.state, canvas, memory.base, settings)
  memory.lastTime = info.frameTime
  context.clearRect(0, 0, width, height)
  context.drawImage(memory.state, 0, 0)
}

/** Drop buffers that belong to layers no longer in the stack. */
export const pruneEffectMemory = (memory: EffectMemory, layerIds: Set<string>) => {
  for (const id of memory.keys()) {
    if (!layerIds.has(id)) memory.delete(id)
  }
}
