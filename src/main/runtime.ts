import { Effect, ManagedRuntime } from 'effect'
import type { Layer } from 'effect'

/**
 * A single ManagedRuntime is built once in `app.whenReady` from the
 * composed `AppLayer`. The imperative boundaries (IPC handlers in
 * `ipc.ts`, uiohook/globalShortcut callbacks in `hotkey/manager.ts`,
 * and app lifecycle in `index.ts`) call `runMain`/`runPromiseExit` to
 * execute effects.
 */

let runtime: ManagedRuntime.ManagedRuntime<unknown, unknown> | null = null

export function initRuntime<R, E>(layer: Layer.Layer<R, E>): ManagedRuntime.ManagedRuntime<R, E> {
  if (runtime) return runtime as unknown as ManagedRuntime.ManagedRuntime<R, E>
  const rt = ManagedRuntime.make(layer)
  runtime = rt as unknown as ManagedRuntime.ManagedRuntime<unknown, unknown>
  return rt
}

export function getRuntime<R, E>(): ManagedRuntime.ManagedRuntime<R, E> {
  if (!runtime) {
    throw new Error('[vaak] Effect runtime accessed before initRuntime()')
  }
  return runtime as unknown as ManagedRuntime.ManagedRuntime<R, E>
}

/** Run an Effect, returning a Promise that rejects on failure. */
export function runMain<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return getRuntime<unknown, unknown>().runPromise(effect as unknown as Effect.Effect<A, unknown, unknown>) as Promise<A>
}

/** Run an Effect, resolving with an Exit (never rejects). */
export function runPromiseExit<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return getRuntime<unknown, unknown>().runPromiseExit(effect as unknown as Effect.Effect<A, unknown, unknown>)
}

/** Dispose the runtime (app shutdown). */
export function disposeRuntime(): Promise<void> {
  const rt = runtime
  runtime = null
  return rt ? (rt.dispose as unknown as Promise<void>) : Promise.resolve()
}
