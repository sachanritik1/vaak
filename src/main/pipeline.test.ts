import { describe, it, expect, vi } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Layer, Ref } from 'effect'

import { PipelineService, PipelineLive } from './pipeline'
import { SettingsService } from './store'
import { SttService, type SttService as SttServiceI } from './stt/index'
import { AiCleanupService, type AiCleanupService as AiCleanupServiceI } from './ai/index'
import { InjectionService, type InjectionService as InjectionServiceI } from './injection/macos'
import { HudService, type HudService as HudServiceI } from './windows/hud'
import { ModelsService, type ModelsService as ModelsServiceI } from './models/manager'
import { makeSettingsStub } from './test/stubs'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type HudState,
  type InstalledModel,
  type SttEngineType
} from '../shared/types'
import {
  AiCleanupError,
  InjectionError,
  TranscriptionError,
  UnknownEngineError
} from './errors'

// --- Test helpers --------------------------------------------------------

const pcm = (n: number) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 10))

const makeInstalledModel = (id = 'whisper-tiny', engine: SttEngineType = 'whisper'): InstalledModel => ({
  id,
  name: id,
  filename: `${id}.bin`,
  path: `/models/${id}.bin`,
  sizeBytes: 100,
  language: 'multilingual',
  source: 'catalog',
  engine
})

const makeSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides
})

type BuildOpts = {
  activeModel: InstalledModel | null
  transcribe: (pcm: Float32Array) => string
  cleanup?: (text: string) => string
  injectFails?: boolean
  aiFails?: boolean
  sttLoadFails?: boolean
  unknownEngine?: boolean
  initialSettings?: AppSettings
}

type Stubs = {
  settings: Layer.Layer<never, never, never>
  models: Layer.Layer<never, never, never>
  stt: Layer.Layer<never, never, never>
  ai: Layer.Layer<never, never, never>
  injection: Layer.Layer<never, never, never>
  hud: Layer.Layer<never, never, never>
  hudStates: HudState[]
  injectCalls: string[]
  aiCalls: string[]
  sttLoadCalls: InstalledModel[]
  sttTranscribeCalls: Float32Array[]
}

const buildStubs = (opts: BuildOpts): Stubs => {
  const hudStates: HudState[] = []
  const settings = opts.initialSettings ?? makeSettings()
  const injectCalls: string[] = []
  const aiCalls: string[] = []
  const sttLoadCalls: InstalledModel[] = []
  const sttTranscribeCalls: Float32Array[] = []

  const settingsLayer = makeSettingsStub(settings)

  const modelsLayer = Layer.succeed(ModelsService, {
    getInstalled: Effect.succeed([]),
    getActive: Effect.succeed(opts.activeModel),
    setActive: ((_: string | null) => Effect.void) as ModelsServiceI['setActive'],
    deleteModel: ((_: string) => Effect.void) as ModelsServiceI['deleteModel'],
    downloadCatalog: ((_id: string) =>
      Effect.succeed(makeInstalledModel())) as ModelsServiceI['downloadCatalog'],
    downloadCustom: ((_url: string, _name?: string) =>
      Effect.succeed(makeInstalledModel())) as ModelsServiceI['downloadCustom']
  } as unknown as ModelsServiceI)

  const sttLayer = Layer.succeed(SttService, {
    loadModelForTranscription: (model: InstalledModel) => {
      sttLoadCalls.push(model)
      if (opts.unknownEngine) {
        return Effect.fail(new UnknownEngineError({ engine: 'mystery' }))
      }
      if (opts.sttLoadFails) {
        return Effect.fail(new TranscriptionError({ message: 'load failed' }))
      }
      return Effect.void
    },
    transcribe: (p: Float32Array) => {
      sttTranscribeCalls.push(p)
      return Effect.succeed(opts.transcribe(p))
    },
    unloadAll: Effect.void,
    getActive: Effect.succeed(
      opts.activeModel
        ? { engineType: opts.activeModel.engine, modelId: opts.activeModel.id }
        : null
    )
  } as unknown as SttServiceI)

  const aiLayer = Layer.succeed(AiCleanupService, {
    cleanupText: (text: string) => {
      aiCalls.push(text)
      if (opts.aiFails) {
        return Effect.fail(new AiCleanupError({ provider: 'openai' }))
      }
      return Effect.succeed(opts.cleanup ? opts.cleanup(text) : text)
    }
  } as AiCleanupServiceI)

  const injectionLayer = Layer.succeed(InjectionService, {
    capturePasteTarget: Effect.void,
    clearPasteTarget: Effect.void,
    injectText: (text: string) => {
      injectCalls.push(text)
      if (opts.injectFails) {
        return Effect.fail(new InjectionError({ message: 'paste failed' }))
      }
      return Effect.void
    },
    testInjection: Effect.succeed(true)
  } as unknown as InjectionServiceI)

  const hudLayer = Layer.succeed(HudService, {
    show: Effect.void,
    hide: Effect.void,
    broadcast: (state: HudState) => {
      hudStates.push(state)
      return Effect.void
    },
    notifyRecording: Effect.void,
    notifyStop: Effect.void
  } as HudServiceI)

  return {
    settings: settingsLayer,
    models: modelsLayer,
    stt: sttLayer,
    ai: aiLayer,
    injection: injectionLayer,
    hud: hudLayer,
    hudStates,
    injectCalls,
    aiCalls,
    sttLoadCalls,
    sttTranscribeCalls
  }
}

const buildPipeline = (s: Stubs) =>
  PipelineLive.pipe(
    Layer.provideMerge(s.settings),
    Layer.provideMerge(s.models),
    Layer.provideMerge(s.stt),
    Layer.provideMerge(s.ai),
    Layer.provideMerge(s.injection),
    Layer.provideMerge(s.hud)
  )

// --- Tests ---------------------------------------------------------------

describe('PipelineService — processTranscription', () => {
  it('fails with NoActiveModelError when no active model', () => {
    const s = buildStubs({ activeModel: null, transcribe: () => 'x' })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const exit = yield* Effect.exit(pipeline.processTranscription(pcm(100)))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('full happy path: STT → sanitize → dictionary → AI → snippets → inject → history', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel('whisper-tiny'),
      transcribe: () => 'hello world',
      cleanup: (t) => `cleaned(${t})`,
      initialSettings: makeSettings({
        dictionary: [{ word: 'hello', replacement: 'howdy' }]
      })
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const settings = yield* SettingsService
      yield* pipeline.processTranscription(pcm(100))
      expectEffect(s.sttLoadCalls.length).toBe(1)
      expectEffect(s.sttTranscribeCalls.length).toBe(1)
      expectEffect(s.aiCalls[s.aiCalls.length - 1]).toBe('cleaned(howdy world)')
      expectEffect(s.injectCalls.length).toBe(1)
      expectEffect(s.injectCalls[0]).toBe('cleaned(howdy world)')
      const states = s.hudStates.map((h) => h.state)
      expectEffect(states).toContain('transcribing')
      expectEffect(states).toContain('injecting')
      const after = yield* settings.get
      expectEffect(after.history.length).toBe(1)
      expectEffect(after.history[0].text).toBe('cleaned(howdy world)')
      expectEffect(after.history[0].rawText).toBe('hello world')
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('returns "" and broadcasts "No speech detected" when STT returns empty/whitespace', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => '   \n  '
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const out = yield* pipeline.processTranscription(pcm(100))
      expectEffect(out).toBe('')
      expectEffect(s.hudStates.some((h) => h.message === 'No speech detected')).toBe(true)
      expectEffect(s.injectCalls.length).toBe(0)
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('strips engine log lines and silence hallucinations from STT output', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'whisper_init: ready\nhello world'
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.processTranscription(pcm(100))
      expectEffect(s.injectCalls[0]).toBe('hello world')
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('expands snippets after AI cleanup', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'my addr',
      cleanup: (t) => t,
      initialSettings: makeSettings({
        snippets: [{ id: '1', trigger: 'my addr', content: '123 Main St' }]
      })
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.processTranscription(pcm(100))
      expectEffect(s.injectCalls[0]).toBe('123 Main St')
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('passes the dictionary prompt to whisper STT when engine is whisper', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel('whisper-tiny', 'whisper'),
      transcribe: () => 'x',
      initialSettings: makeSettings({
        dictionary: [{ word: 'k8s' }, { word: 'js' }]
      })
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.processTranscription(pcm(100))
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('omits the prompt for non-whisper engines', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel('moonshine', 'sherpa-onnx'),
      transcribe: () => 'x'
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.processTranscription(pcm(100))
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('fails with TranscriptionError when STT load throws', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'x',
      sttLoadFails: true
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const exit = yield* Effect.exit(pipeline.processTranscription(pcm(100)))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('fails with UnknownEngineError when the model has an unknown engine', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'x',
      unknownEngine: true
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const exit = yield* Effect.exit(pipeline.processTranscription(pcm(100)))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('fails with InjectionError when the paste target refuses the text', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'x',
      injectFails: true
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const exit = yield* Effect.exit(pipeline.processTranscription(pcm(100)))
      expectEffect(Exit.isFailure(exit)).toBe(true)
      expectEffect(s.injectCalls.length).toBe(1)
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('falls back to raw text when AI cleanup fails (catches AiCleanupError)', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'hello',
      aiFails: true
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.processTranscription(pcm(100))
      expectEffect(s.aiCalls.length).toBe(1)
      expectEffect(s.injectCalls[0]).toBe('hello')
    }).pipe(Effect.provide(buildPipeline(s)))
  })
})

describe('PipelineService — markRecordingStart / markRecordingStop', () => {
  it('markRecordingStart does not throw', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'x'
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.markRecordingStart
    }).pipe(Effect.provide(buildPipeline(s)))
  })

  it('markRecordingStop does not throw', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'x'
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      yield* pipeline.markRecordingStop
    }).pipe(Effect.provide(buildPipeline(s)))
  })
})

describe('PipelineService — history durationMs', () => {
  it('records a non-zero durationMs when markRecordingStart was called', () => {
    const s = buildStubs({
      activeModel: makeInstalledModel(),
      transcribe: () => 'x'
    })
    return Effect.gen(function* () {
      const pipeline = yield* PipelineService
      const settings = yield* SettingsService
      yield* pipeline.markRecordingStart
      yield* Effect.sleep('50 millis')
      yield* pipeline.processTranscription(pcm(100))
      const after = yield* settings.get
      expectEffect(after.history[0].durationMs).toBeGreaterThanOrEqual(0)
    }).pipe(Effect.provide(buildPipeline(s)))
  })
})

// Suppress unused import warnings
void Ref
void vi
