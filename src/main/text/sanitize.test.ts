import { describe, it, expect } from 'vitest'
import { sanitizeTranscription, isEngineLogLine } from './sanitize'

describe('sanitizeTranscription', () => {
  describe('empty / whitespace input', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeTranscription('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizeTranscription('   \n\n  \t')).toBe('')
    })
  })

  describe('JSON extraction', () => {
    it('extracts text from pure JSON', () => {
      expect(sanitizeTranscription('{"text": "hello world"}')).toBe('hello world')
    })

    it('preserves punctuation from JSON text', () => {
      expect(sanitizeTranscription('{"text":"Hello, world!"}')).toBe('Hello, world!')
    })

    it('extracts text when JSON is the last non-log line', () => {
      const input = 'ggml_metal_init: loading\nwhisper_init: ready\n{"text": "the actual speech"}'
      expect(sanitizeTranscription(input)).toBe('the actual speech')
    })

    it('returns the speech lines when input has a JSON-like fragment mixed with prose', () => {
      // When the JSON-ish line doesn't start with '{', extractTextField takes
      // the speech-lines fallback path and the embedded-JSON substring regex
      // is never reached. Sanity-check the current contract rather than guess.
      const input = 'whisper_init: ready\n"text": "embedded speech"'
      expect(sanitizeTranscription(input)).toContain('embedded speech')
    })

    it('strips leading JSON object prefix and trailing fields', () => {
      const input = '{"text": "kept text", "words": [{"word": "kept"}]}'
      expect(sanitizeTranscription(input)).toBe('kept text')
    })

    it('strips trailing tokens field', () => {
      const input = '{"text": "kept text", "tokens": [1,2,3]}'
      expect(sanitizeTranscription(input)).toBe('kept text')
    })
  })

  describe('engine log line stripping', () => {
    it('strips ggml_metal_free deallocating logs', () => {
      const input = 'ggml_metal_free: deallocating\nhello there'
      expect(sanitizeTranscription(input)).toBe('hello there')
    })

    it('strips whisper_init logs', () => {
      const input = 'whisper_init: loading model\nactual speech'
      expect(sanitizeTranscription(input)).toBe('actual speech')
    })

    it('strips parakeet and sherpa logs', () => {
      const input = 'parakeet_init: ready\nsherpa_init: ready\nreal speech'
      expect(sanitizeTranscription(input)).toBe('real speech')
    })

    it('strips Real time factor and Elapsed seconds lines', () => {
      const input = 'Real time factor (RTF): 0.123\nElapsed seconds: 5.0\nhello there'
      expect(sanitizeTranscription(input)).toBe('hello there')
    })

    it('strips OfflineRecognizerConfig and parse-options lines', () => {
      const input =
        'OfflineRecognizerConfig(blah)\n/parse-options.cc:123 done\nactual text'
      expect(sanitizeTranscription(input)).toBe('actual text')
    })

    it('strips bare wav paths', () => {
      const input = '/tmp/audio/recording.wav\nthe speech'
      expect(sanitizeTranscription(input)).toBe('the speech')
    })

    it('strips the dash separator', () => {
      const input = '----\nreal text'
      expect(sanitizeTranscription(input)).toBe('real text')
    })

    it('strips identifier: message engine logs', () => {
      const input = 'metal_device: initializing\nreal text'
      expect(sanitizeTranscription(input)).toBe('real text')
    })
  })

  describe('bracketed/parenthetical non-speech markers', () => {
    it('strips [inaudible]', () => {
      expect(sanitizeTranscription('hello [inaudible] world')).toBe('hello world')
    })

    it('strips [music], [silence], [blank audio]', () => {
      expect(sanitizeTranscription('before [music] after')).toBe('before after')
      expect(sanitizeTranscription('a [blank audio] b')).toBe('a b')
      expect(sanitizeTranscription('x [silence] y')).toBe('x y')
    })

    it('strips (inaudible), (music) parentheticals', () => {
      expect(sanitizeTranscription('a (inaudible) b')).toBe('a b')
      expect(sanitizeTranscription('x (music) y')).toBe('x y')
    })

    it('strips *inaudible* asterisk markers', () => {
      expect(sanitizeTranscription('a *inaudible* b')).toBe('a b')
    })

    it('strips the markers regardless of surrounding whitespace', () => {
      expect(sanitizeTranscription('[inaudible] hello world')).toBe('hello world')
      expect(sanitizeTranscription('hello world [inaudible]')).toBe('hello world')
    })
  })

  describe('silence hallucination filtering', () => {
    it.each([
      'Thank you',
      'Thank you.',
      'Thank you!',
      'Thank you for watching',
      'thanks for watching',
      'Subscribe',
      'Subtitle by',
      'Inaudible',
      'Silence',
      'Blank audio',
      'Music',
      'Applause'
    ])('filters out hallucination: %s', (input) => {
      expect(sanitizeTranscription(input)).toBe('')
    })

    it('does NOT filter out real sentences that contain "thank"', () => {
      expect(sanitizeTranscription('Thank you for the help with this.')).toBe(
        'Thank you for the help with this.'
      )
    })
  })

  describe('whitespace normalization', () => {
    it('collapses multiple spaces', () => {
      expect(sanitizeTranscription('hello    world')).toBe('hello world')
    })

    it('joins multi-line speech with single spaces', () => {
      expect(sanitizeTranscription('hello\nworld')).toBe('hello world')
    })

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeTranscription('   hello   ')).toBe('hello')
    })
  })
})

describe('isEngineLogLine', () => {
  it('returns true for empty/whitespace lines', () => {
    expect(isEngineLogLine('')).toBe(true)
    expect(isEngineLogLine('   ')).toBe(true)
  })

  it('identifies ggml/llama/whisper/parakeet/sherpa log lines', () => {
    expect(isEngineLogLine('ggml_metal_init: foo')).toBe(true)
    expect(isEngineLogLine('whisper_init: ready')).toBe(true)
    expect(isEngineLogLine('llama_load: model')).toBe(true)
    expect(isEngineLogLine('parakeet_init: ok')).toBe(true)
    expect(isEngineLogLine('sherpa-onnx: ready')).toBe(true)
  })

  it('identifies engine messages with identifier: prefix', () => {
    expect(isEngineLogLine('whisper_backend_init: loading')).toBe(true)
    expect(isEngineLogLine('ggml_metal_free: deallocating')).toBe(true)
  })

  it('identifies OfflineRecognizerConfig and parse-options lines', () => {
    expect(isEngineLogLine('OfflineRecognizerConfig(blah)')).toBe(true)
    expect(isEngineLogLine('/parse-options.cc:123 done')).toBe(true)
  })

  it('identifies Real time factor and Elapsed seconds', () => {
    expect(isEngineLogLine('Real time factor (RTF): 0.123')).toBe(true)
    expect(isEngineLogLine('Elapsed seconds: 5.0')).toBe(true)
  })

  it('identifies bare wav paths', () => {
    expect(isEngineLogLine('/tmp/audio/recording.wav')).toBe(true)
  })

  it('identifies the dash separator', () => {
    expect(isEngineLogLine('----')).toBe(true)
  })

  it('returns false for real speech lines', () => {
    expect(isEngineLogLine('hello world')).toBe(false)
    expect(isEngineLogLine('The quick brown fox.')).toBe(false)
  })

  it('returns false for a sentence that does not start with an engine keyword', () => {
    expect(isEngineLogLine('the engine ran fine today')).toBe(false)
  })

  it('returns true for lines that begin with a known engine prefix', () => {
    expect(isEngineLogLine('parakeet: ready')).toBe(true)
  })
})
