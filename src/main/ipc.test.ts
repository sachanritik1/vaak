import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Layer, Exit } from 'effect'

// Capture every ipcMain.handle() registration so we can dispatch handlers
// directly and assert on the result.
const registered = new Map<string, (...args: any[]) => any>()

const handle = vi.hoisted(() =>
  vi.fn((channel: string, handler: (...args: any[]) => any) => {
    registered.set(channel, handler)
  })
)

// Override the global electron mock from vitest.setup.main.ts to provide
// our capturing ipcMain.handle.
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/vaak-ipc' },
  globalShortcut: { register: () => true, unregister: () => {}, unregisterAll: () => {} },
  systemPreferences: {
    askForMediaAccess: () => {},
    getMediaAccessStatus: () => 'granted',
    isTrustedAccessibilityClient: () => true
  },
  clipboard: { readText: () => '', readHTML: () => '', writeText: () => {}, write: () => {}, clear: () => {} },
  BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null },
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  ipcMain: { handle, on: () => {} }
}))

import { registerIpcHandlers, ensureDictationIdle } from './ipc'
import { initRuntime, disposeRuntime } from './runtime'
import { IPC } from '../shared/types'
import { SettingsService, type SettingsService as SettingsServiceI } from './store'
import { PermissionsService, type PermissionsService as PermissionsServiceI } from './permissions'
import { ModelsService, type ModelsService as ModelsServiceI } from './models/manager'
import { DownloadQueueService, type DownloadQueueService as DownloadQueueServiceI } from './models/download-queue'
import { InjectionService, type InjectionService as InjectionServiceI } from './injection/macos'
import { AiCleanupService, type AiCleanupService as AiCleanupServiceI } from './ai/index'
import { HotkeyService, type HotkeyService as HotkeyServiceI } from './hotkey/manager'
import { PipelineService, type PipelineService as PipelineServiceI } from './pipeline'
import { DictationStateService, type DictationStateService as DictationStateServiceI } from './dictation-state'
import { HudService, type HudService as HudServiceI } from './windows/hud'
import { DEFAULT_SETTINGS, type AppSettings, type InstalledModel, type PermissionStatus, type DownloadProgress, type DownloadEnqueueResult, type ModelDownloadJob, type HudState } from '../shared/types'
import { makeSettingsStub } from './test/stubs'
void makeSettingsStub // keep import for parity; the IPC test uses its own settings stub below
import { AiCleanupError, InjectionError, NoActiveModelError, NoSttEngineLoadedError, TranscriptionError, UnknownEngineError } from './errors'

// --- Recording state shared across the stubs ----------------------------

type Recording = {
  settingsUpdateCalls: number
  hotkeyReloadCalls: number
  hotkeyResetCalls: number
  hotkeyStopCalls: number
  hotkeyInitCalls: number
  aiCleanupCalls: string[]
  injectTestCalls: number
  clearHistoryCalls: number
  setActiveCalls: Array<string | null>
  deleteCalls: string[]
  enqueueCatalogCalls: string[]
  enqueueCustomCalls: Array<{ url: string; name?: string }>
  dictationMarkProcessing: number
  dictationMarkIdle: number
  dictationCanStart: boolean
  hudBroadcasts: HudState[]
  pipelineProcessCalls: number
  getInstalledResult: InstalledModel[]
  permissionsStatus: PermissionStatus
  microphoneGranted: boolean
  activeModelId: string | null
}

const makeStubs = () => {
  const rec: Recording = {
    settingsUpdateCalls: 0,
    hotkeyReloadCalls: 0,
    hotkeyResetCalls: 0,
    hotkeyStopCalls: 0,
    hotkeyInitCalls: 0,
    aiCleanupCalls: [],
    injectTestCalls: 0,
    clearHistoryCalls: 0,
    setActiveCalls: [],
    deleteCalls: [],
    enqueueCatalogCalls: [],
    enqueueCustomCalls: [],
    dictationMarkProcessing: 0,
    dictationMarkIdle: 0,
    dictationCanStart: true,
    hudBroadcasts: [],
    pipelineProcessCalls: 0,
    getInstalledResult: [],
    permissionsStatus: { microphone: true, accessibility: true, inputMonitoring: true, automation: true },
    microphoneGranted: true,
    activeModelId: null
  }

  const settingsLayer = Layer.succeed(SettingsService, {
    get: Effect.succeed(DEFAULT_SETTINGS),
    update: (partial: Partial<AppSettings>) => {
      rec.settingsUpdateCalls++
      return Effect.succeed({ ...DEFAULT_SETTINGS, ...partial })
    },
    addHistory: (_: any) => Effect.void,
    clearHistory: Effect.sync(() => {
      rec.clearHistoryCalls++
    })
  } as SettingsServiceI)

  const permissionsLayer = Layer.succeed(PermissionsService, {
    getStatus: Effect.succeed(rec.permissionsStatus),
    requestMicrophone: Effect.succeed(rec.microphoneGranted),
    openAccessibility: Effect.void,
    openInputMonitoring: Effect.void,
    openMicrophone: Effect.void,
    setInputMonitoringGranted: (_: boolean) => Effect.void
  } as PermissionsServiceI)

  const modelsLayer = Layer.succeed(ModelsService, {
    getInstalled: Effect.succeed(rec.getInstalledResult),
    getActive: Effect.succeed(
      rec.activeModelId
        ? ({
            id: rec.activeModelId,
            name: rec.activeModelId,
            filename: 'x',
            path: '/x',
            sizeBytes: 1,
            language: 'en',
            source: 'catalog',
            engine: 'whisper'
          } satisfies InstalledModel)
        : null
    ),
    setActive: (id: string | null) => {
      rec.setActiveCalls.push(id)
      return Effect.void
    },
    deleteModel: (id: string) => {
      rec.deleteCalls.push(id)
      return Effect.void
    },
    downloadCatalog: ((_id: string, _onProgress: (p: DownloadProgress) => void) =>
      Effect.succeed({
        id: 'x',
        name: 'x',
        filename: 'x',
        path: '/x',
        sizeBytes: 1,
        language: 'en',
        source: 'catalog',
        engine: 'whisper'
      } as InstalledModel)) as ModelsServiceI['downloadCatalog'],
    downloadCustom: ((_url: string, _name: string | undefined) =>
      Effect.succeed({
        id: 'x',
        name: 'x',
        filename: 'x',
        path: '/x',
        sizeBytes: 1,
        language: 'en',
        source: 'catalog',
        engine: 'whisper'
      } as InstalledModel)) as ModelsServiceI['downloadCustom']
  } as unknown as ModelsServiceI)

  const downloadQueueLayer = Layer.succeed(DownloadQueueService, {
    enqueueCatalog: (id: string) => {
      rec.enqueueCatalogCalls.push(id)
      return Effect.succeed({ accepted: true, modelId: id } as DownloadEnqueueResult)
    },
    enqueueCustom: (url: string, name?: string) => {
      rec.enqueueCustomCalls.push({ url, name })
      return Effect.succeed({ accepted: true, modelId: 'custom' } as DownloadEnqueueResult)
    },
    getJobs: Effect.succeed([] as ModelDownloadJob[])
  } as DownloadQueueServiceI)

  const injectionLayer = Layer.succeed(InjectionService, {
    capturePasteTarget: Effect.void,
    clearPasteTarget: Effect.void,
    injectText: (_: string) => Effect.void,
    testInjection: Effect.sync(() => {
      rec.injectTestCalls++
      return true
    })
  } as InjectionServiceI)

  const aiLayer = Layer.succeed(AiCleanupService, {
    cleanupText: (text: string) => {
      rec.aiCleanupCalls.push(text)
      return Effect.succeed(`cleaned:${text}`)
    }
  } as AiCleanupServiceI)

  const hotkeyLayer = Layer.succeed(HotkeyService, {
    init: () => {
      rec.hotkeyInitCalls++
      return Effect.void
    },
    reload: Effect.sync(() => {
      rec.hotkeyReloadCalls++
    }),
    stop: Effect.sync(() => {
      rec.hotkeyStopCalls++
    }),
    forceStop: Effect.void,
    resetRecordingState: Effect.sync(() => {
      rec.hotkeyResetCalls++
    }),
    isCurrentlyRecording: Effect.succeed(false)
  } as HotkeyServiceI)

  const pipelineLayer = Layer.succeed(PipelineService, {
    processTranscription: (_: Float32Array) => {
      rec.pipelineProcessCalls++
      return Effect.succeed('text')
    },
    markRecordingStart: Effect.void,
    markRecordingStop: Effect.void
  } as PipelineServiceI)

  const dictationLayer = Layer.succeed(DictationStateService, {
    getPhase: Effect.succeed('idle' as const),
    canStartRecording: Effect.sync(() => rec.dictationCanStart),
    markRecording: Effect.void,
    markProcessing: Effect.sync(() => {
      rec.dictationMarkProcessing++
    }),
    markIdle: Effect.sync(() => {
      rec.dictationMarkIdle++
    })
  } as DictationStateServiceI)

  const hudLayer = Layer.succeed(HudService, {
    show: Effect.void,
    hide: Effect.void,
    broadcast: (s: HudState) => {
      rec.hudBroadcasts.push(s)
      return Effect.void
    },
    notifyRecording: Effect.void,
    notifyStop: Effect.void
  } as HudServiceI)

  return {
    rec,
    layers: {
      settings: settingsLayer,
      permissions: permissionsLayer,
      models: modelsLayer,
      downloadQueue: downloadQueueLayer,
      injection: injectionLayer,
      ai: aiLayer,
      hotkey: hotkeyLayer,
      pipeline: pipelineLayer,
      dictation: dictationLayer,
      hud: hudLayer
    }
  }
}

const initTestRuntime = (layers: ReturnType<typeof makeStubs>['layers']) => {
  // Build a composed layer (no service depends on others in this suite,
  // so we can just merge them all into the runtime)
  const merged = Layer.mergeAll(
    layers.settings,
    layers.permissions,
    layers.models,
    layers.downloadQueue,
    layers.injection,
    layers.ai,
    layers.hotkey,
    layers.pipeline,
    layers.dictation,
    layers.hud
  ) as Layer.Layer<never, never, never>
  initRuntime(merged)
}

beforeEach(async () => {
  registered.clear()
  handle.mockClear()
  await disposeRuntime()
})

afterEach(async () => {
  await disposeRuntime()
})

const invoke = async (channel: string, ...args: any[]) => {
  const handler = registered.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return await handler({}, ...args)
}

// --- Tests ---------------------------------------------------------------

describe('registerIpcHandlers', () => {
  it('registers every IPC channel exactly once', () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    // 17 channels are registered (the rest are main→renderer push events)
    expect(handle).toHaveBeenCalledTimes(17)
    const expected = [
      IPC.GET_SETTINGS,
      IPC.SET_SETTINGS,
      IPC.GET_PERMISSIONS,
      IPC.REQUEST_MICROPHONE,
      IPC.OPEN_ACCESSIBILITY,
      IPC.OPEN_INPUT_MONITORING,
      IPC.GET_MODEL_CATALOG,
      IPC.GET_INSTALLED_MODELS,
      IPC.DOWNLOAD_MODEL,
      IPC.DOWNLOAD_CUSTOM,
      IPC.DELETE_MODEL,
      IPC.SET_ACTIVE_MODEL,
      IPC.GET_DOWNLOADS,
      IPC.TEST_INJECTION,
      IPC.AI_CLEANUP,
      IPC.CLEAR_HISTORY,
      IPC.PROCESS_RECORDING
    ]
    for (const ch of expected) {
      expect(registered.has(ch)).toBe(true)
    }
  })
})

describe('IPC.GET_SETTINGS', () => {
  it('returns the current settings', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.GET_SETTINGS)
    expect(out).toBeDefined()
    expect(out.hotkey).toBeDefined()
  })
})

describe('IPC.SET_SETTINGS', () => {
  it('updates settings and reloads the hotkey', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const partial: Partial<AppSettings> = { autoStart: true }
    const out = await invoke(IPC.SET_SETTINGS, partial)
    expect(out.autoStart).toBe(true)
    expect(s.rec.hotkeyReloadCalls).toBe(1)
  })
})

describe('IPC.GET_PERMISSIONS / REQUEST_MICROPHONE / OPEN_*', () => {
  it('GET_PERMISSIONS returns the permission status', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.GET_PERMISSIONS)
    expect(out.microphone).toBe(true)
  })

  it('REQUEST_MICROPHONE returns the granted bool', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.REQUEST_MICROPHONE)
    expect(out).toBe(true)
  })
})

describe('IPC.GET_MODEL_CATALOG / GET_INSTALLED_MODELS / GET_DOWNLOADS', () => {
  it('GET_MODEL_CATALOG returns the static catalog', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.GET_MODEL_CATALOG)
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBeGreaterThan(0)
  })

  it('GET_INSTALLED_MODELS returns the list', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.GET_INSTALLED_MODELS)
    expect(Array.isArray(out)).toBe(true)
  })

  it('GET_DOWNLOADS returns jobs', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.GET_DOWNLOADS)
    expect(Array.isArray(out)).toBe(true)
  })
})

describe('IPC.DOWNLOAD_MODEL / DOWNLOAD_CUSTOM', () => {
  it('DOWNLOAD_MODEL forwards the catalog id', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.DOWNLOAD_MODEL, 'tiny')
    expect(out.accepted).toBe(true)
    expect(s.rec.enqueueCatalogCalls).toEqual(['tiny'])
  })

  it('DOWNLOAD_CUSTOM forwards the URL and name', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.DOWNLOAD_CUSTOM, 'https://example.com/x.gguf', 'My Model')
    expect(out.accepted).toBe(true)
    expect(s.rec.enqueueCustomCalls[0]).toEqual({
      url: 'https://example.com/x.gguf',
      name: 'My Model'
    })
  })
})

describe('IPC.DELETE_MODEL / SET_ACTIVE_MODEL', () => {
  it('DELETE_MODEL calls models.deleteModel and returns the updated list', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    await invoke(IPC.DELETE_MODEL, 'whisper-tiny')
    expect(s.rec.deleteCalls).toEqual(['whisper-tiny'])
  })

  it('SET_ACTIVE_MODEL calls models.setActive and returns settings', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.SET_ACTIVE_MODEL, 'whisper-tiny')
    expect(s.rec.setActiveCalls).toEqual(['whisper-tiny'])
    expect(out).toBeDefined()
  })

  it('SET_ACTIVE_MODEL accepts null to clear the active model', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    await invoke(IPC.SET_ACTIVE_MODEL, null)
    expect(s.rec.setActiveCalls).toEqual([null])
  })
})

describe('IPC.TEST_INJECTION / AI_CLEANUP / CLEAR_HISTORY', () => {
  it('TEST_INJECTION calls injection.testInjection', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.TEST_INJECTION)
    expect(out).toBe(true)
    expect(s.rec.injectTestCalls).toBe(1)
  })

  it('AI_CLEANUP calls ai.cleanupText with current settings.ai', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.AI_CLEANUP, 'raw text')
    expect(s.rec.aiCleanupCalls).toEqual(['raw text'])
    expect(out).toBe('cleaned:raw text')
  })

  it('CLEAR_HISTORY clears history and returns the new settings', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const out = await invoke(IPC.CLEAR_HISTORY)
    expect(s.rec.clearHistoryCalls).toBe(1)
    expect(out).toBeDefined()
  })
})

describe('IPC.PROCESS_RECORDING', () => {
  it('rejects short buffers (< MIN_PCM_SAMPLES = 1600) with { ok: false, error }', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const buffer = new ArrayBuffer(100) // < 1600
    const out = await invoke(IPC.PROCESS_RECORDING, buffer)
    expect(out.ok).toBe(false)
    expect(out.error).toBe('Recording too short')
    // Pipeline was NOT called
    expect(s.rec.pipelineProcessCalls).toBe(0)
    // HUD broadcast the rejection
    expect(s.rec.hudBroadcasts.some((b) => b.message === 'Recording too short')).toBe(true)
  })

  it('accepts a sufficiently long buffer and processes the recording', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const buffer = new ArrayBuffer(2000 * 4) // 2000 Float32 samples
    const out = await invoke(IPC.PROCESS_RECORDING, buffer)
    expect(out.ok).toBe(true)
    expect(s.rec.pipelineProcessCalls).toBe(1)
  })

  it('catches pipeline errors and returns { ok: false, error } instead of throwing', async () => {
    const s = makeStubs()
    // Replace the pipeline stub with one that fails
    const failingPipeline = Layer.succeed(PipelineService, {
      processTranscription: (_: Float32Array) =>
        Effect.fail(new NoActiveModelError({ message: 'no model' })),
      markRecordingStart: Effect.void,
      markRecordingStop: Effect.void
    } as unknown as PipelineServiceI)
    initRuntime(Layer.mergeAll(
      s.layers.settings, s.layers.permissions, s.layers.models, s.layers.downloadQueue,
      s.layers.injection, s.layers.ai, s.layers.hotkey, failingPipeline,
      s.layers.dictation, s.layers.hud
    ))
    registerIpcHandlers()
    const buffer = new ArrayBuffer(2000 * 4)
    const out = await invoke(IPC.PROCESS_RECORDING, buffer)
    expect(out.ok).toBe(false)
    expect(typeof out.error).toBe('string')
    expect(out.error).toContain('no model')
  })

  it('resets dictation state to idle even on success (Effect.ensuring)', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    const buffer = new ArrayBuffer(2000 * 4)
    await invoke(IPC.PROCESS_RECORDING, buffer)
    expect(s.rec.dictationMarkProcessing).toBe(1)
    expect(s.rec.dictationMarkIdle).toBe(1)
    expect(s.rec.hotkeyResetCalls).toBe(1)
  })

  it('resets dictation state to idle even on failure (Effect.ensuring)', async () => {
    const s = makeStubs()
    const failingPipeline = Layer.succeed(PipelineService, {
      processTranscription: (_: Float32Array) => Effect.fail(new Error('boom') as never),
      markRecordingStart: Effect.void,
      markRecordingStop: Effect.void
    } as unknown as PipelineServiceI)
    initRuntime(Layer.mergeAll(
      s.layers.settings, s.layers.permissions, s.layers.models, s.layers.downloadQueue,
      s.layers.injection, s.layers.ai, s.layers.hotkey, failingPipeline,
      s.layers.dictation, s.layers.hud
    ))
    registerIpcHandlers()
    const buffer = new ArrayBuffer(2000 * 4)
    await invoke(IPC.PROCESS_RECORDING, buffer)
    expect(s.rec.dictationMarkIdle).toBe(1)
    expect(s.rec.hotkeyResetCalls).toBe(1)
  })
})

describe('ensureDictationIdle', () => {
  it('does nothing when canStartRecording is true', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    s.rec.dictationCanStart = true
    ensureDictationIdle()
    // No markIdle, no hotkey reset, no hud broadcast
    // Wait a tick for the promise from runMain to resolve
    await new Promise((r) => setTimeout(r, 10))
    expect(s.rec.dictationMarkIdle).toBe(0)
  })

  it('resets state when canStartRecording is false', async () => {
    const s = makeStubs()
    initTestRuntime(s.layers)
    registerIpcHandlers()
    s.rec.dictationCanStart = false
    ensureDictationIdle()
    await new Promise((r) => setTimeout(r, 10))
    expect(s.rec.dictationMarkIdle).toBe(1)
    expect(s.rec.hotkeyResetCalls).toBe(1)
  })
})

// Suppress unused-import warnings
void Exit
