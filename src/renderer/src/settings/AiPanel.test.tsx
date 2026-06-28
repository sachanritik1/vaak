import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiPanel } from './AiPanel'
import { makeSettings } from '../test/fixtures'
import { DEFAULT_AI_CONFIG } from '../../../shared/types'

const renderPanel = (overrides = {}, onUpdate = vi.fn().mockResolvedValue(undefined)) => {
  const settings = makeSettings(overrides)
  const utils = render(<AiPanel settings={settings} onUpdate={onUpdate} />)
  return { ...utils, settings, onUpdate }
}

describe('AiPanel', () => {
  it('renders the title and a description', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'AI Cleanup', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/Optionally clean up dictated text/)).toBeInTheDocument()
  })

  it('renders the "Enable AI cleanup" checkbox unchecked by default', () => {
    renderPanel()
    const checkbox = screen.getByRole('checkbox', { name: /Enable AI cleanup/ })
    expect(checkbox).not.toBeChecked()
  })

  it('checks the checkbox when enabled=true', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true } })
    const checkbox = screen.getByRole('checkbox', { name: /Enable AI cleanup/ })
    expect(checkbox).toBeChecked()
  })

  it('toggles the enabled flag on checkbox change', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({}, onUpdate)
    await userEvent.setup().click(screen.getByRole('checkbox', { name: /Enable AI cleanup/ }))
    expect(onUpdate).toHaveBeenCalledWith({ ai: { ...DEFAULT_AI_CONFIG, enabled: true } })
  })

  it('does NOT render the provider selector when disabled', () => {
    renderPanel()
    expect(screen.queryByText('Provider')).not.toBeInTheDocument()
  })

  it('renders the 4 provider buttons when enabled', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true } })
    expect(screen.getByRole('button', { name: 'Ollama' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OpenAI' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anthropic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OpenRouter' })).toBeInTheDocument()
  })

  it('highlights the active provider', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'openai' } })
    const openai = screen.getByRole('button', { name: 'OpenAI' })
    expect(openai.className).toContain('btn-primary')
  })

  it('changes the provider on click', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'ollama' } }, onUpdate)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Anthropic' }))
    expect(onUpdate).toHaveBeenCalledWith({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'anthropic' } })
  })

  it('renders the Ollama inputs when provider=ollama', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'ollama' } })
    expect(screen.getByPlaceholderText('http://localhost:11434')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('llama3.2')).toBeInTheDocument()
  })

  it('renders the OpenAI inputs when provider=openai', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'openai' } })
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('gpt-4o-mini')).toBeInTheDocument()
  })

  it('renders the Anthropic inputs when provider=anthropic', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'anthropic' } })
    expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('claude-3-5-haiku-20241022')).toBeInTheDocument()
  })

  it('renders the OpenRouter inputs when provider=openrouter', () => {
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'openrouter' } })
    expect(screen.getByPlaceholderText('sk-or-...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('openai/gpt-4o-mini')).toBeInTheDocument()
  })

  it('updates the ollamaUrl on input change', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'ollama' } }, onUpdate)
    const input = screen.getByPlaceholderText('http://localhost:11434')
    await userEvent.setup().type(input, 'x')
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ai: expect.objectContaining({ ollamaUrl: expect.stringContaining('x') })
      })
    )
  })

  it('updates the openaiApiKey on input change', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ ai: { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'openai' } }, onUpdate)
    const input = screen.getByPlaceholderText('sk-...')
    await userEvent.setup().type(input, 'k')
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ai: expect.objectContaining({ openaiApiKey: expect.stringContaining('k') })
      })
    )
  })
})
