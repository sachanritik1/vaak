import { globalShortcut } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { getSettings } from '../store'
import { setInputMonitoringGranted } from '../permissions'
import { capturePasteTarget } from '../injection/macos'
import {
  canStartRecording,
  markDictationRecording,
  notifyHudRecording,
  notifyHudStop
} from '../dictation-state'
import { broadcastHudState } from '../windows/hud'
import { markRecordingStart } from '../pipeline'

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

let isRecording = false
let hotkeyHeld = false
let callbacks: HotkeyCallbacks | null = null
let hookStarted = false
let maxDurationTimer: ReturnType<typeof setTimeout> | null = null
let lastToggleAt = 0

function defer(fn: () => void): void {
  setImmediate(fn)
}

function clearMaxDurationTimer(): void {
  if (maxDurationTimer) {
    clearTimeout(maxDurationTimer)
    maxDurationTimer = null
  }
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
  return hotkeyHeld
}

function matchesHotkey(keycode: number): boolean {
  return keycode === getSettings().hotkey.keycode
}

function beginRecording(): void {
  if (isRecording || !canStartRecording()) {
    hotkeyHeld = false
    return
  }

  isRecording = true
  hotkeyHeld = true
  markDictationRecording()
  markRecordingStart()

  void capturePasteTarget()

  broadcastHudState({ state: 'recording', level: 0 })
  notifyHudRecording()
  callbacks?.onStart()

  clearMaxDurationTimer()
  maxDurationTimer = setTimeout(() => {
    console.warn('[hotkey] Max recording duration reached, forcing stop')
    endRecording()
  }, MAX_RECORDING_MS)
}

function endRecording(): void {
  if (!isRecording) return

  isRecording = false
  hotkeyHeld = false
  clearMaxDurationTimer()

  notifyHudStop()
  callbacks?.onStop()
}

function toggleRecording(): void {
  const now = Date.now()
  if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) return
  lastToggleAt = now

  if (isRecording) {
    endRecording()
  } else {
    beginRecording()
  }
}

export function initHotkeyManager(cbs: HotkeyCallbacks): void {
  callbacks = cbs
  setupGlobalShortcut()
  setupUiohook()
}

function setupGlobalShortcut(): void {
  globalShortcut.unregisterAll()
  const { hotkey } = getSettings()

  if (hotkey.mode !== 'toggle') return

  const ok = globalShortcut.register(hotkey.accelerator, () => {
    defer(() => toggleRecording())
  })
  if (!ok) {
    console.warn(
      `[hotkey] globalShortcut failed for "${hotkey.accelerator}" — using uiohook key press instead`
    )
  }
}

function setupUiohook(): void {
  if (hookStarted) return

  uIOhook.on('keydown', (e) => {
    if (e.keycode === ESCAPE_KEYCODE && isRecording) {
      defer(() => endRecording())
      return
    }

    const { hotkey } = getSettings()
    if (!matchesHotkey(e.keycode)) return

    if (hotkey.mode === 'toggle') {
      defer(() => toggleRecording())
      return
    }

    // Hold mode — ignore key repeat while already recording
    if (isRecording || hotkeyHeld) return
    hotkeyHeld = true
    defer(() => beginRecording())
  })

  uIOhook.on('keyup', (e) => {
    const { hotkey } = getSettings()
    if (hotkey.mode !== 'hold') return
    if (!isRecording) return

    const keycode = hotkey.keycode

    // Primary: exact hotkey released
    if (matchesHotkey(e.keycode)) {
      hotkeyHeld = false
      defer(() => endRecording())
      return
    }

    // Fallback: macOS sometimes misses the Option keyup — detect modifier release on any key
    if (!modifierStillHeld(e, keycode)) {
      hotkeyHeld = false
      defer(() => endRecording())
    }
  })

  try {
    uIOhook.start()
    hookStarted = true
    setInputMonitoringGranted(true)
  } catch (err) {
    console.error('Failed to start uiohook:', err)
    setInputMonitoringGranted(false)
  }
}

export function reloadHotkey(): void {
  globalShortcut.unregisterAll()
  setupGlobalShortcut()
}

export function stopHotkeyManager(): void {
  clearMaxDurationTimer()
  forceStopRecording()
  globalShortcut.unregisterAll()
  if (hookStarted) {
    try {
      uIOhook.stop()
    } catch {
      // ignore
    }
    hookStarted = false
  }
}

export function isCurrentlyRecording(): boolean {
  return isRecording
}

export function forceStopRecording(): void {
  if (!isRecording) return
  isRecording = false
  hotkeyHeld = false
  clearMaxDurationTimer()
  notifyHudStop()
  broadcastHudState({ state: 'idle', level: 0 })
}

export function resetHotkeyRecordingState(): void {
  isRecording = false
  hotkeyHeld = false
  clearMaxDurationTimer()
}
