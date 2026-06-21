import type { SttEngine, TranscribeOptions } from './engine'

type ParakeetModule = {
  ParakeetAsrEngine: new (opts?: { autoDownload?: boolean }) => {
    initialize(): Promise<void>
    transcribe(samples: Float32Array, opts?: { sampleRate?: number }): Promise<{ text: string }>
    cleanup(): void
    isReady(): boolean
  }
  isAvailable(): boolean
  getDefaultModelDir(): string
}

export class ParakeetCoremlEngine implements SttEngine {
  private engine: InstanceType<ParakeetModule['ParakeetAsrEngine']> | null = null
  private loaded = false
  private parakeetModule: ParakeetModule | null = null

  private async getModule(): Promise<ParakeetModule> {
    if (this.parakeetModule) return this.parakeetModule
    try {
      this.parakeetModule = (await import('parakeet-coreml')) as ParakeetModule
      return this.parakeetModule
    } catch {
      throw new Error(
        'parakeet-coreml is not available. Requires macOS 14+ on Apple Silicon. Run npm install and rebuild native modules.'
      )
    }
  }

  async load(_modelPath: string): Promise<void> {
    const mod = await this.getModule()
    if (!mod.isAvailable()) {
      throw new Error('Parakeet CoreML requires macOS 14+ on Apple Silicon (M1/M2/M3/M4).')
    }
    if (this.engine?.isReady()) return

    this.engine?.cleanup()
    this.engine = new mod.ParakeetAsrEngine({ autoDownload: true })
    await this.engine.initialize()
    this.loaded = true
  }

  async transcribe(pcm: Float32Array, _options: TranscribeOptions = {}): Promise<string> {
    if (!this.engine?.isReady()) {
      throw new Error('Parakeet engine not loaded.')
    }
    const result = await this.engine.transcribe(pcm, { sampleRate: 16000 })
    return result.text.trim()
  }

  async unload(): Promise<void> {
    this.engine?.cleanup()
    this.engine = null
    this.loaded = false
  }

  isLoaded(): boolean {
    return this.loaded && (this.engine?.isReady() ?? false)
  }
}

let engineInstance: ParakeetCoremlEngine | null = null

export function getParakeetCoremlEngine(): ParakeetCoremlEngine {
  if (!engineInstance) {
    engineInstance = new ParakeetCoremlEngine()
  }
  return engineInstance
}

export async function downloadParakeetCoremlModels(
  onProgress?: (percent: number) => void
): Promise<string> {
  const mod = await import('parakeet-coreml') as ParakeetModule
  if (!mod.isAvailable()) {
    throw new Error('Parakeet CoreML requires macOS 14+ on Apple Silicon.')
  }

  onProgress?.(10)
  const engine = new mod.ParakeetAsrEngine({ autoDownload: true })
  onProgress?.(30)
  await engine.initialize()
  onProgress?.(100)
  const modelDir = mod.getDefaultModelDir()
  engine.cleanup()
  return modelDir
}
