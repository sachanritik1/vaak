import { describe, it, expect, beforeEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Context, Effect, Layer } from 'effect'

import {
  initRuntime,
  getRuntime,
  runMain,
  runPromiseExit,
  disposeRuntime
} from './runtime'

interface Counter {
  readonly value: number
}

const CounterService = Context.Service<Counter>('@test/Counter')

const makeCounterLayer = (value: number) =>
  Layer.succeed(CounterService, { value })

beforeEach(async () => {
  await disposeRuntime()
})

describe('runtime — initRuntime / getRuntime', () => {
  it('getRuntime throws before initRuntime', () => {
    expect(() => getRuntime()).toThrow()
  })

  it('initRuntime builds and getRuntime returns the same instance', () => {
    const rt = initRuntime(makeCounterLayer(1))
    expect(rt).toBeDefined()
    expect(getRuntime()).toBe(rt)
  })

  it('initRuntime is idempotent — second call returns the cached runtime', () => {
    const a = initRuntime(makeCounterLayer(1))
    const b = initRuntime(makeCounterLayer(2))
    expect(a).toBe(b)
  })

  itEffect('initRuntime + runMain runs an effect that yields a service', () =>
    Effect.gen(function* () {
      initRuntime(makeCounterLayer(7))
      const v = yield* CounterService
      expectEffect(v.value).toBe(7)
    })
  )
})

describe('runtime — runMain / runPromiseExit', () => {
  itEffect('runMain resolves with the effect success value', () =>
    Effect.gen(function* () {
      initRuntime(makeCounterLayer(1))
      const out = yield* Effect.promise(() => runMain(Effect.succeed('hello')))
      expectEffect(out).toBe('hello')
    })
  )

  it('runMain rejects on effect failure', async () => {
    initRuntime(makeCounterLayer(1))
    await expect(runMain(Effect.fail('boom'))).rejects.toBeDefined()
  })

  it('runPromiseExit returns Exit.Success on success', async () => {
    initRuntime(makeCounterLayer(1))
    const exit = await runPromiseExit(Effect.succeed(123))
    expect(exit._tag).toBe('Success')
    if (exit._tag === 'Success') expect(exit.value).toBe(123)
  })

  it('runPromiseExit returns Exit.Failure on failure (does not reject)', async () => {
    initRuntime(makeCounterLayer(1))
    const exit = await runPromiseExit(Effect.fail('nope'))
    expect(exit._tag).toBe('Failure')
  })
})

describe('runtime — disposeRuntime', () => {
  it('disposeRuntime nulls the runtime so getRuntime throws', async () => {
    initRuntime(makeCounterLayer(1))
    expect(() => getRuntime()).not.toThrow()
    await disposeRuntime()
    expect(() => getRuntime()).toThrow()
  })

  it('disposeRuntime is safe to call when no runtime is initialized', async () => {
    await expect(disposeRuntime()).resolves.toBeUndefined()
  })

  it('after dispose, initRuntime can build a fresh runtime', async () => {
    const a = initRuntime(makeCounterLayer(1))
    await disposeRuntime()
    const b = initRuntime(makeCounterLayer(1))
    expect(b).not.toBe(a)
  })
})
