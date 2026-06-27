import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: (_key: string) => '/tmp/vaak-test' }
}))

// Re-implementation of the private parakeet-cli stdout parser for unit
// testing. The source-of-truth lives in src/main/stt/parakeet-cli-binary.ts.
import { isEngineLogLine } from '../text/sanitize'

function parseParakeetStdout(combined: string): string {
  if (!combined) return ''
  const lines = combined
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (!lines[i].startsWith('{')) continue
    try {
      const parsed = JSON.parse(lines[i]) as { text?: string }
      if (parsed.text?.trim()) return parsed.text.trim()
    } catch {
      // try next
    }
  }
  const lastLine =
    [...lines].reverse().find((l) => !isEngineLogLine(l) && !l.startsWith('{')) ?? ''
  if (lastLine.startsWith('{')) return ''
  return lastLine
}

describe('parakeet-cli stdout parser', () => {
  it('extracts text from a pure JSON line', () => {
    expect(parseParakeetStdout('{"text":"hello"}')).toBe('hello')
  })

  it('prefers the last non-log JSON line', () => {
    const out = 'whisper_init: ready\n{"text":"first"}\n{"text":"second"}'
    expect(parseParakeetStdout(out)).toBe('second')
  })

  it('skips engine log lines when looking for JSON', () => {
    const out = 'ggml_metal: init\n{"text":"the speech"}'
    expect(parseParakeetStdout(out)).toBe('the speech')
  })

  it('falls back to a plain-text non-log line', () => {
    expect(parseParakeetStdout('whisper_init: ready\nplain text answer')).toBe('plain text answer')
  })

  it('returns empty string for empty input', () => {
    expect(parseParakeetStdout('')).toBe('')
  })

  it('returns empty when only engine log lines are present', () => {
    expect(parseParakeetStdout('whisper_init: ready\n----')).toBe('')
  })

  it('ignores JSON lines that are missing a non-empty text field', () => {
    const out = '{"text":""}\n{"text":"   "}\n{"text":"real text"}'
    expect(parseParakeetStdout(out)).toBe('real text')
  })

  it('skips malformed JSON lines and tries the next', () => {
    const out = '{not:valid json}\n{"text":"recovered"}'
    expect(parseParakeetStdout(out)).toBe('recovered')
  })
})
