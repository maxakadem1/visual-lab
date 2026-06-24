import type { FilterSettings } from "../_types/editor"

const vertexShaderSource = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D uVideo;
uniform vec2 uResolution;
uniform vec3 uPalette[8];
uniform float uTime;
uniform float uPixelSize;
uniform float uNoiseAmount;
uniform float uBloomThreshold;
uniform float uBloomStrength;
uniform float uBloomRadius;
uniform float uLineCount;
uniform float uAmplitude;
uniform float uThickness;
uniform float uScanLineSpacing;
uniform float uScanLineThickness;
uniform float uScanLineOpacity;
uniform int uPaletteCount;
uniform int uSmartColoring;
uniform int uPixelateEnabled;
uniform int uNoiseEnabled;
uniform int uBloomEnabled;
uniform int uColorsEnabled;
uniform int uScanLinesEnabled;
uniform int uModulationEnabled;
uniform int uDirection;

varying vec2 vUv;

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float random(vec2 point) {
  return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 nearestPaletteColor(vec3 color) {
  vec3 nearestColor = uPalette[0];
  float nearestDistance = 999999.0;

  for (int index = 0; index < 8; index++) {
    if (index >= uPaletteCount) {
      break;
    }

    vec3 paletteColor = uPalette[index];

    if (uSmartColoring == 1) {
      float targetLuma = 0.14 + (float(index) / max(1.0, float(uPaletteCount - 1))) * 0.78;
      paletteColor = clamp(paletteColor * (targetLuma / max(0.01, luma(paletteColor))), 0.0, 1.0);
    }

    float distance = dot(color - paletteColor, color - paletteColor);

    if (distance < nearestDistance) {
      nearestColor = paletteColor;
      nearestDistance = distance;
    }
  }

  return nearestColor;
}

vec3 bloomColor(vec2 uv) {
  vec2 texel = 1.0 / uResolution;
  vec3 glow = vec3(0.0);
  float totalWeight = 0.0;

  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel * max(1.0, uBloomRadius);
      vec3 sampleColor = texture2D(uVideo, clamp(uv + offset, 0.0, 1.0)).rgb;
      float brightness = luma(sampleColor);
      float mask = step(uBloomThreshold, brightness);
      float weight = 1.0 / (1.0 + length(vec2(float(x), float(y))));

      glow += sampleColor * mask * weight;
      totalWeight += weight;
    }
  }

  return glow / max(0.01, totalWeight);
}

void main() {
  vec2 pixel = vUv * uResolution;
  vec2 uv = vUv;

  if (uPixelateEnabled == 1) {
    uv = (floor(pixel / max(1.0, uPixelSize)) * max(1.0, uPixelSize) + max(1.0, uPixelSize) * 0.5) / uResolution;
    pixel = uv * uResolution;
  }

  if (uModulationEnabled == 1 && uDirection == 0) {
    float spacing = max(1.0, uResolution.y / max(1.0, uLineCount));
    float lineIndex = floor(pixel.y / spacing);

    if (mod(pixel.y, spacing) > uThickness) {
      discard;
    }

    float brightness = luma(texture2D(uVideo, uv).rgb);
    float wave = sin(lineIndex * 1.7 + uTime * 3.0);
    uv.y -= ((wave * 0.65 + brightness - 0.5) * uAmplitude) / uResolution.y;
  } else if (uModulationEnabled == 1) {
    float spacing = max(1.0, uResolution.x / max(1.0, uLineCount));
    float lineIndex = floor(pixel.x / spacing);

    if (mod(pixel.x, spacing) > uThickness) {
      discard;
    }

    float brightness = luma(texture2D(uVideo, uv).rgb);
    float wave = sin(lineIndex * 1.7 + uTime * 3.0);
    uv.x -= ((wave * 0.65 + brightness - 0.5) * uAmplitude) / uResolution.x;
  }

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    discard;
  }

  vec3 color = texture2D(uVideo, uv).rgb;

  if (uNoiseEnabled == 1) {
    float noise = (random(pixel + uTime) - 0.5) * uNoiseAmount;
    color = clamp(color + noise, 0.0, 1.0);
  }

  if (uBloomEnabled == 1) {
    color = clamp(color + bloomColor(uv) * uBloomStrength, 0.0, 1.0);
  }

  if (uColorsEnabled == 1) {
    color = nearestPaletteColor(color);
  }

  if (uScanLinesEnabled == 1) {
    float scanPosition = mod(pixel.y, max(1.0, uScanLineSpacing));

    if (scanPosition <= uScanLineThickness) {
      color *= 1.0 - uScanLineOpacity;
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
`

type ProgramLocations = {
  amplitude: WebGLUniformLocation
  bloomEnabled: WebGLUniformLocation
  bloomRadius: WebGLUniformLocation
  bloomStrength: WebGLUniformLocation
  bloomThreshold: WebGLUniformLocation
  colorsEnabled: WebGLUniformLocation
  direction: WebGLUniformLocation
  lineCount: WebGLUniformLocation
  modulationEnabled: WebGLUniformLocation
  noiseAmount: WebGLUniformLocation
  noiseEnabled: WebGLUniformLocation
  palette: WebGLUniformLocation
  paletteCount: WebGLUniformLocation
  pixelateEnabled: WebGLUniformLocation
  pixelSize: WebGLUniformLocation
  position: number
  resolution: WebGLUniformLocation
  scanLineOpacity: WebGLUniformLocation
  scanLineSpacing: WebGLUniformLocation
  scanLineThickness: WebGLUniformLocation
  scanLinesEnabled: WebGLUniformLocation
  smartColoring: WebGLUniformLocation
  thickness: WebGLUniformLocation
  time: WebGLUniformLocation
  video: WebGLUniformLocation
}

const createShader = (
  gl: WebGLRenderingContext,
  shaderType: number,
  source: string,
) => {
  const shader = gl.createShader(shaderType)

  if (!shader) {
    return null
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

const createProgram = (gl: WebGLRenderingContext) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
  )

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()

  if (!program) {
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  return program
}

const getUniform = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
) => {
  const location = gl.getUniformLocation(program, name)

  if (!location) {
    throw new Error(`Missing WebGL uniform: ${name}`)
  }

  return location
}

export class VideoWebglRenderer {
  private buffer: WebGLBuffer
  private gl: WebGLRenderingContext
  private locations: ProgramLocations
  private program: WebGLProgram
  private texture: WebGLTexture

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
    })

    if (!gl) {
      throw new Error("WebGL is unavailable")
    }

    const program = createProgram(gl)
    const texture = gl.createTexture()
    const buffer = gl.createBuffer()

    if (!program || !texture || !buffer) {
      throw new Error("WebGL renderer setup failed")
    }

    this.gl = gl
    this.program = program
    this.texture = texture
    this.buffer = buffer
    this.locations = {
      amplitude: getUniform(gl, program, "uAmplitude"),
      bloomEnabled: getUniform(gl, program, "uBloomEnabled"),
      bloomRadius: getUniform(gl, program, "uBloomRadius"),
      bloomStrength: getUniform(gl, program, "uBloomStrength"),
      bloomThreshold: getUniform(gl, program, "uBloomThreshold"),
      colorsEnabled: getUniform(gl, program, "uColorsEnabled"),
      direction: getUniform(gl, program, "uDirection"),
      lineCount: getUniform(gl, program, "uLineCount"),
      modulationEnabled: getUniform(gl, program, "uModulationEnabled"),
      noiseAmount: getUniform(gl, program, "uNoiseAmount"),
      noiseEnabled: getUniform(gl, program, "uNoiseEnabled"),
      palette: getUniform(gl, program, "uPalette[0]"),
      paletteCount: getUniform(gl, program, "uPaletteCount"),
      pixelateEnabled: getUniform(gl, program, "uPixelateEnabled"),
      pixelSize: getUniform(gl, program, "uPixelSize"),
      position: gl.getAttribLocation(program, "aPosition"),
      resolution: getUniform(gl, program, "uResolution"),
      scanLineOpacity: getUniform(gl, program, "uScanLineOpacity"),
      scanLineSpacing: getUniform(gl, program, "uScanLineSpacing"),
      scanLineThickness: getUniform(gl, program, "uScanLineThickness"),
      scanLinesEnabled: getUniform(gl, program, "uScanLinesEnabled"),
      smartColoring: getUniform(gl, program, "uSmartColoring"),
      thickness: getUniform(gl, program, "uThickness"),
      time: getUniform(gl, program, "uTime"),
      video: getUniform(gl, program, "uVideo"),
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  get targetCanvas() {
    return this.canvas
  }

  destroy() {
    this.gl.deleteBuffer(this.buffer)
    this.gl.deleteTexture(this.texture)
    this.gl.deleteProgram(this.program)
  }

  render(
    video: HTMLVideoElement,
    settings: FilterSettings,
    options: { renderScale?: number; time: number } = { time: 0 },
  ) {
    const renderScale = Math.max(0.1, Math.min(1, options.renderScale ?? 1))
    const width = Math.max(1, Math.round(video.videoWidth * renderScale))
    const height = Math.max(1, Math.round(video.videoHeight * renderScale))
    const gl = this.gl

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }

    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(this.locations.position)
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0)

    // Keep modulation controls in source-video pixels, then scale for preview.
    gl.uniform1i(this.locations.video, 0)
    gl.uniform2f(this.locations.resolution, width, height)
    gl.uniform1f(this.locations.time, options.time)
    gl.uniform1f(this.locations.pixelSize, settings.pixelSize * renderScale)
    gl.uniform1f(this.locations.noiseAmount, settings.noiseAmount / 255)
    gl.uniform1f(this.locations.bloomThreshold, settings.bloomThreshold / 255)
    gl.uniform1f(this.locations.bloomStrength, settings.bloomStrength / 100)
    gl.uniform1f(this.locations.bloomRadius, settings.bloomRadius * renderScale)
    gl.uniform1f(this.locations.lineCount, settings.modulationLineCount)
    gl.uniform1f(this.locations.amplitude, settings.modulationAmplitude * renderScale)
    gl.uniform1f(
      this.locations.thickness,
      Math.max(1, settings.modulationThickness * renderScale),
    )
    gl.uniform1i(
      this.locations.direction,
      settings.modulationDirection === "horizontal" ? 0 : 1,
    )
    gl.uniform1f(this.locations.scanLineSpacing, settings.scanLineSpacing * renderScale)
    gl.uniform1f(
      this.locations.scanLineThickness,
      settings.scanLineThickness * renderScale,
    )
    gl.uniform1f(this.locations.scanLineOpacity, settings.scanLineOpacity / 100)
    gl.uniform1i(
      this.locations.pixelateEnabled,
      settings.activeFilters.includes("pixelate") ? 1 : 0,
    )
    gl.uniform1i(
      this.locations.noiseEnabled,
      settings.activeFilters.includes("noise") ? 1 : 0,
    )
    gl.uniform1i(
      this.locations.bloomEnabled,
      settings.activeFilters.includes("bloom") ? 1 : 0,
    )
    gl.uniform1i(
      this.locations.colorsEnabled,
      settings.activeFilters.includes("colors") ? 1 : 0,
    )
    gl.uniform1i(
      this.locations.scanLinesEnabled,
      settings.activeFilters.includes("scan-lines") ? 1 : 0,
    )
    gl.uniform1i(
      this.locations.modulationEnabled,
      settings.activeFilters.includes("modulation") ? 1 : 0,
    )
    gl.uniform1i(this.locations.smartColoring, settings.smartColoring ? 1 : 0)
    gl.uniform1i(
      this.locations.paletteCount,
      Math.max(1, Math.min(8, settings.paletteColors.length)),
    )
    gl.uniform3fv(this.locations.palette, buildPaletteUniform(settings.paletteColors))

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}

export const canUseVideoWebglRenderer = (settings: FilterSettings) => {
  return settings.activeFilters.length > 0
}

const buildPaletteUniform = (paletteColors: string[]) => {
  const palette = new Float32Array(8 * 3)

  // Limit palette uniforms so the video shader stays broadly WebGL 1 friendly.
  paletteColors.slice(0, 8).forEach((color, index) => {
    palette[index * 3] = Number.parseInt(color.slice(1, 3), 16) / 255
    palette[index * 3 + 1] = Number.parseInt(color.slice(3, 5), 16) / 255
    palette[index * 3 + 2] = Number.parseInt(color.slice(5, 7), 16) / 255
  })

  return palette
}
