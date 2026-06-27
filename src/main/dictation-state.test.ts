import { it, expect } from '@effect/vitest'
import { Effect } from 'effect'
import { DictationStateLive, DictationStateService, type DictationPhase } from './dictation-state'

it.layer(DictationStateLive)('DictationStateService', (it) => {
  it.effect('starts in idle phase', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      const phase = yield* svc.getPhase
      expect(phase).toBe<DictationPhase>('idle')
    })
  )

  it.effect('canStartRecording is true initially', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      const can = yield* svc.canStartRecording
      expect(can).toBe(true)
    })
  )

  it.effect('markRecording transitions to recording', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      yield* svc.markRecording
      expect(yield* svc.getPhase).toBe('recording')
      expect(yield* svc.canStartRecording).toBe(false)
    })
  )

  it.effect('markProcessing transitions to processing', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      yield* svc.markProcessing
      expect(yield* svc.getPhase).toBe('processing')
      expect(yield* svc.canStartRecording).toBe(false)
    })
  )

  it.effect('markIdle transitions back to idle', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      yield* svc.markRecording
      yield* svc.markIdle
      expect(yield* svc.getPhase).toBe('idle')
      expect(yield* svc.canStartRecording).toBe(true)
    })
  )

  it.effect('full lifecycle: idle → recording → processing → idle', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      expect(yield* svc.getPhase).toBe('idle')
      yield* svc.markRecording
      expect(yield* svc.getPhase).toBe('recording')
      yield* svc.markProcessing
      expect(yield* svc.getPhase).toBe('processing')
      yield* svc.markIdle
      expect(yield* svc.getPhase).toBe('idle')
      expect(yield* svc.canStartRecording).toBe(true)
    })
  )

  it.effect('markRecording from processing skips to recording (last write wins)', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      yield* svc.markProcessing
      yield* svc.markRecording
      expect(yield* svc.getPhase).toBe('recording')
    })
  )

  it.effect('markIdle is idempotent', () =>
    Effect.gen(function* () {
      const svc = yield* DictationStateService
      yield* svc.markIdle
      yield* svc.markIdle
      expect(yield* svc.getPhase).toBe('idle')
    })
  )
})
