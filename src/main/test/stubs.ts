import { Effect, Layer, Ref } from 'effect'
import { SettingsService, type SettingsService as SettingsServiceI } from '../store'
import type { AppSettings, HistoryEntry } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

/**
 * In-memory `SettingsService` for tests. Backed by a `Ref<AppSettings>` so
 * reads see the latest writes. History is held in a separate ref so we can
 * assert on it directly. Inspect the history via `getSettingsHistory(ref)`.
 */
export type SettingsStubHandle = {
  readonly settingsRef: Ref.Ref<AppSettings>
  readonly historyRef: Ref.Ref<HistoryEntry[]>
}

export const makeSettingsStub = (initial: AppSettings = DEFAULT_SETTINGS) =>
  Layer.effect(SettingsService, Effect.gen(function* () {
    const ref = yield* Ref.make(initial)
    const historyRef = yield* Ref.make<HistoryEntry[]>(initial.history)

    return {
      get: Ref.get(ref),
      update: (partial: Partial<AppSettings>) =>
        Ref.update(ref, (s) => ({ ...s, ...partial })).pipe(Effect.flatMap(() => Ref.get(ref))),
      addHistory: (entry: HistoryEntry) =>
        Ref.update(historyRef, (h) => [entry, ...h].slice(0, 200)),
      clearHistory: Ref.set(historyRef, [])
    } satisfies SettingsServiceI
  }))
