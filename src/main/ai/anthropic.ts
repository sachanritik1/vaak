import { Effect, Schema } from 'effect'
import type { AiConfig } from '../../shared/types'
import { AiCleanupError } from '../errors'

const AnthropicContentBlockSchema = Schema.Struct({
  type: Schema.String,
  text: Schema.UndefinedOr(Schema.String)
})

const AnthropicResponseSchema = Schema.Struct({
  content: Schema.UndefinedOr(Schema.Array(AnthropicContentBlockSchema))
})

export function cleanupWithAnthropic(
  text: string,
  config: AiConfig,
  systemPrompt: string
): Effect.Effect<string, AiCleanupError> {
  if (!config.anthropicApiKey) {
    return Effect.fail(
      new AiCleanupError({
        provider: 'anthropic',
        error: new Error('Anthropic API key not configured')
      })
    )
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.anthropicApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: config.anthropicModel,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: text }]
          })
        }),
      catch: (cause) => new AiCleanupError({ provider: 'anthropic', error: cause })
    })

    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) => new AiCleanupError({ provider: 'anthropic', error: cause })
    })

    if (!response.ok) {
      return yield* new AiCleanupError({
        provider: 'anthropic',
        error: new Error(`Anthropic error: ${response.status} ${body}`)
      })
    }

    const parsed = yield* Schema.decodeUnknownEffect(AnthropicResponseSchema)(
      JSON.parse(body)
    ).pipe(
      Effect.mapError(
        (cause) => new AiCleanupError({ provider: 'anthropic', error: new Error(String(cause)) })
      )
    )

    const block = parsed.content?.find((c) => c.type === 'text')
    return block?.text?.trim() ?? text
  })
}
