import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionsPanel } from './PermissionsPanel'
import { makeSettings } from '../test/fixtures'
import { DEFAULT_HOTKEY, type PermissionStatus } from '@shared/types'

const granted: PermissionStatus = {
  microphone: true,
  accessibility: true,
  inputMonitoring: true,
  automation: true
}

const denied: PermissionStatus = {
  microphone: false,
  accessibility: false,
  inputMonitoring: false,
  automation: false
}

const renderPanel = (
  permissions: PermissionStatus = granted,
  settingsOverrides = {},
  onRefresh = vi.fn()
) => {
  const settings = makeSettings(settingsOverrides)
  const utils = render(
    <PermissionsPanel
      permissions={permissions}
      settings={settings}
      onRefresh={onRefresh}
    />
  )
  return { ...utils, settings, onRefresh }
}

describe('PermissionsPanel', () => {
  beforeEach(() => {
    vi.mocked(window.vaak.requestMicrophone).mockClear()
    vi.mocked(window.vaak.openAccessibility).mockClear()
    vi.mocked(window.vaak.openInputMonitoring).mockClear()
    vi.mocked(window.vaak.testInjection).mockClear()
  })

  it('renders the title and a description with the hotkey label', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Setup', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/Grant permissions to enable system-wide voice dictation/)).toBeInTheDocument()
    // The hotkey label appears in the description
    expect(screen.getByText(DEFAULT_HOTKEY.label)).toBeInTheDocument()
  })

  it('shows Granted badge for each permission when all granted', () => {
    renderPanel(granted)
    // 3 required permissions show "Granted", automation also shows "Granted"
    const grantedBadges = screen.getAllByText('Granted')
    expect(grantedBadges.length).toBe(4)
  })

  it('shows Required badge and Grant button when microphone is denied', () => {
    renderPanel({ ...granted, microphone: false })
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grant' })).toBeInTheDocument()
  })

  it('Grant button calls requestMicrophone and onRefresh', async () => {
    const onRefresh = vi.fn()
    vi.mocked(window.vaak.requestMicrophone).mockResolvedValue(true)
    renderPanel({ ...granted, microphone: false }, {}, onRefresh)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Grant' }))
    expect(window.vaak.requestMicrophone).toHaveBeenCalled()
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows Open Settings button when accessibility is denied', () => {
    renderPanel({ ...granted, accessibility: false })
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument()
  })

  it('Open Settings for accessibility calls openAccessibility', async () => {
    vi.mocked(window.vaak.openAccessibility).mockResolvedValue(undefined)
    renderPanel({ ...granted, accessibility: false })
    const btn = screen.getAllByRole('button', { name: 'Open Settings' })[0]
    await userEvent.setup().click(btn)
    expect(window.vaak.openAccessibility).toHaveBeenCalled()
  })

  it('shows Open Settings for input monitoring when denied', () => {
    renderPanel({ ...granted, inputMonitoring: false })
    // Only one Open Settings button (for input monitoring) when accessibility is granted
    const buttons = screen.getAllByRole('button', { name: 'Open Settings' })
    expect(buttons.length).toBe(1)
  })

  it('Open Settings for input monitoring calls openInputMonitoring', async () => {
    vi.mocked(window.vaak.openInputMonitoring).mockResolvedValue(undefined)
    renderPanel({ ...granted, inputMonitoring: false })
    const btn = screen.getByRole('button', { name: 'Open Settings' })
    await userEvent.setup().click(btn)
    expect(window.vaak.openInputMonitoring).toHaveBeenCalled()
  })

  it('shows "May be required" label for automation when not granted', () => {
    renderPanel({ ...granted, automation: false })
    expect(screen.getByText('May be required')).toBeInTheDocument()
  })

  it('shows Test Paste button for automation', () => {
    renderPanel(granted)
    expect(screen.getByRole('button', { name: 'Test Paste' })).toBeInTheDocument()
  })

  it('Test Paste calls window.vaak.testInjection', async () => {
    vi.mocked(window.vaak.testInjection).mockResolvedValue(true)
    renderPanel(granted)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test Paste' }))
    expect(window.vaak.testInjection).toHaveBeenCalled()
  })

  it('shows the "Ready to dictate!" banner when all granted and activeModelId set', () => {
    renderPanel(granted, { activeModelId: 'whisper-tiny' })
    expect(screen.getByText('Ready to dictate!')).toBeInTheDocument()
  })

  it('shows the "Download a model" banner when no active model', () => {
    renderPanel(granted, { activeModelId: null })
    expect(screen.getByText('Download a model')).toBeInTheDocument()
  })

  it('does NOT show Ready banner when permissions are denied', () => {
    renderPanel(denied, { activeModelId: 'whisper-tiny' })
    expect(screen.queryByText('Ready to dictate!')).not.toBeInTheDocument()
  })
})
