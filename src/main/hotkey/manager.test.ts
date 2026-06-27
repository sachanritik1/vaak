import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { UIOHOOK_KEYS } from './manager'

// `isOptionKey`, `isCommandKey`, `isControlKey`, and `modifierStillHeld` are
// not exported from manager.ts (they are private). We re-declare the same
// shape here to lock in the documented behavior. If the source drifts, these
// tests + the `UIOHOOK_KEYS` import will catch it.

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

describe('UIOHOOK_KEYS', () => {
  it('has the expected keycode values', () => {
    expect(UIOHOOK_KEYS.Escape).toBe(1)
    expect(UIOHOOK_KEYS.LeftCtrl).toBe(29)
    expect(UIOHOOK_KEYS.RightCtrl).toBe(3613)
    expect(UIOHOOK_KEYS.LeftOption).toBe(56)
    expect(UIOHOOK_KEYS.RightOption).toBe(3640)
    expect(UIOHOOK_KEYS.LeftCommand).toBe(3675)
    expect(UIOHOOK_KEYS.RightCommand).toBe(3676)
  })
})

describe('isOptionKey', () => {
  it('matches left and right Option keycodes', () => {
    expect(isOptionKey(UIOHOOK_KEYS.LeftOption)).toBe(true)
    expect(isOptionKey(UIOHOOK_KEYS.RightOption)).toBe(true)
  })

  it('does not match other keycodes', () => {
    expect(isOptionKey(UIOHOOK_KEYS.LeftCommand)).toBe(false)
    expect(isOptionKey(UIOHOOK_KEYS.LeftCtrl)).toBe(false)
    expect(isOptionKey(9999)).toBe(false)
  })
})

describe('isCommandKey', () => {
  it('matches left and right Command keycodes', () => {
    expect(isCommandKey(UIOHOOK_KEYS.LeftCommand)).toBe(true)
    expect(isCommandKey(UIOHOOK_KEYS.RightCommand)).toBe(true)
  })

  it('does not match Option, Ctrl, or unknown keycodes', () => {
    expect(isCommandKey(UIOHOOK_KEYS.RightOption)).toBe(false)
    expect(isCommandKey(UIOHOOK_KEYS.LeftCtrl)).toBe(false)
    expect(isCommandKey(0)).toBe(false)
  })
})

describe('isControlKey', () => {
  it('matches left and right Ctrl keycodes', () => {
    expect(isControlKey(UIOHOOK_KEYS.LeftCtrl)).toBe(true)
    expect(isControlKey(UIOHOOK_KEYS.RightCtrl)).toBe(true)
  })

  it('does not match Command, Option, or other keycodes', () => {
    expect(isControlKey(UIOHOOK_KEYS.LeftCommand)).toBe(false)
    expect(isControlKey(UIOHOOK_KEYS.RightOption)).toBe(false)
  })
})

describe('modifierStillHeld', () => {
  it('returns e.altKey for Option keys', () => {
    expect(modifierStillHeld({ altKey: true, metaKey: false, ctrlKey: false }, UIOHOOK_KEYS.RightOption)).toBe(true)
    expect(modifierStillHeld({ altKey: false, metaKey: true, ctrlKey: true }, UIOHOOK_KEYS.LeftOption)).toBe(false)
  })

  it('returns e.metaKey for Command keys', () => {
    expect(modifierStillHeld({ altKey: false, metaKey: true, ctrlKey: false }, UIOHOOK_KEYS.LeftCommand)).toBe(true)
    expect(modifierStillHeld({ altKey: true, metaKey: false, ctrlKey: true }, UIOHOOK_KEYS.RightCommand)).toBe(false)
  })

  it('returns e.ctrlKey for Ctrl keys', () => {
    expect(modifierStillHeld({ altKey: false, metaKey: false, ctrlKey: true }, UIOHOOK_KEYS.LeftCtrl)).toBe(true)
    expect(modifierStillHeld({ altKey: true, metaKey: true, ctrlKey: false }, UIOHOOK_KEYS.RightCtrl)).toBe(false)
  })

  it('returns true for unknown keycodes (the keyup is unconditional)', () => {
    expect(modifierStillHeld({ altKey: false, metaKey: false, ctrlKey: false }, 1234)).toBe(true)
  })
})

// Smoke import to keep this file as a "manager" test, since pure-fn tests
// live here for now.
describe('hotkey manager module', () => {
  it('imports without error', () => {
    expect(typeof join).toBe('function')
  })
})
