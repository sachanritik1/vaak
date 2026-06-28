import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryPanel } from './HistoryPanel'
import { makeSettings, makeHistoryEntry } from '../test/fixtures'
import type { AppSettings } from '@shared/types'

const renderPanel = (overrides: Partial<AppSettings> = {}, onUpdate = vi.fn().mockResolvedValue(undefined)) => {
  const settings = makeSettings(overrides)
  const utils = render(<HistoryPanel settings={settings} onUpdate={onUpdate} />)
  return { ...utils, settings, onUpdate }
}

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.mocked(window.vaak.clearHistory).mockClear()
    vi.mocked(window.vaak.getSettings).mockClear()
  })

  it('renders the title and a description', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'History', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/Recent dictations stored locally/)).toBeInTheDocument()
  })

  it('shows the empty state when history is empty', () => {
    renderPanel()
    expect(screen.getByText(/No dictations yet/)).toBeInTheDocument()
  })

  it('does NOT show the Clear button when history is empty', () => {
    renderPanel()
    expect(screen.queryByRole('button', { name: 'Clear History' })).not.toBeInTheDocument()
  })

  it('shows the Clear button when history has entries', () => {
    const overrides: Partial<AppSettings> = { history: [makeHistoryEntry({ id: 'h1' })] }
    renderPanel(overrides)
    expect(screen.getByRole('button', { name: 'Clear History' })).toBeInTheDocument()
  })

  it('renders each history entry with text and timestamp', () => {
    const overrides: Partial<AppSettings> = {
      history: [
        makeHistoryEntry({ id: 'h1', text: 'first dictation' }),
        makeHistoryEntry({ id: 'h2', text: 'second dictation' })
      ]
    }
    renderPanel(overrides)
    expect(screen.getByText('first dictation')).toBeInTheDocument()
    expect(screen.getByText('second dictation')).toBeInTheDocument()
  })

  it('shows rawText with line-through only when it differs from cleaned text', () => {
    const overrides: Partial<AppSettings> = {
      history: [
        makeHistoryEntry({ id: 'h1', text: 'cleaned', rawText: 'raw uncleaned' }),
        makeHistoryEntry({ id: 'h2', text: 'same', rawText: 'same' })
      ]
    }
    const { container } = renderPanel(overrides)
    const strikethroughs = container.querySelectorAll('.line-through')
    expect(strikethroughs).toHaveLength(1)
    expect(strikethroughs[0].textContent).toBe('raw uncleaned')
  })

  it('formats durations as ms when under 1000', () => {
    const overrides: Partial<AppSettings> = { history: [makeHistoryEntry({ id: 'h1', durationMs: 250 })] }
    renderPanel(overrides)
    expect(screen.getByText('250ms')).toBeInTheDocument()
  })

  it('formats durations as seconds when >= 1000', () => {
    const overrides: Partial<AppSettings> = { history: [makeHistoryEntry({ id: 'h1', durationMs: 1500 })] }
    renderPanel(overrides)
    expect(screen.getByText('1.5s')).toBeInTheDocument()
  })

  it('Clear button calls clearHistory → getSettings → onUpdate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const clearHistory = window.vaak.clearHistory as ReturnType<typeof vi.fn>
    const getSettings = window.vaak.getSettings as ReturnType<typeof vi.fn>
    clearHistory.mockResolvedValue(undefined)
    getSettings.mockResolvedValue(
      makeSettings({ history: [] })
    )
    const overrides: Partial<AppSettings> = { history: [makeHistoryEntry({ id: 'h1' })] }
    renderPanel(overrides, onUpdate)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear History' }))
    await waitFor(() => {
      expect(clearHistory).toHaveBeenCalled()
      expect(getSettings).toHaveBeenCalled()
      expect(onUpdate).toHaveBeenCalledWith({ history: [] })
    })
  })
})
