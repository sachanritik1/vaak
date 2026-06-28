import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SnippetsPanel } from './SnippetsPanel'
import { makeSettings } from '../test/fixtures'

// Mock crypto.randomUUID so we get stable ids
let nextUuid = 0
const uuidValues: string[] = []

beforeEach(() => {
  nextUuid = 0
  uuidValues.length = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    const v = `uuid-${nextUuid++}`
    uuidValues.push(v)
    return v as `${string}-${string}-${string}-${string}-${string}`
  })
})

const renderPanel = (overrides = {}, onUpdate = vi.fn().mockResolvedValue(undefined)) => {
  const settings = makeSettings(overrides)
  const utils = render(<SnippetsPanel settings={settings} onUpdate={onUpdate} />)
  return { ...utils, settings, onUpdate }
}

describe('SnippetsPanel', () => {
  it('renders the title and a description', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Snippets', level: 2 })).toBeInTheDocument()
  })

  it('renders the trigger + content inputs', () => {
    renderPanel()
    expect(screen.getByPlaceholderText(/Trigger phrase/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full text to insert')).toBeInTheDocument()
  })

  it('disables the Add button when either field is empty', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Add Snippet' })).toBeDisabled()
  })

  it('enables the Add button when both fields are filled', async () => {
    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Trigger phrase/), 'my addr')
    await user.type(screen.getByPlaceholderText('Full text to insert'), '123 Main St')
    expect(screen.getByRole('button', { name: 'Add Snippet' })).toBeEnabled()
  })

  it('adds a snippet with a generated id and trimmed values', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Trigger phrase/), '  my trigger  ')
    await user.type(screen.getByPlaceholderText('Full text to insert'), '  my content  ')
    await user.click(screen.getByRole('button', { name: 'Add Snippet' }))
    expect(onUpdate).toHaveBeenCalledWith({
      snippets: [{ id: 'uuid-0', trigger: 'my trigger', content: 'my content' }]
    })
  })

  it('clears the inputs after add', async () => {
    renderPanel()
    const user = userEvent.setup()
    const trigger = screen.getByPlaceholderText(/Trigger phrase/) as HTMLInputElement
    const content = screen.getByPlaceholderText('Full text to insert') as HTMLTextAreaElement
    await user.type(trigger, 'x')
    await user.type(content, 'y')
    await user.click(screen.getByRole('button', { name: 'Add Snippet' }))
    expect(trigger.value).toBe('')
    expect(content.value).toBe('')
  })

  it('does NOT add when trigger is whitespace-only', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Trigger phrase/), '   ')
    await user.type(screen.getByPlaceholderText('Full text to insert'), 'content')
    expect(screen.getByRole('button', { name: 'Add Snippet' })).toBeDisabled()
  })

  it('does NOT add when content is whitespace-only', async () => {
    renderPanel()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Trigger phrase/), 'my trigger')
    await user.type(screen.getByPlaceholderText('Full text to insert'), '   ')
    expect(screen.getByRole('button', { name: 'Add Snippet' })).toBeDisabled()
  })

  it('renders existing snippets with their trigger and content', () => {
    renderPanel({
      snippets: [{ id: 's1', trigger: 'my addr', content: '123 Main St' }]
    })
    expect(screen.getByText('"my addr"')).toBeInTheDocument()
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
  })

  it('does NOT render the Your Snippets card when empty', () => {
    renderPanel()
    expect(screen.queryByText('Your Snippets')).not.toBeInTheDocument()
  })

  it('removes a snippet by id on Remove click', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel(
      { snippets: [{ id: 'a', trigger: 'a', content: 'A' }, { id: 'b', trigger: 'b', content: 'B' }] },
      onUpdate
    )
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
    await userEvent.setup().click(removeButtons[0])
    expect(onUpdate).toHaveBeenCalledWith({
      snippets: [{ id: 'b', trigger: 'b', content: 'B' }]
    })
  })
})
