import { Effect, Schema } from 'effect'
import type { AiConfig } from '../../shared/types'
import { AiCleanupError } from '../errors'

const OpenAiResponseSchema = Schema.Struct({
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

export function cleanupWithOpenAI(
  text: string,
  config: AiConfig,
  systemPrompt: string
): Effect.Effect<string, AiCleanupError> {
  if (!config.openaiApiKey) {
    return Effect.fail(
      new AiCleanupError({ provider: 'openai', error: new Error('OpenAI API key not configured') })
    )
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openaiApiKey}`
          },
          body: JSON.stringify({
            model: config.openaiModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text }
            ],
            temperature: 0.3
          })
        }),
      catch: (cause) => new AiCleanupError({ provider: 'openai', error: cause })
    })

    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) => new AiCleanupError({ provider: 'openai', error: cause })
    })

    if (!response.ok) {
      return yield* new AiCleanupError({
        provider: 'openai',
        error: new Error(`OpenAI error: ${response.status} ${body}`)
      })
    }

    const parsed = yield* Schema.decodeUnknownEffect(OpenAiResponseSchema)(
      JSON.parse(body)
    ).pipe(
      Effect.mapError(
        (cause) => new AiCleanupError({ provider: 'openai', error: new Error(String(cause)) })
      )
    )

    return parsed.choices?.[0]?.message?.content?.trim() ?? text
  })
}
