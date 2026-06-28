import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DictionaryPanel } from './DictionaryPanel'
import { makeSettings } from '../test/fixtures'

const renderPanel = (overrides = {}, onUpdate = vi.fn().mockResolvedValue(undefined)) => {
  const settings = makeSettings(overrides)
  const utils = render(<DictionaryPanel settings={settings} onUpdate={onUpdate} />)
  return { ...utils, settings, onUpdate }
}

describe('DictionaryPanel', () => {
  it('renders the title and a description', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Personal Dictionary', level: 2 })).toBeInTheDocument()
  })

  it('renders the word + replacement inputs', () => {
    renderPanel()
    expect(screen.getByPlaceholderText(/Word or phrase/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Replacement (optional)')).toBeInTheDocument()
  })

  it('disables the Add button when word is empty', () => {
    renderPanel()
    const addBtn = screen.getByRole('button', { name: 'Add' })
    expect(addBtn).toBeDisabled()
  })

  it('enables the Add button when word is non-empty', async () => {
    renderPanel()
    const wordInput = screen.getByPlaceholderText(/Word or phrase/)
    await userEvent.setup().type(wordInput, 'k8s')
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
  })

  it('adds an entry without replacement when only the word is set', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Word or phrase/), 'k8s')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onUpdate).toHaveBeenCalledWith({
      dictionary: [{ word: 'k8s', replacement: undefined }]
    })
  })

  it('adds an entry WITH replacement when both are set', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Word or phrase/), 'k8s')
    await user.type(screen.getByPlaceholderText('Replacement (optional)'), 'Kubernetes')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onUpdate).toHaveBeenCalledWith({
      dictionary: [{ word: 'k8s', replacement: 'Kubernetes' }]
    })
  })

  it('clears the input fields after a successful add', async () => {
    renderPanel()
    const user = userEvent.setup()
    const wordInput = screen.getByPlaceholderText(/Word or phrase/) as HTMLInputElement
    const replaceInput = screen.getByPlaceholderText('Replacement (optional)') as HTMLInputElement
    await user.type(wordInput, 'k8s')
    await user.type(replaceInput, 'Kubernetes')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(wordInput.value).toBe('')
    expect(replaceInput.value).toBe('')
  })

  it('does NOT add when word is whitespace-only', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    const user = userEvent.setup()
    const wordInput = screen.getByPlaceholderText(/Word or phrase/)
    await user.type(wordInput, '   ')
    const addBtn = screen.getByRole('button', { name: 'Add' })
    expect(addBtn).toBeDisabled()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('renders the existing dictionary list', () => {
    renderPanel({
      dictionary: [
        { word: 'k8s', replacement: 'Kubernetes' },
        { word: 'js' }
      ]
    })
    expect(screen.getByText('k8s')).toBeInTheDocument()
    expect(screen.getByText(/Kubernetes/)).toBeInTheDocument()
    expect(screen.getByText('js')).toBeInTheDocument()
  })

  it('does NOT render the Your Dictionary card when empty', () => {
    renderPanel()
    expect(screen.queryByText('Your Dictionary')).not.toBeInTheDocument()
  })

  it('removes an entry on Remove click', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel(
      { dictionary: [{ word: 'k8s' }, { word: 'js' }] },
      onUpdate
    )
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(onUpdate).toHaveBeenCalledWith({
      dictionary: [{ word: 'js' }]
    })
  })

  it('shows the replacement arrow only when replacement is set', () => {
    renderPanel({
      dictionary: [{ word: 'k8s', replacement: 'Kubernetes' }, { word: 'js' }]
    })
    // With replacement: arrow present
    expect(screen.getByText(/Kubernetes/)).toBeInTheDocument()
    // Without replacement: no arrow for that entry
    const jsEntry = screen.getByText('js').closest('div')
    expect(jsEntry?.textContent).not.toContain('→')
  })
})
