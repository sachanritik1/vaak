import { describe, it, expect, vi, beforeEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Layer } from 'effect'

// --- Module mocks --------------------------------------------------------

const uIOhookKeydownListeners: Array<(e: { keycode: number; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => void> = []
const uIOhookKeyupListeners: Array<(e: { keycode: number; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => void> = []
let uIOhookStartOk = true

const uIOhook = vi.hoisted(() => ({
  on: vi.fn((event: 'keydown' | 'keyup', listener: (e: any) => void) => {
    if (event === 'keydown') uIOhookKeydownListeners.push(listener)
    if (event === 'keyup') uIOhookKeyupListeners.push(listener)
  }),
  start: vi.fn(() => {
    if (!uIOhookStartOk) throw new Error('uiohook failed to start')
  }),
  stop: vi.fn()
}))

vi.mock('uiohook-napi', () => ({ uIOhook }))

const globalShortcut = vi.hoisted(() => ({
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/vaak-hotkey' },
  globalShortcut
}))

// --- Test harness --------------------------------------------------------

import { HotkeyService, HotkeyLive, UIOHOOK_KEYS } from './manager'
import { SettingsService, type SettingsService as SettingsServiceI } from '../store'
import { PermissionsService, type PermissionsService as PermissionsServiceI } from '../permissions'
import { InjectionService, type InjectionService as InjectionServiceI } from '../injection/macos'
import { DictationStateService, DictationStateLive } from '../dictation-state'
import { HudService, type HudService as HudServiceI } from '../windows/hud'
import { PipelineService, type PipelineService as PipelineServiceI } from '../pipeline'
import {
  DEFAULT_HOTKEY,
  DEFAULT_SETTINGS,
  type AppSettings,
  type HotkeyConfig,
  type HudState
} from '../../shared/types'

type EventLog = {
  settingsUpdates: number
  hotkeyReloads: number
  capturePasteTarget: number
  injects: number
  hudNotifies: { recording: number; stop: number }
  hudBroadcasts: HudState[]
  markRecordingStart: number
  inputMonitoringSet: Array<boolean>
}

const makeStubs = (opts: {
  initialSettings?: AppSettings
  hotkeyOverrides?: Partial<HotkeyConfig>
} = {}): { events: EventLog; layers: any } => {
  const events: EventLog = {
    settingsUpdates: 0,
    hotkeyReloads: 0,
    capturePasteTarget: 0,
    injects: 0,
    hudNotifies: { recording: 0, stop: 0 },
    hudBroadcasts: [],
    markRecordingStart: 0,
    inputMonitoringSet: []
  }

  const settings: AppSettings = {
    ...(opts.initialSettings ?? DEFAULT_SETTINGS),
    hotkey: { ...DEFAULT_HOTKEY, ...(opts.hotkeyOverrides ?? {}) }
  }

  const settingsLayer = Layer.succeed(SettingsService, {
    get: Effect.succeed(settings),
    update: (_: Partial<AppSettings>) => {
      events.settingsUpdates++
      return Effect.succeed(settings)
    },
    addHistory: () => Effect.void,
    clearHistory: Effect.void
  } as SettingsServiceI)

  const permissionsLayer = Layer.succeed(PermissionsService, {
    getStatus: Effect.succeed({
      microphone: true,
      accessibility: true,
      inputMonitoring: true,
      automation: true
    }),
    requestMicrophone: Effect.succeed(true),
    openAccessibility: Effect.void,
    openInputMonitoring: Effect.void,
    openMicrophone: Effect.void,
    setInputMonitoringGranted: (g: boolean) => {
      events.inputMonitoringSet.push(g)
      return Effect.void
    }
  } as PermissionsServiceI)

  const injectionLayer = Layer.succeed(InjectionService, {
    capturePasteTarget: Effect.sync(() => {
      events.capturePasteTarget++
    }),
    clearPasteTarget: Effect.void,
    injectText: (_: string) =>
      Effect.sync(() => {
        events.injects++
      }),
    testInjection: Effect.succeed(true)
  } as InjectionServiceI)

  const dictationLayer = DictationStateLive

  const hudLayer = Layer.succeed(HudService, {
    show: Effect.void,
    hide: Effect.void,
    broadcast: (s: HudState) => {
      events.hudBroadcasts.push(s)
      return Effect.void
    },
    notifyRecording: Effect.sync(() => {
      events.hudNotifies.recording++
    }),
    notifyStop: Effect.sync(() => {
      events.hudNotifies.stop++
    })
  } as HudServiceI)

  const pipelineLayer = Layer.succeed(PipelineService, {
    processTranscription: (_: Float32Array) => Effect.succeed('text'),
    markRecordingStart: Effect.sync(() => {
      events.markRecordingStart++
    }),
    markRecordingStop: Effect.void
  } as PipelineServiceI)

  return {
    events,
    layers: {
      settings: settingsLayer,
      permissions: permissionsLayer,
      injection: injectionLayer,
      dictation: dictationLayer,
      hud: hudLayer,
      pipeline: pipelineLayer
    }
  }
}

const buildHotkeyLayer = (s: any) =>
  HotkeyLive.pipe(
    Layer.provideMerge(s.settings),
    Layer.provideMerge(s.permissions),
    Layer.provideMerge(s.injection),
    Layer.provideMerge(s.dictation),
    Layer.provideMerge(s.hud),
    Layer.provideMerge(s.pipeline)
  )

beforeEach(() => {
  uIOhookKeydownListeners.length = 0
  uIOhookKeyupListeners.length = 0
  uIOhookStartOk = true
  uIOhook.on.mockClear()
  uIOhook.start.mockClear()
  uIOhook.stop.mockClear()
  globalShortcut.register.mockClear()
  globalShortcut.unregister.mockClear()
  globalShortcut.unregisterAll.mockClear()
})

// --- Tests ---------------------------------------------------------------

describe('HotkeyLive — init', () => {
  it('stores callbacks and starts uiohook', () => {
    const s = makeStubs()
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      expectEffect(uIOhook.on).toHaveBeenCalledWith('keydown', expect.any(Function))
      expectEffect(uIOhook.on).toHaveBeenCalledWith('keyup', expect.any(Function))
      expectEffect(uIOhook.start).toHaveBeenCalled()
      expectEffect(s.events.inputMonitoringSet).toEqual([true])
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('marks inputMonitoring denied if uiohook.start throws', () => {
    uIOhookStartOk = false
    const s = makeStubs()
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      expectEffect(s.events.inputMonitoringSet).toEqual([false])
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })
})

describe('HotkeyLive — hold mode keydown', () => {
  it('beginRecording fires when the configured hotkey is pressed in hold mode', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'hold', keycode: UIOHOOK_KEYS.RightOption }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      uIOhookKeydownListeners[0]({ keycode: UIOHOOK_KEYS.RightOption })
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      const phase = yield* (yield* DictationStateService).getPhase
      expectEffect(phase).toBe('recording')
      expectEffect(s.events.capturePasteTarget).toBe(1)
      expectEffect(s.events.markRecordingStart).toBe(1)
      expectEffect(s.events.hudNotifies.recording).toBe(1)
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('Escape key during recording triggers endRecording', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'hold', keycode: UIOHOOK_KEYS.RightOption }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      let onStopCalled = false
      yield* hotkey.init({
        onStart: () => {},
        onStop: () => {
          onStopCalled = true
        }
      })
      uIOhookKeydownListeners[0]({ keycode: UIOHOOK_KEYS.RightOption })
      yield* Effect.yieldNow
      uIOhookKeydownListeners[0]({ keycode: UIOHOOK_KEYS.Escape })
      yield* Effect.yieldNow
      expectEffect(onStopCalled).toBe(true)
      expectEffect(s.events.hudNotifies.stop).toBe(1)
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })
})

describe('HotkeyLive — toggle mode', () => {
  it('toggle mode registers a globalShortcut fallback', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'toggle', accelerator: 'Alt+Space' }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      expectEffect(globalShortcut.register).toHaveBeenCalledWith('Alt+Space', expect.any(Function))
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('hold mode does NOT register a globalShortcut', () => {
    const s = makeStubs({ hotkeyOverrides: { mode: 'hold' } })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      expectEffect(globalShortcut.register).not.toHaveBeenCalled()
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('globalShortcut.register failure logs a warning but does not throw', () => {
    globalShortcut.register.mockReturnValue(false)
    const s = makeStubs({
      hotkeyOverrides: { mode: 'toggle', accelerator: 'Alt+X' }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })
})

describe('HotkeyLive — isCurrentlyRecording / forceStop / stop', () => {
  it('isCurrentlyRecording reflects the current state', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'hold', keycode: UIOHOOK_KEYS.RightOption }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      expectEffect(yield* hotkey.isCurrentlyRecording).toBe(false)
      uIOhookKeydownListeners[0]({ keycode: UIOHOOK_KEYS.RightOption })
      yield* Effect.yieldNow
      expectEffect(yield* hotkey.isCurrentlyRecording).toBe(true)
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('forceStop clears recording state and notifies HUD', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'hold', keycode: UIOHOOK_KEYS.RightOption }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      uIOhookKeydownListeners[0]({ keycode: UIOHOOK_KEYS.RightOption })
      yield* Effect.yieldNow
      yield* hotkey.forceStop
      expectEffect(yield* hotkey.isCurrentlyRecording).toBe(false)
      expectEffect(s.events.hudNotifies.stop).toBe(1)
      expectEffect(s.events.hudBroadcasts.some((b: HudState) => b.state === 'idle')).toBe(true)
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('forceStop is a no-op when not recording', () => {
    const s = makeStubs()
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      yield* hotkey.forceStop
      expectEffect(s.events.hudNotifies.stop).toBe(0)
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })

  it('stop unregisters globalShortcut and stops uiohook', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'toggle', accelerator: 'Alt+Space' }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      yield* hotkey.stop
      expectEffect(globalShortcut.unregisterAll).toHaveBeenCalled()
      expectEffect(uIOhook.stop).toHaveBeenCalled()
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })
})

describe('HotkeyLive — reload', () => {
  it('reload re-registers the globalShortcut with the new hotkey config', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'toggle', accelerator: 'Alt+Space' }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      globalShortcut.register.mockClear()
      yield* hotkey.reload
      expectEffect(globalShortcut.unregisterAll).toHaveBeenCalled()
      expectEffect(globalShortcut.register).toHaveBeenCalled()
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })
})

describe('HotkeyLive — resetRecordingState', () => {
  it('resetRecordingState clears isRecording', () => {
    const s = makeStubs({
      hotkeyOverrides: { mode: 'hold', keycode: UIOHOOK_KEYS.RightOption }
    })
    return Effect.gen(function* () {
      const hotkey = yield* HotkeyService
      yield* hotkey.init({ onStart: () => {}, onStop: () => {} })
      uIOhookKeydownListeners[0]({ keycode: UIOHOOK_KEYS.RightOption })
      yield* Effect.yieldNow
      expectEffect(yield* hotkey.isCurrentlyRecording).toBe(true)
      yield* hotkey.resetRecordingState
      expectEffect(yield* hotkey.isCurrentlyRecording).toBe(false)
    }).pipe(Effect.provide(buildHotkeyLayer(s.layers)))
  })
})
