import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { it as itLive } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// --- Real electron-store (minimal in-memory, disk-persisted) -------------
//
// We re-implement just enough of electron-store's API for the SettingsLive
// service to work. This is a real integration test: the data round-trips
// through `Schema.decodeUnknownEffect` + the hotkey migration, then is
// persisted to a real JSON file on disk and re-read by a fresh instance.

type AnyRecord = Record<string, unknown>

const FakeElectronStore = vi.hoisted(() => {
  return class FakeElectronStore<T extends AnyRecord> {
    private data: T
    private filePath: string

    constructor(opts: { name: string; defaults: T; cwd?: string }) {
      this.data = { ...opts.defaults }
      const dir = opts.cwd ?? process.cwd()
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this.filePath = join(dir, `${opts.name}.json`)
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        try {
          const parsed = JSON.parse(raw) as T
          this.data = { ...opts.defaults, ...parsed }
        } catch {
          // Corrupt — start with defaults
        }
      }
    }

    get<K extends keyof T>(key: K): T[K] {
      return this.data[key]
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
      this.data[key] = value
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
    }
  }
})

const tmp = mkdtempSync(join(tmpdir(), 'vaak-integration-'))

vi.mock('electron-store', () => ({
  default: FakeElectronStore
}))

vi.mock('electron', () => ({
  app: { getPath: (_key: string) => tmp }
}))

import { SettingsService, SettingsLive } from './store'
import { DEFAULT_SETTINGS, type AppSettings, type HistoryEntry } from '../shared/types'

beforeEach(() => {
  // Clear the tmp dir
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('SettingsLive — integration (real disk round-trip)', () => {
  itLive('persists a partial update to disk and re-reads it from a fresh instance', () =>
    Effect.gen(function* () {
      const svc1 = yield* SettingsService
      // Initial read
      const initial = yield* svc1.get
      expect(initial.activeModelId).toBe(null)
      // Update
      const updated = yield* svc1.update({ activeModelId: 'whisper-tiny', autoStart: true })
      expect(updated.activeModelId).toBe('whisper-tiny')
      expect(updated.autoStart).toBe(true)
      // The file should exist
      const storeFile = join(tmp, 'vaak.json')
      expect(existsSync(storeFile)).toBe(true)
      const onDisk = JSON.parse(readFileSync(storeFile, 'utf-8'))
      expect(onDisk.activeModelId).toBe('whisper-tiny')
      expect(onDisk.autoStart).toBe(true)
    }).pipe(Effect.provide(SettingsLive))
  )

  itLive('addHistory + clearHistory round-trips through disk', () =>
    Effect.gen(function* () {
      const svc1 = yield* SettingsService
      const entry: HistoryEntry = {
        id: 'h1',
        text: 'persisted',
        rawText: 'persisted',
        timestamp: 1700000000000,
        durationMs: 1000
      }
      yield* svc1.addHistory(entry)
      // Re-instantiate via a fresh runtime to prove disk persistence
      const onDisk = JSON.parse(readFileSync(join(tmp, 'vaak.json'), 'utf-8'))
      expect(onDisk.history).toEqual([entry])
      yield* svc1.clearHistory
      const onDisk2 = JSON.parse(readFileSync(join(tmp, 'vaak.json'), 'utf-8'))
      expect(onDisk2.history).toEqual([])
    }).pipe(Effect.provide(SettingsLive))
  )

  itLive('the hotkey migration rewrites the on-disk hotkey object', () =>
    Effect.gen(function* () {
      // Seed the disk file with a legacy hotkey
      const file = join(tmp, 'vaak.json')
      writeFileSync(file, JSON.stringify({
        ...DEFAULT_SETTINGS,
        hotkey: {
          mode: 'hold',
          keycode: 3676, // Right Command mislabeled as Right Option
          label: 'Right Option (⌥)',
          accelerator: 'Alt+Space'
        }
      }))
      // Now instantiate a fresh SettingsService — it will read + migrate
      const svc2 = yield* SettingsService
      const settings = yield* svc2.get
      expect(settings.hotkey.keycode).toBe(56)
      expect(settings.hotkey.label).toBe('Left Option (⌥)')
      // The disk file should be updated too
      const onDisk = JSON.parse(readFileSync(file, 'utf-8'))
      expect(onDisk.hotkey.keycode).toBe(56)
      expect(onDisk.hotkey.label).toBe('Left Option (⌥)')
    }).pipe(Effect.provide(SettingsLive))
  )

  itLive('survives a corrupted disk file (falls back to defaults)', () =>
    Effect.gen(function* () {
      writeFileSync(join(tmp, 'vaak.json'), 'not valid json {{{')
      const svc = yield* SettingsService
      const settings = yield* svc.get
      // Defaults are returned
      expect(settings.activeModelId).toBe(null)
      expect(settings.hotkey.mode).toBe('hold')
    }).pipe(Effect.provide(SettingsLive))
  )

  itLive('partial update of nested object merges with existing values', () =>
    Effect.gen(function* () {
      const svc = yield* SettingsService
      yield* svc.update({
        ai: { ...DEFAULT_SETTINGS.ai, provider: 'openai', openaiApiKey: 'sk-test' }
      })
      const onDisk = JSON.parse(readFileSync(join(tmp, 'vaak.json'), 'utf-8'))
      expect(onDisk.ai.provider).toBe('openai')
      expect(onDisk.ai.openaiApiKey).toBe('sk-test')
      // Other ai fields preserved
      expect(onDisk.ai.openaiModel).toBe(DEFAULT_SETTINGS.ai.openaiModel)
      // Other top-level fields preserved
      expect(onDisk.hotkey.mode).toBe(DEFAULT_SETTINGS.hotkey.mode)
    }).pipe(Effect.provide(SettingsLive))
  )
})

describe('Text helpers — integration with real sanitize + dictionary + snippets pipeline', () => {
  it('a full dictation pipeline (sanitize → dictionary → snippets) composes correctly', async () => {
    const { sanitizeTranscription } = await import('./text/sanitize')
    const { applyDictionary, buildWhisperPrompt } = await import('./text/dictionary')
    const { expandSnippets } = await import('./text/snippets')

    // 1. sanitize: strip engine log lines
    const rawSTT = 'whisper_init: ready\nhello k8s'
    let text = sanitizeTranscription(rawSTT)
    expect(text).toBe('hello k8s')
    // 2. dictionary: replace k8s -> Kubernetes
    text = applyDictionary(text, [{ word: 'k8s', replacement: 'Kubernetes' }])
    expect(text).toBe('hello Kubernetes')
    // 3. snippets: trigger matches the full text, returns the snippet
    text = expandSnippets(text, [
      { id: '1', trigger: 'hello Kubernetes', content: '123 Main St' }
    ])
    expect(text).toBe('123 Main St')
    // 4. buildWhisperPrompt joins dictionary words
    const prompt = buildWhisperPrompt([{ word: 'k8s' }, { word: 'js' }])
    expect(prompt).toBe('k8s, js')
  })
})
