export interface SttEngine {
  load(modelPath: string): Promise<void>
  transcribe(pcm: Float32Array, options?: TranscribeOptions): Promise<string>
  unload(): Promise<void>
  isLoaded(): boolean
}

export type TranscribeOptions = {
  language?: string
  prompt?: string
  gpu?: boolean
}

export interface SttEngineFactory {
  create(): SttEngine
}
