import { execSync } from 'node:child_process'
import { systemPreferences } from 'electron'
import type { PermissionStatus } from '../shared/types'

let inputMonitoringGranted = false

export function setInputMonitoringGranted(granted: boolean): void {
  inputMonitoringGranted = granted
}

export function getPermissionStatus(): PermissionStatus {
  const microphone = systemPreferences.getMediaAccessStatus('microphone') === 'granted'
  const accessibility = systemPreferences.isTrustedAccessibilityClient(false)

  let automation = false
  try {
    execSync(
      `osascript -e 'tell application "System Events" to return name of first process'`,
      { stdio: 'pipe', timeout: 3000 }
    )
    automation = true
  } catch {
    automation = false
  }

  return {
    microphone,
    accessibility,
    inputMonitoring: inputMonitoringGranted,
    automation
  }
}

export async function requestMicrophoneAccess(): Promise<boolean> {
  return systemPreferences.askForMediaAccess('microphone')
}

export function openAccessibilitySettings(): void {
  execSync(
    `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`,
    { stdio: 'ignore' }
  )
}

export function openInputMonitoringSettings(): void {
  execSync(
    `open "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"`,
    { stdio: 'ignore' }
  )
}

export function openMicrophoneSettings(): void {
  execSync(
    `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"`,
    { stdio: 'ignore' }
  )
}

export function allRequiredPermissionsGranted(status: PermissionStatus): boolean {
  return status.microphone && status.accessibility && status.inputMonitoring
}
