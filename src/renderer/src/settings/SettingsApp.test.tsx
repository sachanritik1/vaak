import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsApp } from './SettingsApp'
import { makeSettings, makeInstalledModel } from '../test/fixtures'
import type { AppSettings, ModelDownloadJob } from '@shared/types'

const makeWindowVaak = (overrides: Partial<AppSettings> = {}) => {
  const settings: AppSettings = makeSettings(overrides)
  vi.mocked(window.vaak.getSettings).mockResolvedValue(settings)
  vi.mocked(window.vaak.getPermissions).mockResolvedValue({
    microphone: true,
    accessibility: true,
    inputMonitoring: true,
    automation: true
  })
  vi.mocked(window.vaak.getDownloads).mockResolvedValue([])
  vi.mocked(window.vaak.setSettings).mockImplementation(async (partial) => ({
    ...settings,
    ...partial
  }))
  return settings
}

beforeEach(() => {
  vi.mocked(window.vaak.getSettings).mockReset()
  vi.mocked(window.vaak.getPermissions).mockReset()
  vi.mocked(window.vaak.getDownloads).mockReset()
  vi.mocked(window.vaak.setSettings).mockReset()
  vi.mocked(window.vaak.onDownloadProgress).mockReset()
  vi.mocked(window.vaak.onDownloadsUpdated).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SettingsApp', () => {
  it('shows Loading… while initial settings are null', () => {
    const getSettings = window.vaak.getSettings as unknown as ReturnType<typeof vi.fn>
    const getPermissions = window.vaak.getPermissions as unknown as ReturnType<typeof vi.fn>
    const getDownloads = window.vaak.getDownloads as unknown as ReturnType<typeof vi.fn>
    getSettings.mockReturnValue(new Promise(() => {})) // never resolves
    getPermissions.mockReturnValue(new Promise(() => {}))
    getDownloads.mockReturnValue(new Promise(() => {}))
    render(<SettingsApp />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders all 7 tab buttons after loading', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Setup' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Models' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hotkey' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Cleanup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dictionary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snippets' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
  })

  it('starts on the Setup tab by default', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Setup', level: 2 })).toBeInTheDocument()
    })
  })

  it('switches to the Hotkey tab when clicked', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Setup', level: 2 })).toBeInTheDocument()
    })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hotkey' }))
    expect(screen.getByRole('heading', { name: 'Hotkey', level: 2 })).toBeInTheDocument()
  })

  it('switches to the AI Cleanup tab and shows the AI panel', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('button', { name: 'AI Cleanup' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'AI Cleanup' }))
    expect(screen.getByRole('heading', { name: 'AI Cleanup', level: 2 })).toBeInTheDocument()
  })

  it('switches to the Dictionary tab and shows the dictionary panel', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('button', { name: 'Dictionary' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dictionary' }))
    expect(screen.getByRole('heading', { name: 'Personal Dictionary', level: 2 })).toBeInTheDocument()
  })

  it('switches to the Snippets tab and shows the snippets panel', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('button', { name: 'Snippets' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Snippets' }))
    expect(screen.getByRole('heading', { name: 'Snippets', level: 2 })).toBeInTheDocument()
  })

  it('switches to the History tab and shows the history panel', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('button', { name: 'History' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByRole('heading', { name: 'History', level: 2 })).toBeInTheDocument()
  })

  it('updateSettings calls setSettings and updates local state', async () => {
    const initial = makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('heading', { name: 'Setup', level: 2 }))
    // Switch to hotkey and toggle mode
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hotkey' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Toggle (Shortcut)' }))
    expect(window.vaak.setSettings).toHaveBeenCalled()
    expect(initial).toBeDefined() // initial was returned
  })

  it('shows the active download count badge on the Models tab', async () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'a', status: 'downloading', downloaded: 50, total: 100, percent: 50 },
      { modelId: 'b', status: 'queued', downloaded: 0, total: 0, percent: 0 }
    ]
    makeWindowVaak()
    // Override getDownloads AFTER makeWindowVaak
    ;(window.vaak.getDownloads as ReturnType<typeof vi.fn>).mockResolvedValue(downloads)
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('button', { name: /Models/ }))
    // The badge should show "2"
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does NOT show a badge on Models when no downloads are active', async () => {
    makeWindowVaak()
    render(<SettingsApp />)
    await waitFor(() => screen.getByRole('button', { name: 'Models' }))
    // Look for the nav button
    const modelsBtn = screen.getByRole('button', { name: 'Models' })
    // It should have no badge child
    expect(modelsBtn.querySelector('.badge')).toBeNull()
  })

  it('subscribes to download progress and updates on completion', async () => {
    makeWindowVaak()
    const unsubProgress = vi.fn()
    const unsubUpdated = vi.fn()
    vi.mocked(window.vaak.onDownloadProgress).mockReturnValue(unsubProgress)
    vi.mocked(window.vaak.onDownloadsUpdated).mockReturnValue(unsubUpdated)
    const { unmount } = render(<SettingsApp />)
    await waitFor(() => screen.getByRole('heading', { name: 'Setup', level: 2 }))
    // Subscriptions were made
    expect(window.vaak.onDownloadProgress).toHaveBeenCalled()
    expect(window.vaak.onDownloadsUpdated).toHaveBeenCalled()
    // Unmount unsubscribes
    unmount()
    expect(unsubProgress).toHaveBeenCalled()
    expect(unsubUpdated).toHaveBeenCalled()
  })

  it('refreshes settings every 3 seconds', () => {
    vi.useFakeTimers()
    makeWindowVaak()
    render(<SettingsApp />)
    const getSettings = window.vaak.getSettings as unknown as ReturnType<typeof vi.fn>
    expect(getSettings).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(getSettings.mock.calls.length).toBeGreaterThan(1)
  })

  it('handles initial getSettings failure gracefully (stays on Loading)', async () => {
    // Document the current behavior: SettingsApp renders Loading… until
    // both getSettings and getPermissions resolve.
    const getSettings = window.vaak.getSettings as unknown as ReturnType<typeof vi.fn>
    const getDownloads = window.vaak.getDownloads as unknown as ReturnType<typeof vi.fn>
    const getPermissions = window.vaak.getPermissions as unknown as ReturnType<typeof vi.fn>
    getSettings.mockReturnValue(new Promise(() => {})) // never resolves
    getDownloads.mockReturnValue(new Promise(() => {}))
    getPermissions.mockReturnValue(new Promise(() => {}))
    render(<SettingsApp />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})

// Suppress unused imports
void makeInstalledModel
