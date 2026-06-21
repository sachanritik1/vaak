import type { AiConfig } from '../../shared/types'
import { cleanupWithOllama } from './ollama'
import { cleanupWithOpenAI } from './openai'
import { cleanupWithAnthropic } from './anthropic'

const CLEANUP_PROMPT = `You are a voice dictation cleanup assistant. Clean up the following dictated text:
- Remove filler words (um, uh, like, you know)
- Fix grammar and punctuation
- Preserve the speaker's meaning and tone
- Do NOT add new information
- Return ONLY the cleaned text, no explanation

Text:
`

export async function cleanupText(text: string, config: AiConfig): Promise<string> {
  if (!config.enabled || config.provider === 'none' || !text.trim()) {
    return text
  }

  try {
    switch (config.provider) {
      case 'ollama':
        return await cleanupWithOllama(text, config, CLEANUP_PROMPT)
      case 'openai':
        return await cleanupWithOpenAI(text, config, CLEANUP_PROMPT)
      case 'anthropic':
        return await cleanupWithAnthropic(text, config, CLEANUP_PROMPT)
      default:
        return text
    }
  } catch (err) {
    console.error('AI cleanup failed, using raw transcription:', err)
    return text
  }
}

export { cleanupWithOllama } from './ollama'
export { cleanupWithOpenAI } from './openai'
export { cleanupWithAnthropic } from './anthropic'
