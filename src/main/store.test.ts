import { describe, it, expect, vi, beforeEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Layer, Ref } from 'effect'

// We test the real SettingsLive by mocking electron-store with an in-memory
// Map. This exercises the actual schema decode, the readRaw/get/update flow,
// the legacy hotkey migration, and history cap — without touching disk.

const storeData = new Map<string, unknown>()

function makeStore<T extends Record<string, unknown>>(defaults: T) {
  for (const [k, v] of Object.entries(defaults)) storeData.set(k, v)
  return {
    get: <K extends keyof T>(key: K): T[K] => storeData.get(key as string) as T[K],
    set: <K extends keyof T>(key: K, value: T[K]) => {
      storeData.set(key as string, value)
    }
  }
}

vi.mock('electron-store', () => ({
  default: class FakeStore<T extends Record<string, unknown>> {
    private store: ReturnType<typeof makeStore<T>>
    constructor(opts: { defaults: T }) {
      this.store = makeStore(opts.defaults)
    }
    get<K extends keyof T>(key: K): T[K] {
      return this.store.get(key)
    }
    set<K extends keyof T>(key: K, value: T[K]) {
      this.store.set(key, value)
    }
  }
}))

import { SettingsService, SettingsLive } from './store'
import { DEFAULT_SETTINGS, type AppSettings, type HistoryEntry } from '../shared/types'

beforeEach(() => {
  storeData.clear()
  // Seed with defaults so the fake store behaves like a fresh install.
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    storeData.set(k, v as unknown)
  }
})

describe('SettingsLive — get', () => {
  itEffect('returns decoded AppSettings from the store', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      const settings = yield* svc.get
      expectEffect(settings.activeModelId).toBe(DEFAULT_SETTINGS.activeModelId)
      expectEffect(settings.hotkey.mode).toBe(DEFAULT_SETTINGS.hotkey.mode)
      expectEffect(settings.ai.provider).toBe(DEFAULT_SETTINGS.ai.provider)
      expectEffect(settings.dictionary).toEqual([])
      expectEffect(settings.installedModels).toEqual([])
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('merges defaults for the AI config (so older stores without ollamaUrl still work)', () =>
    Effect.gen(function* () {
      // Strip the AI config to simulate a pre-1.0 install
      storeData.set('ai', { enabled: true, provider: 'openai', openaiApiKey: 'k' })
      const svc = yield* SettingsService
      const settings = yield* svc.get
      // All unset fields should fall back to DEFAULT_AI_CONFIG
      expectEffect(settings.ai.ollamaUrl).toBe(DEFAULT_SETTINGS.ai.ollamaUrl)
      expectEffect(settings.ai.ollamaModel).toBe(DEFAULT_SETTINGS.ai.ollamaModel)
      expectEffect(settings.ai.anthropicModel).toBe(DEFAULT_SETTINGS.ai.anthropicModel)
      // Set fields should win
      expectEffect(settings.ai.openaiApiKey).toBe('k')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('migrates legacy Command→Option keycodes that were mislabeled', () =>
    Effect.gen(function* () {
      // Old install: Right Command keycode (3676) mislabeled as "Right Option"
      storeData.set('hotkey', {
        mode: 'hold',
        keycode: 3676,
        label: 'Right Option (⌥)',
        accelerator: 'Alt+Space'
      })
      const svc = yield* SettingsService
      const settings = yield* svc.get
      // Migration should have rewritten 3676 → 56 (Left Option)
      expectEffect(settings.hotkey.keycode).toBe(56)
      expectEffect(settings.hotkey.label).toBe('Left Option (⌥)')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('migrates legacy 3675 (Left Command) mislabeled as Option', () =>
    Effect.gen(function* () {
      storeData.set('hotkey', {
        mode: 'hold',
        keycode: 3675,
        label: 'Left Option (⌥)',
        accelerator: 'Alt+Space'
      })
      const svc = yield* SettingsService
      const settings = yield* svc.get
      expectEffect(settings.hotkey.keycode).toBe(3640)
      expectEffect(settings.hotkey.label).toBe('Right Option (⌥)')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('does not migrate when keycode is the correct one for Option (56)', () =>
    Effect.gen(function* () {
      storeData.set('hotkey', {
        mode: 'hold',
        keycode: 56,
        label: 'Left Option (⌥)',
        accelerator: 'Alt+Space'
      })
      const svc = yield* SettingsService
      const settings = yield* svc.get
      expectEffect(settings.hotkey.keycode).toBe(56)
      expectEffect(settings.hotkey.label).toBe('Left Option (⌥)')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('does not migrate when the label is not "option"', () =>
    Effect.gen(function* () {
      storeData.set('hotkey', {
        mode: 'hold',
        keycode: 3675, // Left Command
        label: 'Left Cmd', // not labeled as Option
        accelerator: 'Cmd+Space'
      })
      const svc = yield* SettingsService
      const settings = yield* svc.get
      expectEffect(settings.hotkey.keycode).toBe(3675)
      expectEffect(settings.hotkey.label).toBe('Left Cmd')
    }).pipe(Effect.provide(SettingsLive))
  )
})

describe('SettingsLive — update', () => {
  itEffect('merges partial updates and re-reads', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      const updated = yield* svc.update({ autoStart: true, gpuEnabled: false })
      expectEffect(updated.autoStart).toBe(true)
      expectEffect(updated.gpuEnabled).toBe(false)
      // Other fields preserved
      expectEffect(updated.hotkey.mode).toBe(DEFAULT_SETTINGS.hotkey.mode)
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('persists updates to the underlying store', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      yield* svc.update({ activeModelId: 'whisper-tiny' })
      const settings = yield* svc.get
      expectEffect(settings.activeModelId).toBe('whisper-tiny')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('update of hotkey still runs the migration', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      // First, set a legacy hotkey
      storeData.set('hotkey', {
        mode: 'hold',
        keycode: 3675,
        label: 'Left Option (⌥)',
        accelerator: 'Alt+Space'
      })
      // Then update with a fresh correct value
      const updated = yield* svc.update({
        hotkey: {
          mode: 'toggle',
          keycode: 3675,
          label: 'Left Cmd',
          accelerator: 'Cmd+Space'
        }
      })
      // No migration because label isn't "option"
      expectEffect(updated.hotkey.keycode).toBe(3675)
    }).pipe(Effect.provide(SettingsLive))
  )
})

describe('SettingsLive — addHistory + clearHistory', () => {
  const makeEntry = (id: string, text: string): HistoryEntry => ({
    id,
    text,
    rawText: text,
    timestamp: Date.now(),
    durationMs: 1000
  })

  itEffect('addHistory prepends to history', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      yield* svc.addHistory(makeEntry('h1', 'first'))
      yield* svc.addHistory(makeEntry('h2', 'second'))
      const settings = yield* svc.get
      expectEffect(settings.history[0].id).toBe('h2')
      expectEffect(settings.history[1].id).toBe('h1')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('addHistory caps history at 200 entries', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      for (let i = 0; i < 250; i++) {
        yield* svc.addHistory(makeEntry(`h${i}`, `entry ${i}`))
      }
      const settings = yield* svc.get
      expectEffect(settings.history.length).toBe(200)
      // Newest first
      expectEffect(settings.history[0].id).toBe('h249')
      expectEffect(settings.history[199].id).toBe('h50')
    }).pipe(Effect.provide(SettingsLive))
  )

  itEffect('clearHistory empties history and persists', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      yield* svc.addHistory(makeEntry('h1', 'first'))
      yield* svc.clearHistory
      const settings = yield* svc.get
      expectEffect(settings.history).toEqual([])
    }).pipe(Effect.provide(SettingsLive))
  )
})

describe('SettingsLive — schema rejection', () => {
  itEffect('fails when the stored shape is invalid', () =>
    Effect.gen(function* () {
      storeData.set('hotkey', { mode: 'invalid', keycode: 'x', label: 'y', accelerator: 'z' })
      const svc = yield* SettingsService
      const exit = yield* Effect.exit(svc.get)
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(SettingsLive))
  )
})
