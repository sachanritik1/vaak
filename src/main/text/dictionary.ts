import type { DictionaryEntry } from '../../shared/types'

export function buildWhisperPrompt(dictionary: DictionaryEntry[]): string {
  if (dictionary.length === 0) return ''
  const words = dictionary.map((d) => d.word).filter(Boolean)
  return words.join(', ')
}

export function applyDictionary(text: string, dictionary: DictionaryEntry[]): string {
  let result = text
  for (const entry of dictionary) {
    if (entry.replacement) {
      const regex = new RegExp(`\\b${escapeRegex(entry.word)}\\b`, 'gi')
      result = result.replace(regex, entry.replacement)
    }
  }
  return result
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
