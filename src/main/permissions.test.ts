import { describe, it, expect } from 'vitest'
import { allRequiredPermissionsGranted } from './permissions'
import type { PermissionStatus } from '../shared/types'

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
