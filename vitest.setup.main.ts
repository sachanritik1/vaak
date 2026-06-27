import { vi, beforeEach } from 'vitest'
import { addEqualityTesters } from '@effect/vitest'

// Global electron mock so any module that imports `electron` (e.g. for
// `app.getPath`, `globalShortcut`, `clipboard`, `systemPreferences`,
// `BrowserWindow.getAllWindows`) gets safe no-op stubs. Individual tests
// may override the mock with `vi.mocked(...)` or per-file `vi.mock`.
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/vaak') },
  globalShortcut: {
    register: vi.fn(() => true),
    unregister: vi.fn(),
    unregisterAll: vi.fn()
  },
  systemPreferences: {
    askForMediaAccess: vi.fn(),
    getMediaAccessStatus: vi.fn(() => 'granted'),
    isTrustedAccessibilityClient: vi.fn(() => true)
  },
  clipboard: {
    readText: vi.fn(() => ''),
    readHTML: vi.fn(() => ''),
    writeText: vi.fn(),
    write: vi.fn(),
    clear: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    fromWebContents: vi.fn(() => null)
  },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }))
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

vi.mock('uiohook-napi', () => ({
  uIOhook: {
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }
}))

// Native STT engines: each adapter module imports the native package at
// module top level. We replace the factories with safe stubs so the modules
// can load in tests.
vi.mock('smart-whisper', () => ({ default: class FakeWhisper {} }))
vi.mock('smart-whisper-engine', () => ({
  getSttEngine: () => ({
    load: () => Promise.resolve(),
    transcribe: () => Promise.resolve(''),
    unload: () => Promise.resolve()
  })
}))
vi.mock('parakeet-coreml', () => ({
  ParakeetAsrEngine: class FakeParakeetCoreml {},
  isAvailable: () => false,
  getDefaultModelDir: () => '/tmp/parakeet'
}))

vi.mock('electron-store', () => ({
  default: class FakeStore {
    private data = new Map<string, unknown>()
    constructor(opts: { defaults?: Record<string, unknown> } = {}) {
      if (opts.defaults) {
        for (const [k, v] of Object.entries(opts.defaults)) this.data.set(k, v)
      }
    }
    get(key: string): unknown {
      return this.data.get(key)
    }
    set(key: string, value: unknown): void {
      this.data.set(key, value)
    }
  }
}))

addEqualityTesters()

beforeEach(() => {
  // Reset all electron mocks between tests so per-test overrides don't leak
  vi.mocked(vi.fn()).mockReset?.()
})
