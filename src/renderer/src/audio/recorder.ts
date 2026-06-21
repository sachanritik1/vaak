export class AudioRecorder {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private worklet: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Float32Array[] = []
  private onLevel: ((level: number) => void) | null = null
  private active = false
  private startPromise: Promise<void> | null = null

  setLevelCallback(cb: (level: number) => void): void {
    this.onLevel = cb
  }

  isActive(): boolean {
    return this.active
  }

  async start(): Promise<void> {
    if (this.active) return
    if (this.startPromise) {
      await this.startPromise
      return
    }

    this.startPromise = this.doStart()
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  private async doStart(): Promise<void> {
    await this.cleanup()
    this.chunks = []

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    this.context = new AudioContext()
    const sourceRate = this.context.sampleRate

    await this.context.audioWorklet.addModule('pcm-worklet.js')

    this.worklet = new AudioWorkletNode(this.context, 'pcm-processor', {
      processorOptions: { sourceSampleRate: sourceRate }
    })

    this.worklet.port.onmessage = (event: MessageEvent) => {
      const { type, pcm, level } = event.data as {
        type: string
        pcm: ArrayBuffer
        level: number
      }
      if (type === 'pcm') {
        this.chunks.push(new Float32Array(pcm))
        this.onLevel?.(level)
      }
    }

    this.source = this.context.createMediaStreamSource(this.stream)
    this.source.connect(this.worklet)
    this.active = true
  }

  async stop(): Promise<Float32Array> {
    if (!this.active && this.chunks.length === 0) {
      return new Float32Array(0)
    }

    // Flush remaining samples from the worklet before tearing down
    if (this.worklet) {
      this.worklet.port.postMessage('flush')
      await new Promise((r) => setTimeout(r, 50))
    }

    await this.cleanup()

    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0)
    const pcm = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this.chunks) {
      pcm.set(chunk, offset)
      offset += chunk.length
    }
    this.chunks = []
    return pcm
  }

  private async cleanup(): Promise<void> {
    this.active = false

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.worklet) {
      this.worklet.disconnect()
      this.worklet.port.onmessage = null
      this.worklet = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.context) {
      try {
        await this.context.close()
      } catch {
        // ignore
      }
      this.context = null
    }
  }
}

export const audioRecorder = new AudioRecorder()
