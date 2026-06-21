import type { AiConfig } from '../../shared/types'

export async function cleanupWithOllama(
  text: string,
  config: AiConfig,
  systemPrompt: string
): Promise<string> {
  const url = `${config.ollamaUrl.replace(/\/$/, '')}/api/generate`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt: `${systemPrompt}${text}`,
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`)
  }

  const data = (await response.json()) as { response?: string }
  return (data.response ?? text).trim()
}
