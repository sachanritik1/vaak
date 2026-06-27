import { Effect, Schema } from 'effect'
import type { AiConfig } from '../../shared/types'
import { AiCleanupError } from '../errors'

const OllamaResponseSchema = Schema.Struct({
  response: Schema.UndefinedOr(Schema.String)
})

export function cleanupWithOllama(
  text: string,
  config: AiConfig,
  systemPrompt: string
): Effect.Effect<string, AiCleanupError> {
  const url = `${config.ollamaUrl.replace(/\/$/, '')}/api/generate`

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.ollamaModel,
            prompt: `${systemPrompt}${text}`,
            stream: false
          })
        }),
      catch: (cause) => new AiCleanupError({ provider: 'ollama', error: cause })
    })

    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) => new AiCleanupError({ provider: 'ollama', error: cause })
    })

    if (!response.ok) {
      return yield* new AiCleanupError({
        provider: 'ollama',
        error: new Error(`Ollama error: ${response.status}`)
      })
    }

    const parsed = yield* Schema.decodeUnknownEffect(OllamaResponseSchema)(
      JSON.parse(body)
    ).pipe(
      Effect.mapError(
        (cause) => new AiCleanupError({ provider: 'ollama', error: new Error(String(cause)) })
      )
    )

    return (parsed.response ?? text).trim()
  })
}
