import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Fiber } from 'effect'
import { TestClock } from 'effect/testing'

// --- Module mocks --------------------------------------------------------

const readText = vi.hoisted(() => vi.fn(() => ''))
const readHTML = vi.hoisted(() => vi.fn(() => ''))
const writeText = vi.hoisted(() => vi.fn())
const write = vi.hoisted(() => vi.fn())
const clear = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  clipboard: { readText, readHTML, writeText, write, clear }
}))

const handlers: Array<(err: Error | null, stdout: string) => void> = []
const execFileFn = vi.hoisted(() =>
  vi.fn(
    (
      _file: string,
      _args: string[],
      cb?: (err: Error | null, stdout: string) => void
    ) => {
      if (cb) handlers.push(cb)
    }
  )
)
vi.mock('node:child_process', () => ({ execFile: execFileFn }))

// --- Test helpers --------------------------------------------------------

import { InjectionService, InjectionLive } from './macos'

beforeEach(() => {
  readText.mockReset().mockReturnValue('')
  readHTML.mockReset().mockReturnValue('')
  writeText.mockReset()
  write.mockReset()
  clear.mockReset()
  execFileFn.mockReset()
  handlers.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

function flushOsascript(stdout: string) {
  while (handlers.length > 0) {
    const cb = handlers.shift()!
    cb(null, stdout)
  }
}

function failOsascript(err: Error) {
  while (handlers.length > 0) {
    const cb = handlers.shift()!
    cb(err, '')
  }
}

describe('InjectionLive — capturePasteTarget', () => {
  itEffect('captures a non-Vaak frontmost app as the paste target', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        const svc = yield* InjectionService
        yield* svc.capturePasteTarget
      }).pipe(Effect.forkChild)

      yield* Effect.yieldNow
      flushOsascript('Safari')
      yield* Fiber.join(fiber)
      // Capture should have made exactly one osascript call
      expectEffect(execFileFn).toHaveBeenCalledTimes(1)
    }).pipe(Effect.provide(InjectionLive))
  )

  itEffect('skips Vaak/Electron and does not overwrite the previous paste target', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        const svc = yield* InjectionService
        yield* svc.capturePasteTarget
        yield* svc.capturePasteTarget
      }).pipe(Effect.forkChild)

      yield* Effect.yieldNow
      flushOsascript('Safari')
      yield* Effect.yieldNow
      flushOsascript('Vaak')
      yield* Fiber.join(fiber)
      expectEffect(execFileFn).toHaveBeenCalledTimes(2)
    }).pipe(Effect.provide(InjectionLive))
  )

  itEffect('tolerates osascript failure (no paste target, no throw)', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        const svc = yield* InjectionService
        yield* svc.capturePasteTarget
      }).pipe(Effect.forkChild)

      yield* Effect.yieldNow
      failOsascript(new Error('osascript failed'))
      yield* Fiber.join(fiber)
      // No throw, no paste target
    }).pipe(Effect.provide(InjectionLive))
  )
})

describe('InjectionLive — clearPasteTarget', () => {
  itEffect('does not invoke osascript', () =>
    Effect.gen(function* () {
      const svc = yield* InjectionService
      yield* svc.clearPasteTarget
      expectEffect(execFileFn).not.toHaveBeenCalled()
    }).pipe(Effect.provide(InjectionLive))
  )
})

describe('InjectionLive — injectText', () => {
  itEffect('no-op on empty/whitespace text', () =>
    Effect.gen(function* () {
      const svc = yield* InjectionService
      yield* svc.injectText('')
      yield* svc.injectText('   ')
      expectEffect(writeText).not.toHaveBeenCalled()
      expectEffect(execFileFn).not.toHaveBeenCalled()
    }).pipe(Effect.provide(InjectionLive))
  )

  itEffect('writes the new text to the clipboard', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        const svc = yield* InjectionService
        yield* svc.capturePasteTarget
        yield* svc.injectText('hello world')
      }).pipe(Effect.forkChild)

      // 1st osascript: capture → "Safari"
      yield* Effect.yieldNow
      flushOsascript('Safari')
      // 2nd osascript: activate target (Safari) — succeeds
      yield* Effect.yieldNow
      flushOsascript('')
      // Advance past the 120ms sleep
      yield* TestClock.adjust('200 millis')
      // 3rd osascript: paste
      yield* Effect.yieldNow
      flushOsascript('')
      yield* Fiber.join(fiber)

      expectEffect(writeText).toHaveBeenCalledWith('hello world')
    }).pipe(Effect.provide(InjectionLive))
  )
})

describe('InjectionLive — testInjection', () => {
  itEffect('returns false when capture fails (caught internally)', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        const svc = yield* InjectionService
        return yield* svc.testInjection
      }).pipe(Effect.forkChild)

      yield* Effect.yieldNow
      failOsascript(new Error('no frontmost'))
      const result = yield* Fiber.join(fiber)
      expectEffect(result).toBe(false)
    }).pipe(Effect.provide(InjectionLive))
  )
})
