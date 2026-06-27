import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit } from 'effect'
import { AiCleanupService, AiCleanupLive } from './index'
import { cleanupWithOllama } from './ollama'
import { cleanupWithOpenAI } from './openai'
import { cleanupWithAnthropic } from './anthropic'
import { cleanupWithOpenRouter } from './openrouter'
import type { AiConfig } from '../../shared/types'
import { DEFAULT_AI_CONFIG } from '../../shared/types'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

const makeResponse = (body: string, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(body)
  }) as Response

beforeEach(() => {
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AiCleanupLive — cleanupText dispatcher', () => {
  itEffect('returns input unchanged when disabled', () =>
    Effect.gen(function* () {
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('hello', { ...DEFAULT_AI_CONFIG, enabled: false, provider: 'ollama' })
      expectEffect(out).toBe('hello')
      expectEffect(fetchMock).not.toHaveBeenCalled()
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('returns input unchanged when provider is "none"', () =>
    Effect.gen(function* () {
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('hello', { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'none' })
      expectEffect(out).toBe('hello')
      expectEffect(fetchMock).not.toHaveBeenCalled()
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('returns input unchanged for empty/whitespace text', () =>
    Effect.gen(function* () {
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('   ', { ...DEFAULT_AI_CONFIG, enabled: true, provider: 'ollama' })
      expectEffect(out).toBe('   ')
      expectEffect(fetchMock).not.toHaveBeenCalled()
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('falls back to raw text when provider throws (catch)', () =>
    Effect.gen(function* () {
      // Ollama endpoint fails (network down)
      fetchMock.mockRejectedValue(new Error('network down'))
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('hello world', {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: 'ollama'
      })
      expectEffect(out).toBe('hello world')
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('falls back to raw text when provider returns non-OK status', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(makeResponse('server error', 500))
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('hello', {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: 'ollama'
      })
      expectEffect(out).toBe('hello')
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('dispatches to ollama when provider="ollama" and returns cleaned text', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(makeResponse(JSON.stringify({ response: 'cleaned text' })))
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('raw text', {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: 'ollama',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3.2'
      })
      expectEffect(out).toBe('cleaned text')
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expectEffect(url).toBe('http://localhost:11434/api/generate')
      expectEffect(init.method).toBe('POST')
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('dispatches to openai when provider="openai" and returns cleaned text', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        makeResponse(
          JSON.stringify({ choices: [{ message: { content: 'openai cleaned' } }] })
        )
      )
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('raw', {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: 'openai',
        openaiApiKey: 'sk-test',
        openaiModel: 'gpt-4o-mini'
      })
      expectEffect(out).toBe('openai cleaned')
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expectEffect(url).toBe('https://api.openai.com/v1/chat/completions')
      const headers = init.headers as Record<string, string>
      expectEffect(headers.Authorization).toBe('Bearer sk-test')
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('dispatches to anthropic when provider="anthropic" and returns cleaned text', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        makeResponse(JSON.stringify({ content: [{ type: 'text', text: 'anthropic cleaned' }] }))
      )
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('raw', {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: 'anthropic',
        anthropicApiKey: 'sk-ant',
        anthropicModel: 'claude-3-5-haiku-20241022'
      })
      expectEffect(out).toBe('anthropic cleaned')
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expectEffect(url).toBe('https://api.anthropic.com/v1/messages')
      const headers = init.headers as Record<string, string>
      expectEffect(headers['x-api-key']).toBe('sk-ant')
      expectEffect(headers['anthropic-version']).toBe('2023-06-01')
    }).pipe(Effect.provide(AiCleanupLive))
  )

  itEffect('dispatches to openrouter when provider="openrouter" and returns cleaned text', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        makeResponse(
          JSON.stringify({ choices: [{ message: { content: 'or cleaned' } }] })
        )
      )
      const svc = yield* AiCleanupService
      const out = yield* svc.cleanupText('raw', {
        ...DEFAULT_AI_CONFIG,
        enabled: true,
        provider: 'openrouter',
        openrouterApiKey: 'sk-or',
        openrouterModel: 'openai/gpt-4o-mini'
      })
      expectEffect(out).toBe('or cleaned')
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expectEffect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
      const headers = init.headers as Record<string, string>
      expectEffect(headers.Authorization).toBe('Bearer sk-or')
      expectEffect(headers['HTTP-Referer']).toBe('https://github.com/OpenWhisper')
      expectEffect(headers['X-Title']).toBe('Vaak')
    }).pipe(Effect.provide(AiCleanupLive))
  )
})

describe('Ollama provider — cleanupWithOllama', () => {
  itEffect('strips trailing slash from ollamaUrl before appending /api/generate', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(makeResponse(JSON.stringify({ response: 'ok' })))
      const out = yield* cleanupWithOllama('raw', {
        ...DEFAULT_AI_CONFIG,
        ollamaUrl: 'http://localhost:11434/',
        ollamaModel: 'llama3.2'
      }, 'SYSTEM ')
      expectEffect(out).toBe('ok')
      const [url] = fetchMock.mock.calls[0] as [string]
      expectEffect(url).toBe('http://localhost:11434/api/generate')
    })
  )

  itEffect('falls back to raw text when response field is missing', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(makeResponse(JSON.stringify({ unrelated: 'x' })))
      const out = yield* cleanupWithOllama('my raw', {
        ...DEFAULT_AI_CONFIG,
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama3.2'
      }, 'PROMPT')
      expectEffect(out).toBe('my raw')
    })
  )
})

describe('OpenAI provider — cleanupWithOpenAI', () => {
  itEffect('fails with AiCleanupError when API key is missing', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(cleanupWithOpenAI('x', DEFAULT_AI_CONFIG, 'P'))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )

  itEffect('falls back to raw text when choices array is empty', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(makeResponse(JSON.stringify({ choices: [] })))
      const out = yield* cleanupWithOpenAI('raw input', {
        ...DEFAULT_AI_CONFIG,
        openaiApiKey: 'k',
        openaiModel: 'gpt-4o-mini'
      }, 'P')
      expectEffect(out).toBe('raw input')
    })
  )
})

describe('Anthropic provider — cleanupWithAnthropic', () => {
  itEffect('fails with AiCleanupError when API key is missing', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(cleanupWithAnthropic('x', DEFAULT_AI_CONFIG, 'P'))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )

  itEffect('selects the first text block from the content array', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        makeResponse(
          JSON.stringify({
            content: [
              { type: 'tool_use', text: 'ignore me' },
              { type: 'text', text: 'real answer' }
            ]
          })
        )
      )
      const out = yield* cleanupWithAnthropic('raw', {
        ...DEFAULT_AI_CONFIG,
        anthropicApiKey: 'k',
        anthropicModel: 'claude-3-5-haiku-20241022'
      }, 'P')
      expectEffect(out).toBe('real answer')
    })
  )

  itEffect('falls back to raw text when no text block is present', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(
        makeResponse(JSON.stringify({ content: [{ type: 'tool_use', text: 'x' }] }))
      )
      const out = yield* cleanupWithAnthropic('fallback', {
        ...DEFAULT_AI_CONFIG,
        anthropicApiKey: 'k',
        anthropicModel: 'claude-3-5-haiku-20241022'
      }, 'P')
      expectEffect(out).toBe('fallback')
    })
  )
})

describe('OpenRouter provider — cleanupWithOpenRouter', () => {
  itEffect('fails with AiCleanupError when API key is missing', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(cleanupWithOpenRouter('x', DEFAULT_AI_CONFIG, 'P'))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )

  itEffect('falls back to raw text when response has no choices', () =>
    Effect.gen(function* () {
      fetchMock.mockResolvedValue(makeResponse(JSON.stringify({ choices: [] })))
      const out = yield* cleanupWithOpenRouter('raw', {
        ...DEFAULT_AI_CONFIG,
        openrouterApiKey: 'k',
        openrouterModel: 'm'
      }, 'P')
      expectEffect(out).toBe('raw')
    })
  )
})
