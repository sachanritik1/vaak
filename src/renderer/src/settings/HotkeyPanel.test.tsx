import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HotkeyPanel } from './HotkeyPanel'
import { makeSettings } from '../test/fixtures'
import { DEFAULT_HOTKEY } from '../../../shared/types'

const renderPanel = (overrides = {}, onUpdate = vi.fn().mockResolvedValue(undefined)) => {
  const settings = makeSettings(overrides)
  const utils = render(<HotkeyPanel settings={settings} onUpdate={onUpdate} />)
  return { ...utils, settings, onUpdate }
}

describe('HotkeyPanel', () => {
  it('renders the title and a description', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Hotkey', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/Configure how you trigger/)).toBeInTheDocument()
  })

  it('renders both activation mode buttons (hold + toggle)', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Hold to Talk' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toggle (Shortcut)' })).toBeInTheDocument()
  })

  it('highlights the active mode button', () => {
    renderPanel({ hotkey: { ...DEFAULT_HOTKEY, mode: 'hold' } })
    const holdBtn = screen.getByRole('button', { name: 'Hold to Talk' })
    const toggleBtn = screen.getByRole('button', { name: 'Toggle (Shortcut)' })
    expect(holdBtn.className).toContain('btn-primary')
    expect(toggleBtn.className).toContain('btn-secondary')
  })

  it('toggles the hotkey mode on click', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ hotkey: { ...DEFAULT_HOTKEY, mode: 'hold' } }, onUpdate)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Toggle (Shortcut)' }))
    expect(onUpdate).toHaveBeenCalledWith({
      hotkey: { ...DEFAULT_HOTKEY, mode: 'toggle' }
    })
  })

  it('updates the helper text based on the current mode', () => {
    const { rerender } = renderPanel({ hotkey: { ...DEFAULT_HOTKEY, mode: 'hold' } })
    expect(screen.getByText(/Hold the key while speaking/)).toBeInTheDocument()
    rerender(
      <HotkeyPanel
        settings={makeSettings({ hotkey: { ...DEFAULT_HOTKEY, mode: 'toggle' } })}
        onUpdate={vi.fn()}
      />
    )
    expect(screen.getByText(/Press the hotkey once/)).toBeInTheDocument()
  })

  it('renders all 6 hotkey options', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Right Option (⌥)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left Option (⌥)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Right Command (⌘)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left Command (⌘)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Right Control (⌃)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left Control (⌃)' })).toBeInTheDocument()
  })

  it('highlights the currently selected hotkey keycode', () => {
    renderPanel({ hotkey: { ...DEFAULT_HOTKEY, keycode: 56, label: 'Left Option (⌥)', accelerator: 'Alt+Shift+Space' } })
    const selected = screen.getByRole('button', { name: 'Left Option (⌥)' })
    expect(selected.className).toContain('btn-primary')
  })

  it('changes the keycode/label/accelerator on hotkey option click', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Right Command (⌘)' }))
    expect(onUpdate).toHaveBeenCalledWith({
      hotkey: {
        ...DEFAULT_HOTKEY,
        keycode: 3676,
        label: 'Right Command (⌘)',
        accelerator: 'Command+Shift+Space'
      }
    })
  })

  it('"Reset to Default" restores the default hotkey', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ hotkey: { ...DEFAULT_HOTKEY, mode: 'toggle', keycode: 99 } }, onUpdate)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reset to Default' }))
    expect(onUpdate).toHaveBeenCalledWith({ hotkey: DEFAULT_HOTKEY })
  })
})
