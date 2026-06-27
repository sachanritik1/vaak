import { Context, Effect, Layer, Ref } from 'effect'
import type { InstalledModel, SttEngineType } from '../../shared/types'
import type { TranscribeOptions } from './engine'
import { getSttEngine as getWhisperEngine } from './smart-whisper-engine'
import { getParakeetCoremlEngine } from './parakeet-coreml-engine'
import { getParakeetGgufEngine } from './parakeet-gguf-engine'
import { getSherpaOnnxEngine } from './sherpa-onnx-engine'
import { NoSttEngineLoadedError, TranscriptionError, UnknownEngineError } from '../errors'

type ActiveEngine = {
  readonly engineType: SttEngineType
  readonly modelId: string
}

export interface SttService {
  readonly loadModelForTranscription: (model: InstalledModel) => Effect.Effect<void, TranscriptionError | UnknownEngineError>
  readonly transcribe: (pcm: Float32Array, options?: TranscribeOptions) => Effect.Effect<string, TranscriptionError | NoSttEngineLoadedError>
  readonly unloadAll: Effect.Effect<void, TranscriptionError>
  readonly getActive: Effect.Effect<ActiveEngine | null>
}

export const SttService = Context.Service<SttService>('@vaak/Stt')

type EngineOps = {
  load: (path: string) => Effect.Effect<void, TranscriptionError>
  transcribe: (pcm: Float32Array, options?: TranscribeOptions) => Effect.Effect<string, TranscriptionError>
  unload: () => Effect.Effect<void, TranscriptionError>
}

function wrapEngine(
  ops: {
    load(path: string): Promise<void>
    transcribe(pcm: Float32Array, options?: TranscribeOptions): Promise<string>
    unload(): Promise<void>
  }
): EngineOps {
  return {
    load: (path) =>
      Effect.tryPromise({
        try: () => ops.load(path),
        catch: (cause) => new TranscriptionError({ message: 'STT load failed', error: cause })
      }),
    transcribe: (pcm, options) =>
      Effect.tryPromise({
        try: () => ops.transcribe(pcm, options),
        catch: (cause) => new TranscriptionError({ message: 'STT transcribe failed', error: cause })
      }),
    unload: () =>
      Effect.tryPromise({
        try: () => ops.unload(),
        catch: (cause) => new TranscriptionError({ message: 'STT unload failed', error: cause })
      })
  }
}

function engineFor(type: SttEngineType): EngineOps {
  switch (type) {
    case 'whisper':
      return wrapEngine(getWhisperEngine())
    case 'parakeet-coreml':
      return wrapEngine(getParakeetCoremlEngine())
    case 'parakeet-gguf':
      return wrapEngine(getParakeetGgufEngine())
    case 'sherpa-onnx':
      return wrapEngine(getSherpaOnnxEngine())
  }
}

export const SttLive = Layer.effect(SttService, Effect.gen(function* () {
  const activeRef = yield* Ref.make<ActiveEngine | null>(null)

  const unloadAll = Effect.gen(function* () {
    const active = yield* Ref.get(activeRef)
    if (active) {
      yield* engineFor(active.engineType).unload()
    }
    yield* Ref.set(activeRef, null)
  })

  const loadModelForTranscription = Effect.fn('Stt.loadModel')(
    function* (model: InstalledModel) {
      const engineType: SttEngineType = model.engine ?? 'whisper'
      if (
        engineType !== 'whisper' &&
        engineType !== 'parakeet-coreml' &&
        engineType !== 'parakeet-gguf' &&
        engineType !== 'sherpa-onnx'
      ) {
        return yield* new UnknownEngineError({ engine: String(engineType) })
      }

      const active = yield* Ref.get(activeRef)
      if (active?.engineType === engineType && active.modelId === model.id) {
        yield* engineFor(engineType).load(model.path)
        return
      }

      yield* unloadAll
      yield* engineFor(engineType).load(model.path)
      yield* Ref.set(activeRef, { engineType, modelId: model.id })
    }
  )

  const transcribe = Effect.fn('Stt.transcribe')(
    function* (pcm: Float32Array, options: TranscribeOptions = {}) {
      const active = yield* Ref.get(activeRef)
      if (!active) {
        return yield* new NoSttEngineLoadedError({
          message: 'No STT engine loaded. Select and download a model first.'
        })
      }
      return yield* engineFor(active.engineType).transcribe(pcm, options)
    }
  )

  return {
    loadModelForTranscription,
    transcribe,
    unloadAll,
    getActive: Ref.get(activeRef)
  }
}))
