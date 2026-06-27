import { describe, it, expect } from 'vitest'
import { buildWhisperPrompt, applyDictionary } from './dictionary'
import type { DictionaryEntry } from '../../shared/types'

describe('buildWhisperPrompt', () => {
  it('returns empty string for empty dictionary', () => {
    expect(buildWhisperPrompt([])).toBe('')
  })

  it('joins single word', () => {
    expect(buildWhisperPrompt([{ word: 'kubernetes' }])).toBe('kubernetes')
  })

  it('joins multiple words with comma-space', () => {
    const dict: DictionaryEntry[] = [
      { word: 'kubernetes' },
      { word: 'kafka' },
      { word: 'graphql' }
    ]
    expect(buildWhisperPrompt(dict)).toBe('kubernetes, kafka, graphql')
  })

  it('filters out empty-word entries', () => {
    const dict: DictionaryEntry[] = [
      { word: 'kubernetes' },
      { word: '' },
      { word: 'kafka' }
    ]
    expect(buildWhisperPrompt(dict)).toBe('kubernetes, kafka')
  })

  it('returns empty when all entries have empty words', () => {
    const dict: DictionaryEntry[] = [{ word: '' }, { word: '' }]
    expect(buildWhisperPrompt(dict)).toBe('')
  })

  it('preserves words with replacement (whisper prompt uses word, not replacement)', () => {
    expect(buildWhisperPrompt([{ word: 'k8s', replacement: 'kubernetes' }])).toBe('k8s')
  })
})

describe('applyDictionary', () => {
  it('returns text unchanged for empty dictionary', () => {
    expect(applyDictionary('hello world', [])).toBe('hello world')
  })

  it('replaces a single word case-insensitively', () => {
    const dict: DictionaryEntry[] = [{ word: 'kubernetes', replacement: 'K8s' }]
    expect(applyDictionary('I use Kubernetes daily', dict)).toBe('I use K8s daily')
  })

  it('replaces all occurrences of a word', () => {
    const dict: DictionaryEntry[] = [{ word: 'foo', replacement: 'bar' }]
    expect(applyDictionary('foo and foo and foo', dict)).toBe('bar and bar and bar')
  })

  it('respects word boundaries', () => {
    const dict: DictionaryEntry[] = [{ word: 'cat', replacement: 'dog' }]
    expect(applyDictionary('a cat is not a catty comment', dict)).toBe(
      'a dog is not a catty comment'
    )
  })

  it('handles multiple dictionary entries', () => {
    const dict: DictionaryEntry[] = [
      { word: 'k8s', replacement: 'Kubernetes' },
      { word: 'js', replacement: 'JavaScript' }
    ]
    expect(applyDictionary('I write k8s and js', dict)).toBe('I write Kubernetes and JavaScript')
  })

  it('skips entries without a replacement', () => {
    const dict: DictionaryEntry[] = [{ word: 'foo' }]
    expect(applyDictionary('foo bar', dict)).toBe('foo bar')
  })

  it('escapes regex special characters in the word', () => {
    const dict: DictionaryEntry[] = [{ word: 'a.b', replacement: 'X' }]
    expect(applyDictionary('a.b a-b aXb', dict)).toBe('X a-b aXb')
  })

  it('handles words with regex special characters (documenting word-boundary limitation)', () => {
    // `\b` in the regex requires transitions between word and non-word chars.
    // Words that start or end with non-word chars (e.g. `c++`, `(test)`) don't
    // get replaced when surrounded by spaces because the trailing `\b` can't
    // anchor across the non-word boundary. Verify the documented behavior.
    const dict: DictionaryEntry[] = [
      { word: 'c++', replacement: 'CPP' },
      { word: '(test)', replacement: 'TEST' }
    ]
    expect(applyDictionary('I write c++ and (test) things', dict)).toBe(
      'I write c++ and (test) things'
    )
    // Words composed only of word chars (e.g. `cplusplus`) ARE replaced
    expect(applyDictionary('I write cplusplus', [{ word: 'cplusplus', replacement: 'CPP' }])).toBe(
      'I write CPP'
    )
  })
})
