import { describe, it, expect } from 'vitest'
import { expandSnippets } from './snippets'
import type { Snippet } from '../../shared/types'

const make = (trigger: string, content: string, id = trigger): Snippet => ({
  id,
  trigger,
  content
})

describe('expandSnippets', () => {
  it('returns input unchanged when no snippets match', () => {
    const snippets = [make('hello', 'greeting')]
    expect(expandSnippets('goodbye world', snippets)).toBe('goodbye world')
  })

  it('returns input unchanged for empty snippet list', () => {
    expect(expandSnippets('hello world', [])).toBe('hello world')
  })

  it('expands an exact trigger match', () => {
    const snippets = [make('my address', '123 Main St, Anytown, USA')]
    expect(expandSnippets('my address', snippets)).toBe('123 Main St, Anytown, USA')
  })

  it('matches case-insensitively', () => {
    const snippets = [make('my address', '123 Main St')]
    expect(expandSnippets('MY ADDRESS', snippets)).toBe('123 Main St')
    expect(expandSnippets('My Address', snippets)).toBe('123 Main St')
  })

  it('trims input whitespace before matching', () => {
    const snippets = [make('my address', '123 Main St')]
    expect(expandSnippets('  my address  ', snippets)).toBe('123 Main St')
  })

  it('strips trailing punctuation from words when matching', () => {
    const snippets = [make('thanks', 'Thank you very much.')]
    expect(expandSnippets('thanks!', snippets)).toBe('Thank you very much.')
  })

  it('expands when text starts with the trigger (prefix match)', () => {
    const snippets = [make('my address', '123 Main St')]
    expect(expandSnippets('my address is private', snippets)).toBe('123 Main St')
  })

  it('fuzzy matches a misspelled prefix within Levenshtein threshold', () => {
    const snippets = [make('kubernetes', 'k8s platform')]
    expect(expandSnippets('kuberntes is great', snippets)).toBe('k8s platform')
  })

  it('fuzzy matches a misspelled exact match within Levenshtein threshold', () => {
    const snippets = [make('kubernetes', 'k8s platform')]
    expect(expandSnippets('kuberntes', snippets)).toBe('k8s platform')
  })

  it('does not match when fuzzy distance exceeds threshold for short words', () => {
    const snippets = [make('cat', 'feline')]
    expect(expandSnippets('dog', snippets)).toBe('dog')
  })

  it('skips snippets with empty trigger', () => {
    const snippets = [make('', 'should never match'), make('hi', 'greeting')]
    expect(expandSnippets('hi', snippets)).toBe('greeting')
  })

  it('returns the first matching snippet (priority by order)', () => {
    const snippets = [make('hello', 'first'), make('hello world', 'second')]
    expect(expandSnippets('hello', snippets)).toBe('first')
  })

  it('handles multi-word triggers', () => {
    const snippets = [make('my phone number', '555-1234')]
    expect(expandSnippets('my phone number', snippets)).toBe('555-1234')
  })

  it('tokenizes away trailing punctuation from triggers', () => {
    const snippets = [make('thanks', 'Thank you.')]
    expect(expandSnippets('thanks.', snippets)).toBe('Thank you.')
  })
})
