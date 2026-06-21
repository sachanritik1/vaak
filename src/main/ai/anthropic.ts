import type { AiConfig } from '../../shared/types'

export async function cleanupWithAnthropic(
  text: string,
  config: AiConfig,
  systemPrompt: string
): Promise<string> {
  if (!config.anthropicApiKey) {
    throw new Error('Anthropic API key not configured')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error: ${response.status} ${err}`)
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const block = data.content?.find((c) => c.type === 'text')
  return block?.text?.trim() ?? text
}
