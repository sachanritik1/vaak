import { execSync } from 'node:child_process'
import { systemPreferences } from 'electron'
import { Context, Effect, Layer, Ref } from 'effect'
import type { PermissionStatus } from '../shared/types'
import { PermissionsError } from './errors'

/**
 * PermissionsService wraps macOS permission probes (systemPreferences) and
 * the `open x-apple.systempreferences:...` launches. The
 * `inputMonitoringGranted` flag (set by the hotkey manager once uiohook
 * starts) lives in a Ref.
 */

export interface PermissionsService {
  readonly getStatus: Effect.Effect<PermissionStatus>
  readonly requestMicrophone: Effect.Effect<boolean, PermissionsError>
  readonly openAccessibility: Effect.Effect<void, PermissionsError>
  readonly openInputMonitoring: Effect.Effect<void, PermissionsError>
  readonly openMicrophone: Effect.Effect<void, PermissionsError>
  readonly setInputMonitoringGranted: (granted: boolean) => Effect.Effect<void>
}

export const PermissionsService = Context.Service<PermissionsService>('@vaak/Permissions')

export function allRequiredPermissionsGranted(status: PermissionStatus): boolean {
  return status.microphone && status.accessibility && status.inputMonitoring
}

export const PermissionsLive = Layer.effect(PermissionsService, Effect.gen(function* () {
  const inputMonitoringRef = yield* Ref.make(false)

  const probeAutomation = Effect.sync(() => {
    try {
      execSync(`osascript -e 'tell application "System Events" to return name of first process'`, {
        stdio: 'pipe',
        timeout: 3000
      })
      return true
    } catch {
      return false
    }
  })

  const getStatus = Effect.gen(function* () {
    const microphone = systemPreferences.getMediaAccessStatus('microphone') === 'granted'
    const accessibility = systemPreferences.isTrustedAccessibilityClient(false)
    const automation = yield* probeAutomation
    const inputMonitoring = yield* Ref.get(inputMonitoringRef)
    return { microphone, accessibility, inputMonitoring, automation }
  })

  const requestMicrophone = Effect.tryPromise({
    try: () => systemPreferences.askForMediaAccess('microphone'),
    catch: (cause) => new PermissionsError({ message: 'Microphone permission request failed', error: cause })
  })

  const openUrl = (url: string) =>
    Effect.try({
      try: () => void execSync(`open "${url}"`, { stdio: 'ignore' }),
      catch: (cause) => new PermissionsError({ message: `Failed to open ${url}`, error: cause })
    })

  return {
    getStatus,
    requestMicrophone,
    openAccessibility: openUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'),
    openInputMonitoring: openUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'),
    openMicrophone: openUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'),
    setInputMonitoringGranted: (granted: boolean) => Ref.set(inputMonitoringRef, granted)
  }
}))
