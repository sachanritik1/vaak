import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Layer } from 'effect'

// --- Module mocks --------------------------------------------------------

const electronApp = vi.hoisted(() => ({
  getPath: vi.fn(() => '/tmp/vaak-models')
}))
vi.mock('electron', () => ({ app: electronApp }))

const downloadParakeetCoremlModels = vi.hoisted(() => vi.fn())
const isParakeetCoremlSupported = vi.hoisted(() => vi.fn(() => false))
vi.mock('../stt/parakeet-coreml-engine', () => ({
  downloadParakeetCoremlModels,
  isParakeetCoremlSupported
}))

const ensureParakeetCli = vi.hoisted(() => vi.fn())
vi.mock('../stt/parakeet-cli-binary', () => ({ ensureParakeetCli }))

const ensureSherpaOffline = vi.hoisted(() => vi.fn())
vi.mock('../stt/sherpa-binary', () => ({ ensureSherpaOffline }))

const writeSherpaManifest = vi.hoisted(() => vi.fn())
vi.mock('../stt/sherpa-manifest', () => ({ writeSherpaManifest }))

const fsState = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  dirs: new Set<string>(['/tmp/vaak-models']),
  nextStat: new Map<string, { isDirectory: () => boolean; size: number }>()
}))

const existsSync = vi.hoisted(() =>
  vi.fn((p: string) => fsState.files.has(p) || fsState.dirs.has(p))
)
const mkdirSync = vi.hoisted(() =>
  vi.fn((p: string) => {
    fsState.dirs.add(p)
  })
)
const statSync = vi.hoisted(() =>
  vi.fn((p: string) => {
    const s = fsState.nextStat.get(p)
    if (s) return s
    if (fsState.dirs.has(p)) return { isDirectory: () => true, size: 0 }
    if (fsState.files.has(p)) return { isDirectory: () => false, size: fsState.files.get(p)!.length }
    throw new Error(`ENOENT: ${p}`)
  })
)
const unlinkSync = vi.hoisted(() =>
  vi.fn((p: string) => {
    if (!fsState.files.has(p)) throw new Error(`ENOENT: ${p}`)
    fsState.files.delete(p)
  })
)
const rmSync = vi.hoisted(() =>
  vi.fn((p: string) => {
    fsState.files.delete(p)
    fsState.dirs.delete(p)
  })
)
const createWriteStream = vi.hoisted(() =>
  vi.fn((p: string) => {
    const chunks: Buffer[] = []
    const ws = {
      write: vi.fn((chunk: Buffer) => {
        chunks.push(Buffer.from(chunk))
        return true
      }),
      end: vi.fn((cb?: () => void) => {
        fsState.files.set(p, Buffer.concat(chunks))
        cb?.()
        return ws
      })
    }
    return ws
  })
)

vi.mock('node:fs', () => ({
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  unlinkSync
}))

// --- Test setup ----------------------------------------------------------

import { ModelsService, ModelsLive } from './manager'
import { SettingsService } from '../store'
import { makeSettingsStub } from '../test/stubs'
import { DEFAULT_SETTINGS, type AppSettings, type DownloadProgress } from '../../shared/types'

const fetchQueue: Array<{ ok: boolean; status?: number; body: Buffer; contentLength?: number }> = []
let fetchNextIndex = 0

const fetchMock = vi.hoisted(() =>
  vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = fetchQueue[fetchNextIndex++]
    if (!next) throw new Error('No more fetch responses queued')
    const headers = new Map<string, string>()
    if (next.contentLength !== undefined) headers.set('content-length', String(next.contentLength))
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 500),
      statusText: next.ok ? 'OK' : 'Error',
      headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
      body: makeReadableStream(next.body)
    } as unknown as Response
  })
)

function makeReadableStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf))
      controller.close()
    }
  })
}

vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  electronApp.getPath.mockReturnValue('/tmp/vaak-models')
  fetchMock.mockClear()
  fetchQueue.length = 0
  fetchNextIndex = 0
  fsState.files.clear()
  fsState.dirs.clear()
  fsState.dirs.add('/tmp/vaak-models')
  fsState.nextStat.clear()
  isParakeetCoremlSupported.mockReturnValue(false)
  downloadParakeetCoremlModels.mockReset()
  ensureParakeetCli.mockReset().mockResolvedValue(undefined)
  ensureSherpaOffline.mockReset().mockResolvedValue(undefined)
  writeSherpaManifest.mockReset()
  existsSync.mockClear()
  mkdirSync.mockClear()
  statSync.mockClear()
  unlinkSync.mockClear()
  rmSync.mockClear()
  createWriteStream.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const withSettings = (initial?: AppSettings) =>
  ModelsLive.pipe(Layer.provide(makeSettingsStub(initial)))

const whisperInstalled: InstalledModelSeed[] = [
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    filename: 'ggml-tiny.bin',
    path: '/models/ggml-tiny.bin',
    sizeBytes: 75_000_000,
    language: 'multilingual',
    source: 'catalog',
    engine: 'whisper'
  }
]

type InstalledModelSeed = {
  id: string
  name: string
  filename: string
  path: string
  sizeBytes: number
  language: string
  source: 'catalog' | 'custom'
  engine: 'whisper' | 'parakeet-coreml' | 'parakeet-gguf' | 'sherpa-onnx'
}

const settingsWith = (installed: InstalledModelSeed[], activeModelId: string | null = null): AppSettings => ({
  ...DEFAULT_SETTINGS,
  activeModelId,
  installedModels: installed
})

import type { InstalledModel as _IM } from '../../shared/types'
type InstalledModel = _IM

// --- getInstalled --------------------------------------------------------

describe('ModelsLive — getInstalled', () => {
  itEffect('returns an empty list when settings has no installed models', () =>
    Effect.gen(function* () {
      const models = yield* ModelsService
      const installed = yield* models.getInstalled
      expectEffect(installed).toEqual([])
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('returns the installed models list, defaulting engine to "whisper"', () => {
    const initial = settingsWith(whisperInstalled)
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const installed = yield* models.getInstalled
      expectEffect(installed.length).toBe(1)
      expectEffect(installed[0].engine).toBe('whisper')
    }).pipe(Effect.provide(withSettings(initial)))
  })
})

// --- getActive -----------------------------------------------------------

describe('ModelsLive — getActive', () => {
  itEffect('returns null when activeModelId is null', () =>
    Effect.gen(function* () {
      const models = yield* ModelsService
      expectEffect(yield* models.getActive).toBeNull()
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('returns the active installed model when set', () => {
    const initial = settingsWith(whisperInstalled, 'whisper-tiny')
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const active = yield* models.getActive
      expectEffect(active?.id).toBe('whisper-tiny')
      expectEffect(active?.engine).toBe('whisper')
    }).pipe(Effect.provide(withSettings(initial)))
  })

  itEffect('returns null when activeModelId points to a missing model', () => {
    const initial = settingsWith([], 'does-not-exist')
    return Effect.gen(function* () {
      const models = yield* ModelsService
      expectEffect(yield* models.getActive).toBeNull()
    }).pipe(Effect.provide(withSettings(initial)))
  })
})

// --- setActive -----------------------------------------------------------

describe('ModelsLive — setActive', () => {
  itEffect('persists the new activeModelId', () =>
    Effect.gen(function* () {
      const models = yield* ModelsService
      const settings = yield* SettingsService
      yield* models.setActive('whisper-base')
      const after = yield* settings.get
      expectEffect(after.activeModelId).toBe('whisper-base')
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('clears the active model when passed null', () =>
    Effect.gen(function* () {
      const models = yield* ModelsService
      const settings = yield* SettingsService
      yield* models.setActive('x')
      yield* models.setActive(null)
      const after = yield* settings.get
      expectEffect(after.activeModelId).toBeNull()
    }).pipe(Effect.provide(withSettings()))
  )
})

// --- deleteModel ---------------------------------------------------------

describe('ModelsLive — deleteModel', () => {
  itEffect('removes the model from the installed list and unlinks the file', () => {
    const path = '/tmp/vaak-models/ggml-tiny.bin'
    fsState.files.set(path, Buffer.from('model-data'))
    const initial = settingsWith([
      { ...whisperInstalled[0], path }
    ])
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const settings = yield* SettingsService
      yield* models.deleteModel('whisper-tiny')
      const after = yield* settings.get
      expectEffect(after.installedModels).toEqual([])
      expectEffect(fsState.files.has(path)).toBe(false)
    }).pipe(Effect.provide(withSettings(initial)))
  })

  itEffect('does NOT remove files for parakeet-coreml models (native owns the dir)', () => {
    const path = '/tmp/vaak-models/coreml-bundle'
    fsState.dirs.add(path)
    const initial = settingsWith([
      {
        id: 'parakeet-tdt-v3-coreml',
        name: 'Parakeet',
        filename: 'coreml-bundle',
        path,
        sizeBytes: 1_500_000_000,
        language: 'multilingual',
        source: 'catalog',
        engine: 'parakeet-coreml'
      }
    ])
    return Effect.gen(function* () {
      const models = yield* ModelsService
      yield* models.deleteModel('parakeet-tdt-v3-coreml')
      expectEffect(fsState.dirs.has(path)).toBe(true)
    }).pipe(Effect.provide(withSettings(initial)))
  })

  itEffect('clears activeModelId if the deleted model was active', () => {
    const path = '/tmp/vaak-models/ggml-tiny.bin'
    fsState.files.set(path, Buffer.from('x'))
    const initial = settingsWith(
      [{ ...whisperInstalled[0], path }],
      'whisper-tiny'
    )
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const settings = yield* SettingsService
      yield* models.deleteModel('whisper-tiny')
      const after = yield* settings.get
      expectEffect(after.activeModelId).toBeNull()
    }).pipe(Effect.provide(withSettings(initial)))
  })

  itEffect('leaves activeModelId alone when deleting a non-active model', () => {
    const pathA = '/tmp/vaak-models/ggml-tiny.bin'
    const pathB = '/tmp/vaak-models/ggml-base.bin'
    fsState.files.set(pathA, Buffer.from('a'))
    fsState.files.set(pathB, Buffer.from('b'))
    const initial = settingsWith(
      [
        { ...whisperInstalled[0], path: pathA },
        {
          id: 'whisper-base',
          name: 'Whisper Base',
          filename: 'ggml-base.bin',
          path: pathB,
          sizeBytes: 1,
          language: 'multilingual',
          source: 'catalog',
          engine: 'whisper'
        }
      ],
      'whisper-tiny'
    )
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const settings = yield* SettingsService
      yield* models.deleteModel('whisper-base')
      const after = yield* settings.get
      expectEffect(after.activeModelId).toBe('whisper-tiny')
    }).pipe(Effect.provide(withSettings(initial)))
  })

  itEffect('silently ignores deleting a non-existent model', () =>
    Effect.gen(function* () {
      const models = yield* ModelsService
      const settings = yield* SettingsService
      yield* models.deleteModel('does-not-exist')
      const after = yield* settings.get
      expectEffect(after.installedModels).toEqual([])
    }).pipe(Effect.provide(withSettings()))
  )
})

// --- downloadCatalog: whisper --------------------------------------------

describe('ModelsLive — downloadCatalog (whisper)', () => {
  itEffect('downloads the model file, registers it, and emits progress', () =>
    Effect.gen(function* () {
      const data = Buffer.from('fake-model-bytes')
      fetchQueue.push({ ok: true, body: data, contentLength: data.length })
      const progress: DownloadProgress[] = []
      const models = yield* ModelsService
      const settings = yield* SettingsService
      const installed = yield* models.downloadCatalog('tiny', (p) => progress.push(p))
      expectEffect(installed.id).toBe('tiny')
      expectEffect(installed.engine).toBe('whisper')
      const after = yield* settings.get
      expectEffect(after.installedModels.some((m) => m.id === 'tiny')).toBe(true)
      expectEffect(progress.length).toBeGreaterThan(0)
      expectEffect(progress[progress.length - 1].modelId).toBe('tiny')
      expectEffect(fsState.files.has('/tmp/vaak-models/ggml-tiny.bin')).toBe(true)
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('fails with UnknownModelError for an unknown catalog id', () =>
    Effect.gen(function* () {
      const models = yield* ModelsService
      const exit = yield* Effect.exit(models.downloadCatalog('does-not-exist', () => {}))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('returns the existing record (no re-download) when already installed', () => {
    const path = '/tmp/vaak-models/ggml-tiny.bin'
    const initial = settingsWith([
      { ...whisperInstalled[0], path, id: 'tiny', name: 'tiny' }
    ])
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const result = yield* models.downloadCatalog('tiny', () => {})
      expectEffect(result.id).toBe('tiny')
      expectEffect(fetchNextIndex).toBe(0)
    }).pipe(Effect.provide(withSettings(initial)))
  })

  itEffect('fails with DownloadError when the HTTP response is not OK', () =>
    Effect.gen(function* () {
      fetchQueue.push({ ok: false, status: 404, body: Buffer.from('') })
      const models = yield* ModelsService
      const exit = yield* Effect.exit(models.downloadCatalog('tiny', () => {}))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('skips download if the destination file already exists', () => {
    const path = '/tmp/vaak-models/ggml-tiny.bin'
    fsState.files.set(path, Buffer.from('pre-existing'))
    return Effect.gen(function* () {
      const models = yield* ModelsService
      const result = yield* models.downloadCatalog('tiny', () => {})
      expectEffect(result.path).toBe(path)
      expectEffect(fetchNextIndex).toBe(0)
      expectEffect(fsState.files.get(path)?.toString()).toBe('pre-existing')
    }).pipe(Effect.provide(withSettings()))
  })
})

// --- downloadCatalog: parakeet-gguf --------------------------------------

describe('ModelsLive — downloadCatalog (parakeet-gguf)', () => {
  itEffect('calls ensureParakeetCli then downloads the gguf file', () =>
    Effect.gen(function* () {
      const data = Buffer.from('gguf-bytes')
      fetchQueue.push({ ok: true, body: data, contentLength: data.length })
      const models = yield* ModelsService
      const result = yield* models.downloadCatalog('parakeet-tdt-v3-q5', () => {})
      expectEffect(ensureParakeetCli).toHaveBeenCalled()
      expectEffect(result.id).toBe('parakeet-tdt-v3-q5')
      expectEffect(result.engine).toBe('parakeet-gguf')
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('fails with DownloadError when ensureParakeetCli throws', () =>
    Effect.gen(function* () {
      ensureParakeetCli.mockRejectedValue(new Error('cli download failed'))
      const models = yield* ModelsService
      const exit = yield* Effect.exit(models.downloadCatalog('parakeet-tdt-v3-q5', () => {}))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(withSettings()))
  )
})

// --- downloadCatalog: sherpa-onnx ----------------------------------------

describe('ModelsLive — downloadCatalog (sherpa-onnx)', () => {
  itEffect('downloads each file, writes the manifest, and registers the model', () =>
    Effect.gen(function* () {
      fetchQueue.push({ ok: true, body: Buffer.from('p.onnx'), contentLength: 7 })
      fetchQueue.push({ ok: true, body: Buffer.from('t.txt'), contentLength: 5 })
      const models = yield* ModelsService
      const result = yield* models.downloadCatalog('moonshine-tiny-en', () => {})
      expectEffect(ensureSherpaOffline).toHaveBeenCalled()
      expectEffect(writeSherpaManifest).toHaveBeenCalled()
      expectEffect(result.engine).toBe('sherpa-onnx')
      expectEffect(fsState.dirs.has('/tmp/vaak-models/moonshine-tiny-en')).toBe(true)
    }).pipe(Effect.provide(withSettings()))
  )
})

// --- downloadCatalog: parakeet-coreml ------------------------------------

describe('ModelsLive — downloadCatalog (parakeet-coreml)', () => {
  itEffect("uses the native module's auto-download when supported", () =>
    Effect.gen(function* () {
      isParakeetCoremlSupported.mockReturnValue(true)
      downloadParakeetCoremlModels.mockImplementation(async (onProgress) => {
        onProgress?.(10)
        onProgress?.(50)
        onProgress?.(100)
        return '/Users/me/Library/Application Support/parakeet'
      })
      const progress: DownloadProgress[] = []
      const models = yield* ModelsService
      const result = yield* models.downloadCatalog('parakeet-tdt-v3-coreml', (p) => progress.push(p))
      expectEffect(result.engine).toBe('parakeet-coreml')
      expectEffect(result.path).toBe('/Users/me/Library/Application Support/parakeet')
      expectEffect(progress.map((p) => p.percent)).toEqual([10, 50, 100])
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('fails with DownloadError when CoreML is not supported on this platform', () =>
    Effect.gen(function* () {
      isParakeetCoremlSupported.mockReturnValue(false)
      const models = yield* ModelsService
      const exit = yield* Effect.exit(models.downloadCatalog('parakeet-tdt-v3-coreml', () => {}))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(withSettings()))
  )
})

// --- downloadCustom ------------------------------------------------------

describe('ModelsLive — downloadCustom', () => {
  itEffect('derives a custom id from a sha256 hash of the URL', () =>
    Effect.gen(function* () {
      fetchQueue.push({ ok: true, body: Buffer.from('custom'), contentLength: 6 })
      const models = yield* ModelsService
      const result = yield* models.downloadCustom('https://example.com/my-model.gguf', 'My Model', () => {})
      expectEffect(result.id).toMatch(/^custom-[a-f0-9]{12}$/)
      expectEffect(result.engine).toBe('parakeet-gguf')
      expectEffect(result.source).toBe('custom')
      expectEffect(result.name).toBe('My Model')
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('falls back to filename for the display name when no name is given', () =>
    Effect.gen(function* () {
      fetchQueue.push({ ok: true, body: Buffer.from('x'), contentLength: 1 })
      const models = yield* ModelsService
      const result = yield* models.downloadCustom('https://example.com/foo.gguf', undefined, () => {})
      expectEffect(result.name).toBe('foo.gguf')
    }).pipe(Effect.provide(withSettings()))
  )

  itEffect('infers whisper engine for non-gguf/onnx filenames', () =>
    Effect.gen(function* () {
      fetchQueue.push({ ok: true, body: Buffer.from('x'), contentLength: 1 })
      const models = yield* ModelsService
      const result = yield* models.downloadCustom('https://example.com/foo.bin', undefined, () => {})
      expectEffect(result.engine).toBe('whisper')
    }).pipe(Effect.provide(withSettings()))
  )
})
