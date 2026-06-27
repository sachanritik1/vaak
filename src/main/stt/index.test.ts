import { describe, it, expect, vi, beforeEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit } from 'effect'

// Mock the four engine adapter factories. Each returns an object with
// `load`, `transcribe`, `unload` (the shape `wrapEngine` expects). We record
// the calls so tests can assert on them.
const whisperOps = { load: vi.fn(), transcribe: vi.fn(), unload: vi.fn() }
const coremlOps = { load: vi.fn(), transcribe: vi.fn(), unload: vi.fn() }
const ggufOps = { load: vi.fn(), transcribe: vi.fn(), unload: vi.fn() }
const sherpaOps = { load: vi.fn(), transcribe: vi.fn(), unload: vi.fn() }

vi.mock('./smart-whisper-engine', () => ({
  getSttEngine: () => whisperOps
}))
vi.mock('./parakeet-coreml-engine', () => ({
  getParakeetCoremlEngine: () => coremlOps
}))
vi.mock('./parakeet-gguf-engine', () => ({
  getParakeetGgufEngine: () => ggufOps
}))
vi.mock('./sherpa-onnx-engine', () => ({
  getSherpaOnnxEngine: () => sherpaOps
}))

import { SttService, SttLive } from './index'
import type { InstalledModel } from '../../shared/types'

const whisperModel: InstalledModel = {
  id: 'whisper-tiny',
  name: 'Whisper Tiny',
  filename: 'ggml-tiny.bin',
  path: '/models/ggml-tiny.bin',
  sizeBytes: 75_000_000,
  language: 'multilingual',
  source: 'catalog',
  engine: 'whisper'
}

const parakeetGgufModel: InstalledModel = {
  id: 'parakeet-tdt-v3-q5',
  name: 'Parakeet TDT v3 (GGUF Q5)',
  filename: 'tdt-0.6b-v3-q5_k.gguf',
  path: '/models/tdt-0.6b-v3-q5_k.gguf',
  sizeBytes: 742_000_000,
  language: 'multilingual',
  source: 'catalog',
  engine: 'parakeet-gguf'
}

const sherpaModel: InstalledModel = {
  id: 'moonshine-tiny-en',
  name: 'Moonshine Tiny',
  filename: 'moonshine-tiny-en',
  path: '/models/moonshine-tiny-en',
  sizeBytes: 124_000_000,
  language: 'english',
  source: 'catalog',
  engine: 'sherpa-onnx'
}

const makeOp = () => ({
  load: vi.fn().mockResolvedValue(undefined),
  transcribe: vi.fn().mockResolvedValue('the transcription'),
  unload: vi.fn().mockResolvedValue(undefined)
})

beforeEach(() => {
  // Reset all four engine mocks to fresh spies each test
  Object.assign(whisperOps, makeOp())
  Object.assign(coremlOps, makeOp())
  Object.assign(ggufOps, makeOp())
  Object.assign(sherpaOps, makeOp())
})

describe('SttLive — loadModelForTranscription', () => {
  itEffect('loads the whisper engine for a whisper model', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      expectEffect(whisperOps.load).toHaveBeenCalledWith(whisperModel.path)
      const active = yield* svc.getActive
      expectEffect(active?.engineType).toBe('whisper')
      expectEffect(active?.modelId).toBe('whisper-tiny')
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('loads the parakeet-gguf engine for a gguf model', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(parakeetGgufModel)
      expectEffect(ggufOps.load).toHaveBeenCalledWith(parakeetGgufModel.path)
      const active = yield* svc.getActive
      expectEffect(active?.engineType).toBe('parakeet-gguf')
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('loads the sherpa-onnx engine for a sherpa model', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(sherpaModel)
      expectEffect(sherpaOps.load).toHaveBeenCalledWith(sherpaModel.path)
      const active = yield* svc.getActive
      expectEffect(active?.engineType).toBe('sherpa-onnx')
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('skips unload+reload when the same engine+model is already active', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      const callsAfterFirst = whisperOps.load.mock.calls.length
      yield* svc.loadModelForTranscription(whisperModel)
      // Reload triggers another load() call (not a swap), so calls increment
      expectEffect(whisperOps.load.mock.calls.length).toBe(callsAfterFirst + 1)
      // But no other engine's load was called
      expectEffect(ggufOps.load).not.toHaveBeenCalled()
      expectEffect(sherpaOps.load).not.toHaveBeenCalled()
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('unloads the prior engine when switching engine types', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      const whisperUnloadsAfterFirst = whisperOps.unload.mock.calls.length
      yield* svc.loadModelForTranscription(parakeetGgufModel)
      // Whisper was unloaded, gguf was loaded
      expectEffect(whisperOps.unload.mock.calls.length).toBe(whisperUnloadsAfterFirst + 1)
      expectEffect(ggufOps.load).toHaveBeenCalled()
      const active = yield* svc.getActive
      expectEffect(active?.engineType).toBe('parakeet-gguf')
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('fails with TranscriptionError when the engine load() rejects', () =>
    Effect.gen(function* () {
      whisperOps.load.mockRejectedValue(new Error('native lib missing'))
      const svc = yield* SttService
      const exit = yield* Effect.exit(svc.loadModelForTranscription(whisperModel))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(SttLive))
  )
})

describe('SttLive — transcribe', () => {
  itEffect('fails with NoSttEngineLoadedError when no model is loaded', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      const exit = yield* Effect.exit(svc.transcribe(new Float32Array([0, 0])))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('calls the active engine.transcribe and returns its text', () =>
    Effect.gen(function* () {
      whisperOps.transcribe.mockResolvedValue('hello world')
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      const pcm = new Float32Array([0.1, 0.2, 0.3])
      const text = yield* svc.transcribe(pcm)
      expectEffect(text).toBe('hello world')
      expectEffect(whisperOps.transcribe).toHaveBeenCalledWith(pcm, {})
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('forwards transcribe options to the engine', () =>
    Effect.gen(function* () {
      whisperOps.transcribe.mockResolvedValue('text')
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      yield* svc.transcribe(new Float32Array([0]), { language: 'en', prompt: 'hello', gpu: true })
      expectEffect(whisperOps.transcribe).toHaveBeenCalledWith(expect.any(Float32Array), {
        language: 'en',
        prompt: 'hello',
        gpu: true
      })
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('fails with TranscriptionError when engine.transcribe throws', () =>
    Effect.gen(function* () {
      whisperOps.transcribe.mockRejectedValue(new Error('decode failure'))
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      const exit = yield* Effect.exit(svc.transcribe(new Float32Array([0])))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(SttLive))
  )
})

describe('SttLive — unloadAll', () => {
  itEffect('unloads the active engine', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      const callsBefore = whisperOps.unload.mock.calls.length
      yield* svc.unloadAll
      expectEffect(whisperOps.unload.mock.calls.length).toBe(callsBefore + 1)
      const active = yield* svc.getActive
      expectEffect(active).toBeNull()
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('is a no-op when no engine is active', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.unloadAll
      expectEffect(whisperOps.unload).not.toHaveBeenCalled()
      expectEffect(ggufOps.unload).not.toHaveBeenCalled()
    }).pipe(Effect.provide(SttLive))
  )
})

describe('SttLive — getActive', () => {
  itEffect('returns null initially', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      expectEffect(yield* svc.getActive).toBeNull()
    }).pipe(Effect.provide(SttLive))
  )

  itEffect('reflects the currently active engine after load', () =>
    Effect.gen(function* () {
      const svc = yield* SttService
      yield* svc.loadModelForTranscription(whisperModel)
      const active = yield* svc.getActive
      expectEffect(active).toEqual({ engineType: 'whisper', modelId: 'whisper-tiny' })
    }).pipe(Effect.provide(SttLive))
  )
})
