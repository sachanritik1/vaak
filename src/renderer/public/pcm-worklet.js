class PcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.targetRate = 16000
    this.buffer = []
    this.sourceRate = options.processorOptions?.sourceSampleRate || 48000

    this.port.onmessage = (event) => {
      if (event.data === 'flush') {
        this.flush()
      }
    }
  }

  flush() {
    if (this.buffer.length === 0) return
    const pcm = new Float32Array(this.buffer)
    this.buffer = []
    this.port.postMessage({ type: 'pcm', pcm: pcm.buffer, level: 0 }, [pcm.buffer])
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input || input.length === 0) return true

    const ratio = this.sourceRate / this.targetRate
    for (let i = 0; i < input.length; i++) {
      const idx = Math.floor(i * ratio)
      if (idx < input.length) {
        this.buffer.push(input[idx])
      }
    }

    const chunkSize = 4096
    while (this.buffer.length >= chunkSize) {
      const chunk = this.buffer.splice(0, chunkSize)
      const pcm = new Float32Array(chunk)
      let sum = 0
      for (let j = 0; j < pcm.length; j++) sum += pcm[j] * pcm[j]
      const level = Math.sqrt(sum / pcm.length)
      this.port.postMessage({ type: 'pcm', pcm: pcm.buffer, level }, [pcm.buffer])
    }

    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
