import type { Snippet } from '../../shared/types'

export function expandSnippets(text: string, snippets: Snippet[]): string {
  let result = text.trim()
  for (const snippet of snippets) {
    const trigger = snippet.trigger.trim()
    if (!trigger) continue
    if (result.toLowerCase() === trigger.toLowerCase()) {
      return snippet.content
    }
    if (result.toLowerCase().startsWith(trigger.toLowerCase() + ' ')) {
      return snippet.content
    }
  }
  return result
}
