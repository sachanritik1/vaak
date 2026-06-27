import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Layer } from 'effect'
import { allRequiredPermissionsGranted, PermissionsService, PermissionsLive } from './permissions'
import type { PermissionStatus } from '../shared/types'

// --- Pure helper (no DI) -----------------------------------------------

const granted: PermissionStatus = {
  microphone: true,
  accessibility: true,
  inputMonitoring: true,
  automation: true
}

describe('allRequiredPermissionsGranted', () => {
  it('returns true when mic, accessibility, and input monitoring are all granted', () => {
    expect(allRequiredPermissionsGranted(granted)).toBe(true)
  })

  it('returns false when microphone is missing', () => {
    expect(allRequiredPermissionsGranted({ ...granted, microphone: false })).toBe(false)
  })

  it('returns false when accessibility is missing', () => {
    expect(allRequiredPermissionsGranted({ ...granted, accessibility: false })).toBe(false)
  })

  it('returns false when input monitoring is missing', () => {
    expect(allRequiredPermissionsGranted({ ...granted, inputMonitoring: false })).toBe(false)
  })

  it('does not require automation (it is optional)', () => {
    expect(allRequiredPermissionsGranted({ ...granted, automation: false })).toBe(true)
  })

  it('returns false when all permissions are denied', () => {
    const denied: PermissionStatus = {
      microphone: false,
      accessibility: false,
      inputMonitoring: false,
      automation: false
    }
    expect(allRequiredPermissionsGranted(denied)).toBe(false)
  })
})

// --- Service layer (mocked electron + child_process) ------------------

const execSync = vi.hoisted(() => vi.fn())
const askForMediaAccess = vi.hoisted(() => vi.fn())
const getMediaAccessStatus = vi.hoisted(() => vi.fn())
const isTrustedAccessibilityClient = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ execSync }))
vi.mock('electron', () => ({
  systemPreferences: {
    askForMediaAccess,
    getMediaAccessStatus,
    isTrustedAccessibilityClient
  }
}))

beforeEach(() => {
  execSync.mockReset()
  askForMediaAccess.mockReset()
  getMediaAccessStatus.mockReset()
  isTrustedAccessibilityClient.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const grantedService = (overrides: Partial<PermissionStatus> = {}): PermissionStatus => ({
  microphone: true,
  accessibility: true,
  inputMonitoring: true,
  automation: true,
  ...overrides
})

describe('PermissionsLive — getStatus', () => {
  itEffect('aggregates mic, accessibility, automation, and the inputMonitoring ref', () =>
    Effect.gen(function* () {
      getMediaAccessStatus.mockReturnValue('granted')
      isTrustedAccessibilityClient.mockReturnValue(true)
      execSync.mockReturnValue(Buffer.from('Safari'))

      const svc = yield* PermissionsService
      const status = yield* svc.getStatus
      expectEffect(status.microphone).toBe(true)
      expectEffect(status.accessibility).toBe(true)
      expectEffect(status.automation).toBe(true)
      // inputMonitoring defaults to false in the Ref
      expectEffect(status.inputMonitoring).toBe(false)
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('reports microphone=false when not granted', () =>
    Effect.gen(function* () {
      getMediaAccessStatus.mockReturnValue('denied')
      isTrustedAccessibilityClient.mockReturnValue(true)
      execSync.mockReturnValue(Buffer.from('Safari'))

      const svc = yield* PermissionsService
      const status = yield* svc.getStatus
      expectEffect(status.microphone).toBe(false)
      expectEffect(status.accessibility).toBe(true)
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('reports accessibility=false when not trusted', () =>
    Effect.gen(function* () {
      getMediaAccessStatus.mockReturnValue('granted')
      isTrustedAccessibilityClient.mockReturnValue(false)
      execSync.mockReturnValue(Buffer.from('Safari'))

      const svc = yield* PermissionsService
      const status = yield* svc.getStatus
      expectEffect(status.accessibility).toBe(false)
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('reports automation=false when osascript throws', () =>
    Effect.gen(function* () {
      getMediaAccessStatus.mockReturnValue('granted')
      isTrustedAccessibilityClient.mockReturnValue(true)
      execSync.mockImplementation(() => {
        throw new Error('not authorized')
      })

      const svc = yield* PermissionsService
      const status = yield* svc.getStatus
      expectEffect(status.automation).toBe(false)
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('setInputMonitoringGranted updates the ref seen by getStatus', () =>
    Effect.gen(function* () {
      getMediaAccessStatus.mockReturnValue('granted')
      isTrustedAccessibilityClient.mockReturnValue(true)
      execSync.mockReturnValue(Buffer.from('Safari'))

      const svc = yield* PermissionsService
      yield* svc.setInputMonitoringGranted(true)
      const status = yield* svc.getStatus
      expectEffect(status.inputMonitoring).toBe(true)

      yield* svc.setInputMonitoringGranted(false)
      const status2 = yield* svc.getStatus
      expectEffect(status2.inputMonitoring).toBe(false)
    }).pipe(Effect.provide(PermissionsLive))
  )
})

describe('PermissionsLive — requestMicrophone', () => {
  itEffect('returns true when askForMediaAccess resolves to true', () =>
    Effect.gen(function* () {
      askForMediaAccess.mockResolvedValue(true)
      const svc = yield* PermissionsService
      const granted = yield* svc.requestMicrophone
      expectEffect(granted).toBe(true)
      expectEffect(askForMediaAccess).toHaveBeenCalledWith('microphone')
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('returns false when askForMediaAccess resolves to false', () =>
    Effect.gen(function* () {
      askForMediaAccess.mockResolvedValue(false)
      const svc = yield* PermissionsService
      const granted = yield* svc.requestMicrophone
      expectEffect(granted).toBe(false)
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('fails with PermissionsError when askForMediaAccess throws', () =>
    Effect.gen(function* () {
      askForMediaAccess.mockRejectedValue(new Error('user denied'))
      const svc = yield* PermissionsService
      const exit = yield* Effect.exit(svc.requestMicrophone)
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(PermissionsLive))
  )
})

describe('PermissionsLive — open* panes', () => {
  itEffect('openAccessibility runs `open x-apple.systempreferences:...Accessibility`', () =>
    Effect.gen(function* () {
      execSync.mockReturnValue(Buffer.from(''))
      const svc = yield* PermissionsService
      yield* svc.openAccessibility
      const call = execSync.mock.calls[0][0] as string
      expectEffect(call).toContain('x-apple.systempreferences:com.apple.preference.security')
      expectEffect(call).toContain('Privacy_Accessibility')
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('openInputMonitoring opens the ListenEvent pane', () =>
    Effect.gen(function* () {
      execSync.mockReturnValue(Buffer.from(''))
      const svc = yield* PermissionsService
      yield* svc.openInputMonitoring
      const call = execSync.mock.calls[0][0] as string
      expectEffect(call).toContain('Privacy_ListenEvent')
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('openMicrophone opens the Microphone pane', () =>
    Effect.gen(function* () {
      execSync.mockReturnValue(Buffer.from(''))
      const svc = yield* PermissionsService
      yield* svc.openMicrophone
      const call = execSync.mock.calls[0][0] as string
      expectEffect(call).toContain('Privacy_Microphone')
    }).pipe(Effect.provide(PermissionsLive))
  )

  itEffect('open* fails with PermissionsError when execSync throws', () =>
    Effect.gen(function* () {
      execSync.mockImplementation(() => {
        throw new Error('open failed')
      })
      const svc = yield* PermissionsService
      const exit = yield* Effect.exit(svc.openAccessibility)
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(PermissionsLive))
  )
})
