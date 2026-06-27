import { Context, Effect, Layer } from 'effect'
import type { AiConfig } from '../../shared/types'
import { cleanupWithOllama } from './ollama'
import { cleanupWithOpenAI } from './openai'
import { cleanupWithAnthropic } from './anthropic'
import { cleanupWithOpenRouter } from './openrouter'

const CLEANUP_PROMPT = `You are a voice dictation cleanup assistant. Clean up the following dictated text:
- Remove filler words (um, uh, like, you know)
- Fix grammar and punctuation
- Preserve the speaker's meaning and tone
- Do NOT add new information
- Return ONLY the cleaned text, no explanation

Text:
`

/**
 * AiCleanupService runs optional LLM cleanup of raw transcription text.
 * On any provider failure it falls back to the raw text (mirrors the
 * original `try/catch` behavior) via `Effect.catchAll`.
 */
export interface AiCleanupService {
  readonly cleanupText: (text: string, config: AiConfig) => Effect.Effect<string>
}

export const AiCleanupService = Context.Service<AiCleanupService>('@vaak/AiCleanup')

export const AiCleanupLive = Layer.succeed(AiCleanupService)({
  cleanupText: (text, config) =>
    Effect.gen(function* () {
      if (!config.enabled || config.provider === 'none' || !text.trim()) {
        return text
      }

      const cleaned = yield* Effect.gen(function* () {
        switch (config.provider) {
          case 'ollama':
            return yield* cleanupWithOllama(text, config, CLEANUP_PROMPT)
          case 'openai':
            return yield* cleanupWithOpenAI(text, config, CLEANUP_PROMPT)
          case 'anthropic':
            return yield* cleanupWithAnthropic(text, config, CLEANUP_PROMPT)
          case 'openrouter':
            return yield* cleanupWithOpenRouter(text, config, CLEANUP_PROMPT)
          default:
            return text
        }
      }).pipe(Effect.catch(() => Effect.succeed(text)))

      return cleaned
    })
})
