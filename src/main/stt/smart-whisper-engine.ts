import { Whisper } from 'smart-whisper'
import { isEngineLogLine } from '../text/sanitize'
import type { SttEngine, TranscribeOptions } from './engine'

export class SmartWhisperEngine implements SttEngine {
  private whisper: Whisper | null = null
  private modelPath: string | null = null

  async load(modelPath: string): Promise<void> {
    if (this.whisper && this.modelPath === modelPath) return
    if (this.whisper) {
      await this.whisper.free()
      this.whisper = null
    }
    this.modelPath = modelPath
    this.whisper = new Whisper(modelPath, {
      gpu: true,
      offload: 60
    })
    await this.whisper.load()
  }

  async transcribe(pcm: Float32Array, options: TranscribeOptions = {}): Promise<string> {
    if (!this.whisper) {
      throw new Error('STT engine not loaded. Select and load a model first.')
    }

    const task = await this.whisper.transcribe(pcm, {
      language: options.language === 'auto' ? undefined : options.language,
      initial_prompt: options.prompt,
      suppress_blank: true,
      suppress_non_speech_tokens: true,
      no_speech_thold: 0.6,
      print_progress: false,
      print_realtime: false,
      print_timestamps: false,
      print_special: false,
      debug_mode: false
    })

    const results = await task.result
    const text = results
      .map((r) => r.text.trim())
      .filter((t) => t && !isEngineLogLine(t))
      .join(' ')
      .trim()

    return text
  }

  async unload(): Promise<void> {
    if (this.whisper) {
      await this.whisper.free()
      this.whisper = null
      this.modelPath = null
    }
  }

  isLoaded(): boolean {
    return this.whisper !== null
  }
}

let engineInstance: SmartWhisperEngine | null = null

export function getSttEngine(): SmartWhisperEngine {
  if (!engineInstance) {
    engineInstance = new SmartWhisperEngine()
  }
  return engineInstance
}
