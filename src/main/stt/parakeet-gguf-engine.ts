import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { SttEngine, TranscribeOptions } from './engine'
import { transcribeWithParakeetCli, ensureParakeetCli } from './parakeet-cli-binary'
import { writeWavFile } from '../utils/wav'

export class ParakeetGgufEngine implements SttEngine {
  private modelPath: string | null = null

  async load(modelPath: string): Promise<void> {
    await ensureParakeetCli()
    this.modelPath = modelPath
  }

  async transcribe(pcm: Float32Array, _options: TranscribeOptions = {}): Promise<string> {
    if (!this.modelPath) {
      throw new Error('Parakeet GGUF model not loaded.')
    }

    const wavPath = join(tmpdir(), `openwhisper-${randomUUID()}.wav`)
    writeWavFile(pcm, wavPath)

    try {
      return await transcribeWithParakeetCli(this.modelPath, wavPath)
    } finally {
      try {
        unlinkSync(wavPath)
      } catch {
        // ignore
      }
    }
  }

  async unload(): Promise<void> {
    this.modelPath = null
  }

  isLoaded(): boolean {
    return this.modelPath !== null
  }
}

let engineInstance: ParakeetGgufEngine | null = null

export function getParakeetGgufEngine(): ParakeetGgufEngine {
  if (!engineInstance) {
    engineInstance = new ParakeetGgufEngine()
  }
  return engineInstance
}
