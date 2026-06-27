import { randomUUID } from 'node:crypto'
import { Context, Effect, Layer, Ref, Schema } from 'effect'
import { SettingsService } from './store'
import { SttService } from './stt/index'
import { AiCleanupService } from './ai/index'
import { InjectionService } from './injection/macos'
import { HudService } from './windows/hud'
import { ModelsService } from './models/manager'
import { NoActiveModelError, NoSttEngineLoadedError, TranscriptionError, UnknownEngineError, InjectionError } from './errors'
import { applyDictionary, buildWhisperPrompt } from './text/dictionary'
import { sanitizeTranscription } from './text/sanitize'
import { expandSnippets } from './text/snippets'

/**
 * PipelineService orchestrates the dictation flow:
 * STT -> sanitize -> dictionary -> AI cleanup -> snippets -> injection -> history.
 * Recording-start timing is held in a Ref so the hotkey manager can mark it.
 */
export interface PipelineService {
  readonly processTranscription: (
    pcm: Float32Array
  ) => Effect.Effect<
    string,
    | NoActiveModelError
    | TranscriptionError
    | NoSttEngineLoadedError
    | UnknownEngineError
    | InjectionError
    | Schema.SchemaError
  >
  readonly markRecordingStart: Effect.Effect<void>
  readonly markRecordingStop: Effect.Effect<void>
}

export const PipelineService = Context.Service<PipelineService>('@vaak/Pipeline')

export const PipelineLive = Layer.effect(PipelineService, Effect.gen(function* () {
  const settings = yield* SettingsService
  const stt = yield* SttService
  const ai = yield* AiCleanupService
  const injection = yield* InjectionService
  const hud = yield* HudService
  const models = yield* ModelsService

  const startTimeRef = yield* Ref.make(0)

  const processTranscription = Effect.fn('Pipeline.process')(function* (pcm: Float32Array) {
    const appSettings = yield* settings.get
    const model = yield* models.getActive

    yield* hud.broadcast({ state: 'transcribing', level: 0, message: 'Transcribing…' })

    if (!model) {
      return yield* new NoActiveModelError({
        message: 'No active model selected. Download and select a model in Settings.'
      })
    }

    yield* stt.loadModelForTranscription(model)

    const prompt = buildWhisperPrompt(appSettings.dictionary)
    let rawText = yield* stt.transcribe(pcm, {
      language: 'auto',
      prompt: model.engine === 'whisper' ? prompt : undefined,
      gpu: appSettings.gpuEnabled
    })

    rawText = sanitizeTranscription(rawText)
    if (!rawText) {
      yield* hud.broadcast({ state: 'idle', level: 0, message: 'No speech detected' })
      return ''
    }

    let text = applyDictionary(rawText, appSettings.dictionary)
    text = yield* ai.cleanupText(text, appSettings.ai)
    text = expandSnippets(text, appSettings.snippets)

    yield* hud.broadcast({ state: 'injecting', level: 0, message: 'Pasting…' })
    yield* injection.injectText(text)

    const startTime = yield* Ref.get(startTimeRef)
    const durationMs = startTime > 0 ? Date.now() - startTime : 0
    yield* settings.addHistory({
      id: randomUUID(),
      text,
      rawText,
      timestamp: Date.now(),
      durationMs
    })

    yield* hud.broadcast({ state: 'idle', level: 0 })
    return text
  })

  return {
    processTranscription,
    markRecordingStart: Ref.set(startTimeRef, Date.now()),
    markRecordingStop: Effect.void
  }
}))
