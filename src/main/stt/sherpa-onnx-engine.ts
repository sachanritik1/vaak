import { unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { SttEngine, TranscribeOptions } from './engine'
import { transcribeWithSherpa, ensureSherpaOffline } from './sherpa-binary'
import { writeWavFile } from '../utils/wav'

export class SherpaOnnxEngine implements SttEngine {
  private modelDir: string | null = null

  async load(modelPath: string): Promise<void> {
    await ensureSherpaOffline()
    this.modelDir = modelPath
  }

  async transcribe(pcm: Float32Array, _options: TranscribeOptions = {}): Promise<string> {
    if (!this.modelDir) {
      throw new Error('Sherpa-ONNX model not loaded.')
    }

    const wavPath = join(tmpdir(), `openwhisper-${randomUUID()}.wav`)
    writeWavFile(pcm, wavPath)

    try {
      return await transcribeWithSherpa(this.modelDir, wavPath)
    } finally {
      try {
        unlinkSync(wavPath)
      } catch {
        // ignore
      }
    }
  }

  async unload(): Promise<void> {
    this.modelDir = null
  }

  isLoaded(): boolean {
    return this.modelDir !== null
  }
}

let engineInstance: SherpaOnnxEngine | null = null

export function getSherpaOnnxEngine(): SherpaOnnxEngine {
  if (!engineInstance) {
    engineInstance = new SherpaOnnxEngine()
  }
  return engineInstance
}
