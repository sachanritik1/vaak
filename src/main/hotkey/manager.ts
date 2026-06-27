import { globalShortcut } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { Context, Effect, Fiber, Layer, Ref, Schema } from 'effect'
import { SettingsService } from '../store'
import { PermissionsService } from '../permissions'
import { InjectionService } from '../injection/macos'
import { DictationStateService } from '../dictation-state'
import { HudService } from '../windows/hud'
import { PipelineService } from '../pipeline'
import { runMain } from '../runtime'

export type HotkeyCallbacks = {
  onStart: () => void
  onStop: () => void
}

export const UIOHOOK_KEYS = {
  Escape: 1,
  LeftCtrl: 29,
  RightCtrl: 3613,
  LeftOption: 56,
  RightOption: 3640,
  LeftCommand: 3675,
  RightCommand: 3676
} as const

const MAX_RECORDING_MS = 120_000
const ESCAPE_KEYCODE = UIOHOOK_KEYS.Escape
const TOGGLE_DEBOUNCE_MS = 400

export interface HotkeyService {
  readonly init: (callbacks: HotkeyCallbacks) => Effect.Effect<void, Schema.SchemaError>
  readonly reload: Effect.Effect<void, Schema.SchemaError>
  readonly stop: Effect.Effect<void>
  readonly forceStop: Effect.Effect<void>
  readonly resetRecordingState: Effect.Effect<void>
  readonly isCurrentlyRecording: Effect.Effect<boolean>
}

export const HotkeyService = Context.Service<HotkeyService>('@vaak/Hotkey')

function defer(fn: () => void): void {
  setImmediate(fn)
}

function isOptionKey(keycode: number): boolean {
  return keycode === UIOHOOK_KEYS.LeftOption || keycode === UIOHOOK_KEYS.RightOption
}

function isCommandKey(keycode: number): boolean {
  return keycode === UIOHOOK_KEYS.LeftCommand || keycode === UIOHOOK_KEYS.RightCommand
}

function isControlKey(keycode: number): boolean {
  return keycode === UIOHOOK_KEYS.LeftCtrl || keycode === UIOHOOK_KEYS.RightCtrl
}

function modifierStillHeld(
  e: { altKey: boolean; metaKey: boolean; ctrlKey: boolean },
  keycode: number
): boolean {
  if (isOptionKey(keycode)) return e.altKey
  if (isCommandKey(keycode)) return e.metaKey
  if (isControlKey(keycode)) return e.ctrlKey
  return true
}

type HotkeyState = {
  isRecording: boolean
  hotkeyHeld: boolean
  hookStarted: boolean
  lastToggleAt: number
  maxDurationFiber: Fiber.Fiber<void, unknown> | null
  callbacks: HotkeyCallbacks | null
}

type UiohookDeps = {
  stateRef: Ref.Ref<HotkeyState>
  settings: SettingsService
  beginRecording: Effect.Effect<void>
  endRecording: Effect.Effect<void>
  toggleRecording: Effect.Effect<void>
}

/**
 * Registers uiohook listeners and starts the hook. Lives at module scope so
 * the `Effect.runSync` reads (current state + hotkey config) are not lexically
 * inside an `Effect.gen` — the listeners fire at event time, outside any
 * effect context, and only touch `R = never` effects.
 */
function registerUiohookListeners(deps: UiohookDeps): boolean {
  const { stateRef, settings, beginRecording, endRecording, toggleRecording } = deps

  uIOhook.on('keydown', (e) => {
    const cur = Effect.runSync(Ref.get(stateRef))
    if (e.keycode === ESCAPE_KEYCODE) {
      if (cur.isRecording) {
        defer(() => runMain(endRecording))
      }
      return
    }

    const hotkey = Effect.runSync(settings.get).hotkey
    if (e.keycode !== hotkey.keycode) return

    if (hotkey.mode === 'toggle') {
      defer(() => runMain(toggleRecording))
      return
    }

    // Hold mode — ignore key repeat while already recording
    if (cur.isRecording || cur.hotkeyHeld) return
    void Effect.runSync(Ref.update(stateRef, (s) => ({ ...s, hotkeyHeld: true })))
    defer(() => runMain(beginRecording))
  })

  uIOhook.on('keyup', (e) => {
    const hotkey = Effect.runSync(settings.get).hotkey
    if (hotkey.mode !== 'hold') return
    const cur = Effect.runSync(Ref.get(stateRef))
    if (!cur.isRecording) return

    const keycode = hotkey.keycode
    if (e.keycode === keycode) {
      void Effect.runSync(Ref.update(stateRef, (s) => ({ ...s, hotkeyHeld: false })))
      defer(() => runMain(endRecording))
      return
    }

    if (!modifierStillHeld(e, keycode)) {
      void Effect.runSync(Ref.update(stateRef, (s) => ({ ...s, hotkeyHeld: false })))
      defer(() => runMain(endRecording))
    }
  })

  try {
    uIOhook.start()
    return true
  } catch (cause) {
    void cause
    return false
  }
}

/** Imperatively stops the uiohook; safe to call when not started. */
function stopUiohook(): void {
  try {
    uIOhook.stop()
  } catch {
    // ignore — best effort on shutdown
  }
}

export const HotkeyLive = Layer.effect(HotkeyService, Effect.gen(function* () {
  const settings = yield* SettingsService
  const permissions = yield* PermissionsService
  const injection = yield* InjectionService
  const dictation = yield* DictationStateService
  const hud = yield* HudService
  const pipeline = yield* PipelineService

  const stateRef = yield* Ref.make<HotkeyState>({
    isRecording: false,
    hotkeyHeld: false,
    hookStarted: false,
    lastToggleAt: 0,
    maxDurationFiber: null,
    callbacks: null
  })

  const modifierStillHeld = (
    e: { altKey: boolean; metaKey: boolean; ctrlKey: boolean },
    keycode: number
  ): boolean => {
    if (isOptionKey(keycode)) return e.altKey
    if (isCommandKey(keycode)) return e.metaKey
    if (isControlKey(keycode)) return e.ctrlKey
    return true
  }

  const clearMaxDurationTimer = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.maxDurationFiber) {
      yield* Fiber.interrupt(state.maxDurationFiber)
    }
    yield* Ref.update(stateRef, (s) => ({ ...s, maxDurationFiber: null }))
  })

  const endRecording = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (!state.isRecording) return
    yield* Ref.update(stateRef, (s) => ({ ...s, isRecording: false, hotkeyHeld: false }))
    yield* clearMaxDurationTimer
    yield* hud.notifyStop
    state.callbacks?.onStop()
  })

  const beginRecording = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const canStart = yield* dictation.canStartRecording
    if (state.isRecording || !canStart) {
      yield* Ref.update(stateRef, (s) => ({ ...s, hotkeyHeld: false }))
      return
    }

    yield* Ref.update(stateRef, (s) => ({ ...s, isRecording: true, hotkeyHeld: true }))
    yield* dictation.markRecording
    yield* pipeline.markRecordingStart
    yield* injection.capturePasteTarget
    yield* hud.broadcast({ state: 'recording', level: 0 })
    yield* hud.notifyRecording
    state.callbacks?.onStart()

    yield* clearMaxDurationTimer
    const timer = yield* Effect.sleep(MAX_RECORDING_MS).pipe(
      Effect.andThen(endRecording),
      Effect.forkDetach
    )
    yield* Ref.update(stateRef, (s) => ({ ...s, maxDurationFiber: timer }))
  })

  const toggleRecording = Effect.gen(function* () {
    const now = Date.now()
    const state = yield* Ref.get(stateRef)
    if (now - state.lastToggleAt < TOGGLE_DEBOUNCE_MS) return
    yield* Ref.update(stateRef, (s) => ({ ...s, lastToggleAt: now }))
    if (state.isRecording) {
      yield* endRecording
    } else {
      yield* beginRecording
    }
  })

  const setupGlobalShortcut = Effect.gen(function* () {
    globalShortcut.unregisterAll()
    const { hotkey } = yield* settings.get
    if (hotkey.mode !== 'toggle') return
    const ok = globalShortcut.register(hotkey.accelerator, () => {
      defer(() => runMain(toggleRecording))
    })
    if (!ok) {
      yield* Effect.logWarning(
        `[hotkey] globalShortcut failed for "${hotkey.accelerator}" — using uiohook key press instead`
      )
    }
  })

  const setupUiohook = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.hookStarted) return

    const started = yield* Effect.sync(() =>
      registerUiohookListeners({ stateRef, settings, beginRecording, endRecording, toggleRecording })
    )

    if (started) {
      yield* Ref.update(stateRef, (s) => ({ ...s, hookStarted: true }))
      yield* permissions.setInputMonitoringGranted(true)
    } else {
      yield* Effect.logError('Failed to start uiohook')
      yield* permissions.setInputMonitoringGranted(false)
    }
  })

  const init = Effect.fn('Hotkey.init')(function* (callbacks: HotkeyCallbacks) {
    yield* Ref.update(stateRef, (s) => ({ ...s, callbacks }))
    yield* setupGlobalShortcut
    yield* setupUiohook
  })

  const reload = Effect.gen(function* () {
    globalShortcut.unregisterAll()
    yield* setupGlobalShortcut
  })

  const forceStop = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (!state.isRecording) return
    yield* Ref.update(stateRef, (s) => ({ ...s, isRecording: false, hotkeyHeld: false }))
    yield* clearMaxDurationTimer
    yield* hud.notifyStop
    yield* hud.broadcast({ state: 'idle', level: 0 })
  })

  const stop = Effect.gen(function* () {
    yield* clearMaxDurationTimer
    yield* forceStop
    globalShortcut.unregisterAll()
    const state = yield* Ref.get(stateRef)
    if (state.hookStarted) {
      yield* Effect.sync(() => stopUiohook())
      yield* Ref.update(stateRef, (s) => ({ ...s, hookStarted: false }))
    }
  })

  const resetRecordingState = Effect.gen(function* () {
    yield* Ref.update(stateRef, (s) => ({ ...s, isRecording: false, hotkeyHeld: false }))
    yield* clearMaxDurationTimer
  })

  return {
    init,
    reload,
    stop,
    forceStop,
    resetRecordingState,
    isCurrentlyRecording: Ref.get(stateRef).pipe(Effect.map((s) => s.isRecording))
  }
}))
