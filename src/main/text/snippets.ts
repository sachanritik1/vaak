import type { Snippet } from '../../shared/types'

export function expandSnippets(text: string, snippets: Snippet[]): string {
  const result = text.trim()
  for (const snippet of snippets) {
    const trigger = snippet.trigger.trim()
    if (!trigger) continue
    if (fuzzyPhraseMatch(result, trigger)) {
      return snippet.content
    }
    if (fuzzyPhrasePrefix(result, trigger)) {
      return snippet.content
    }
  }
  return result
}

function fuzzyPhraseMatch(text: string, trigger: string): boolean {
  const textWords = tokenize(text)
  const triggerWords = tokenize(trigger)
  if (textWords.length !== triggerWords.length) return false
  return triggerWords.every((word, i) => wordsFuzzyEqual(word, textWords[i]))
}

function fuzzyPhrasePrefix(text: string, trigger: string): boolean {
  const textWords = tokenize(text)
  const triggerWords = tokenize(trigger)
  if (textWords.length <= triggerWords.length) return false
  return triggerWords.every((word, i) => wordsFuzzyEqual(word, textWords[i]))
}

function tokenize(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?;:]+$/, ''))
    .filter(Boolean)
}

function wordsFuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true
  const len = Math.min(a.length, b.length)
  if (len < 4) return false
  const maxDistance = len <= 5 ? 1 : 2
  return levenshtein(a, b) <= maxDistance
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }

  return prev[b.length]
}
