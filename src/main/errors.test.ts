import { describe, it, expect } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Option, Schema, Cause } from 'effect'
import {
  NoActiveModelError,
  UnknownEngineError,
  NoSttEngineLoadedError,
  TranscriptionError,
  RecordingTooShortError,
  DownloadError,
  UnknownModelError,
  InjectionError,
  AiCleanupError,
  PermissionsError,
  HotkeyError
} from './errors'

describe('TaggedErrorClass — construction and _tag', () => {
  it('NoActiveModelError has _tag and message', () => {
    const e = new NoActiveModelError({ message: 'no model' })
    expect(e._tag).toBe('NoActiveModelError')
    expect(e.message).toBe('no model')
  })

  it('UnknownEngineError has _tag and engine', () => {
    const e = new UnknownEngineError({ engine: 'mystery' })
    expect(e._tag).toBe('UnknownEngineError')
    expect(e.engine).toBe('mystery')
  })

  it('NoSttEngineLoadedError has _tag and message', () => {
    const e = new NoSttEngineLoadedError({ message: 'not loaded' })
    expect(e._tag).toBe('NoSttEngineLoadedError')
    expect(e.message).toBe('not loaded')
  })

  it('TranscriptionError has _tag, message, and optional error', () => {
    const e1 = new TranscriptionError({ message: 'stt failed' })
    expect(e1._tag).toBe('TranscriptionError')
    expect(e1.message).toBe('stt failed')
    expect(e1.error).toBeUndefined()

    const cause = new Error('boom')
    const e2 = new TranscriptionError({ message: 'stt failed', error: cause })
    expect(e2.error).toBe(cause)
  })

  it('RecordingTooShortError has _tag and message', () => {
    const e = new RecordingTooShortError({ message: 'too short' })
    expect(e._tag).toBe('RecordingTooShortError')
    expect(e.message).toBe('too short')
  })

  it('DownloadError has _tag, modelId, message, and optional error', () => {
    const e = new DownloadError({ message: '404', modelId: 'whisper-base' })
    expect(e._tag).toBe('DownloadError')
    expect(e.message).toBe('404')
    expect(e.modelId).toBe('whisper-base')
    expect(e.error).toBeUndefined()
  })

  it('UnknownModelError has _tag and modelId', () => {
    const e = new UnknownModelError({ modelId: 'bogus' })
    expect(e._tag).toBe('UnknownModelError')
    expect(e.modelId).toBe('bogus')
  })

  it('InjectionError has _tag, message, and optional error', () => {
    const e = new InjectionError({ message: 'paste failed' })
    expect(e._tag).toBe('InjectionError')
    expect(e.message).toBe('paste failed')
    expect(e.error).toBeUndefined()
  })

  it('AiCleanupError has _tag, provider, and optional error', () => {
    const e = new AiCleanupError({ provider: 'ollama' })
    expect(e._tag).toBe('AiCleanupError')
    expect(e.provider).toBe('ollama')
    expect(e.error).toBeUndefined()
  })

  it('PermissionsError has _tag, message, and optional error', () => {
    const e = new PermissionsError({ message: 'denied' })
    expect(e._tag).toBe('PermissionsError')
    expect(e.message).toBe('denied')
    expect(e.error).toBeUndefined()
  })

  it('HotkeyError has _tag, message, and optional error', () => {
    const e = new HotkeyError({ message: 'hook failed' })
    expect(e._tag).toBe('HotkeyError')
    expect(e.message).toBe('hook failed')
    expect(e.error).toBeUndefined()
  })
})

describe('TaggedErrorClass — yieldable as Effect', () => {
  itEffect('TranscriptionError is recoverable via catchTag', () =>
    Effect.gen(function* () {
      const program = new TranscriptionError({ message: 'stt failed' }).pipe(
        Effect.catchTag('TranscriptionError', (e) => Effect.succeed(`caught: ${e.message}`))
      )
      const result = yield* program
      expectEffect(result).toBe('caught: stt failed')
    })
  )

  itEffect('catchTags handles multiple error types', () =>
    Effect.gen(function* () {
      // Cast the effect to a union of two error types so `catchTags` can
      // type-check both handlers. The runtime failure is `NoActiveModelError`.
      const program = (
        new NoActiveModelError({ message: 'none' }) as Effect.Effect<
          string,
          NoActiveModelError | InjectionError
        >
      ).pipe(
        Effect.catchTags({
          NoActiveModelError: (e) => Effect.succeed(`no-model: ${e.message}`),
          InjectionError: (e) => Effect.succeed(`inj: ${e.message}`)
        })
      )
      const result = yield* program
      expectEffect(result).toBe('no-model: none')
    })
  )

  itEffect('uncaught tagged error fails the effect with the right _tag', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.fail(new DownloadError({ message: '404', modelId: 'm1' }))
      )
      expectEffect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const maybeErr = Cause.findErrorOption(exit.cause)
        expectEffect(Option.isSome(maybeErr)).toBe(true)
        if (Option.isSome(maybeErr)) {
          expectEffect(maybeErr.value._tag).toBe('DownloadError')
          expectEffect(maybeErr.value.message).toBe('404')
          expectEffect(maybeErr.value.modelId).toBe('m1')
        }
      }
    })
  )
})

describe('TaggedErrorClass — Schema encode/decode round-trip', () => {
  itEffect('TranscriptionError round-trips with _tag preserved', () =>
    Effect.gen(function* () {
      const err = new TranscriptionError({ message: 'stt failed' })
      const encoded = Schema.encodeSync(TranscriptionError)(err)
      expectEffect(encoded._tag).toBe('TranscriptionError')
      expectEffect(encoded.message).toBe('stt failed')
      const decoded = yield* Schema.decodeUnknownEffect(TranscriptionError)(encoded)
      expectEffect(decoded.message).toBe('stt failed')
    })
  )

  itEffect('DownloadError round-trips modelId + message + _tag', () =>
    Effect.gen(function* () {
      const err = new DownloadError({ message: 'network down', modelId: 'whisper-base' })
      const encoded = Schema.encodeSync(DownloadError)(err)
      const decoded = yield* Schema.decodeUnknownEffect(DownloadError)(encoded)
      expectEffect(decoded._tag).toBe('DownloadError')
      expectEffect(decoded.message).toBe('network down')
      expectEffect(decoded.modelId).toBe('whisper-base')
    })
  )

  itEffect('AiCleanupError round-trips provider', () =>
    Effect.gen(function* () {
      const err = new AiCleanupError({ provider: 'anthropic' })
      const encoded = Schema.encodeSync(AiCleanupError)(err)
      const decoded = yield* Schema.decodeUnknownEffect(AiCleanupError)(encoded)
      expectEffect(decoded._tag).toBe('AiCleanupError')
      expectEffect(decoded.provider).toBe('anthropic')
    })
  )

  itEffect('rejects a payload with wrong _tag', () =>
    Effect.gen(function* () {
      const bad = { _tag: 'WrongTag', message: 'oops', modelId: 'x' }
      const exit = yield* Effect.exit(Schema.decodeUnknownEffect(DownloadError)(bad))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )

  itEffect('rejects a payload missing required fields', () =>
    Effect.gen(function* () {
      const bad = { _tag: 'DownloadError' } // missing message + modelId
      const exit = yield* Effect.exit(Schema.decodeUnknownEffect(DownloadError)(bad))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )
})

describe('TaggedErrorClass — instanceof Error', () => {
  it('each error is a real Error so try/catch and stack traces work', () => {
    const errors = [
      new NoActiveModelError({ message: 'x' }),
      new UnknownEngineError({ engine: 'x' }),
      new NoSttEngineLoadedError({ message: 'x' }),
      new TranscriptionError({ message: 'x' }),
      new RecordingTooShortError({ message: 'x' }),
      new DownloadError({ message: 'x', modelId: 'x' }),
      new UnknownModelError({ modelId: 'x' }),
      new InjectionError({ message: 'x' }),
      new AiCleanupError({ provider: 'x' }),
      new PermissionsError({ message: 'x' }),
      new HotkeyError({ message: 'x' })
    ]
    for (const e of errors) {
      expect(e).toBeInstanceOf(Error)
      expect(typeof e.stack).toBe('string')
    }
  })
})
