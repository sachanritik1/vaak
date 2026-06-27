import { Effect, Schema } from 'effect'
import type { AiConfig } from '../../shared/types'
import { AiCleanupError } from '../errors'

const OpenRouterResponseSchema = Schema.Struct({
  choices: Schema.UndefinedOr(
    Schema.Array(
      Schema.Struct({
        message: Schema.UndefinedOr(
          Schema.Struct({ content: Schema.UndefinedOr(Schema.String) })
        )
      })
    )
  )
})

export function cleanupWithOpenRouter(
  text: string,
  config: AiConfig,
  systemPrompt: string
): Effect.Effect<string, AiCleanupError> {
  if (!config.openrouterApiKey) {
    return Effect.fail(
      new AiCleanupError({
        provider: 'openrouter',
        error: new Error('OpenRouter API key not configured')
      })
    )
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openrouterApiKey}`,
            'HTTP-Referer': 'https://github.com/OpenWhisper',
            'X-Title': 'Vaak'
          },
          body: JSON.stringify({
            model: config.openrouterModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text }
            ],
            temperature: 0.3
          })
        }),
      catch: (cause) => new AiCleanupError({ provider: 'openrouter', error: cause })
    })

    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) => new AiCleanupError({ provider: 'openrouter', error: cause })
    })

    if (!response.ok) {
      return yield* new AiCleanupError({
        provider: 'openrouter',
        error: new Error(`OpenRouter error: ${response.status} ${body}`)
      })
    }

    const parsed = yield* Schema.decodeUnknownEffect(OpenRouterResponseSchema)(
      JSON.parse(body)
    ).pipe(
      Effect.mapError(
        (cause) => new AiCleanupError({ provider: 'openrouter', error: new Error(String(cause)) })
      )
    )

    return parsed.choices?.[0]?.message?.content?.trim() ?? text
  })
}
