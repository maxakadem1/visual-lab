import { AudioAnalyser, silentLevels, type AudioLevels } from "./audio-reactive"

export type AudioSource = "off" | "media" | "mic"

/**
 * Owns the preview's AudioContext. A media element can be wired into Web Audio
 * only once, so its source node is cached and stays connected to the speakers.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()
  private analyser: AudioAnalyser | null = null
  private micStream: MediaStream | null = null

  private getContext() {
    this.context ??= new AudioContext()
    return this.context
  }

  async start(source: Exclude<AudioSource, "off">, media?: HTMLMediaElement) {
    const context = this.getContext()
    await context.resume()

    if (source === "media") {
      if (!media) throw new Error("Open a video to react to its soundtrack.")
      let node = this.elementSources.get(media)
      if (!node) {
        node = context.createMediaElementSource(media)
        node.connect(context.destination)
        this.elementSources.set(media, node)
      }
      this.stop()
      this.analyser = new AudioAnalyser(context, node)
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      throw new Error("Microphone access was blocked.")
    }

    this.stop()
    this.micStream = stream
    // Mic input goes to the analyser only, never the speakers, to avoid feedback.
    this.analyser = new AudioAnalyser(context, context.createMediaStreamSource(stream))
  }

  stop() {
    this.analyser?.disconnect()
    this.analyser = null
    this.micStream?.getTracks().forEach((track) => track.stop())
    this.micStream = null
  }

  /** Wake the context after the browser suspended it (it also carries video sound). */
  resume() {
    if (this.context?.state === "suspended") void this.context.resume().catch(() => {})
  }

  sample(): AudioLevels {
    return this.analyser?.sample() ?? silentLevels
  }
}
