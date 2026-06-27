import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// sherpa-binary.ts imports from 'electron' at module top level. Mock the
// surface we don't exercise (app.getPath) so the module can load.
vi.mock('electron', () => ({
  app: { getPath: (_key: string) => '/tmp/vaak-test' }
}))

// Re-implement the private helpers here so we can test them in isolation
// without spinning up the real sherpa-onnx binary or the file system. The
// source-of-truth lives in src/main/stt/sherpa-binary.ts; this test pins
// the documented contract.
import { isEngineLogLine } from '../text/sanitize'
import type { SherpaManifest } from '../../shared/types'

function buildSherpaArgs(modelDir: string, manifest: SherpaManifest): string[] {
  const args = [
    '--num-threads=2',
    `--model-type=${manifest.modelType}`,
    `--tokens=${`${modelDir}/${manifest.tokens}`}`
  ]

  if (manifest.kind === 'moonshine') {
    if (manifest.preprocessor) args.push(`--moonshine-preprocessor=${modelDir}/${manifest.preprocessor}`)
    if (manifest.encoder) args.push(`--moonshine-encoder=${modelDir}/${manifest.encoder}`)
    if (manifest.uncachedDecoder) args.push(`--moonshine-uncached-decoder=${modelDir}/${manifest.uncachedDecoder}`)
    if (manifest.cachedDecoder) args.push(`--moonshine-cached-decoder=${modelDir}/${manifest.cachedDecoder}`)
  } else if (manifest.kind === 'sense-voice') {
    if (!manifest.model) throw new Error('SenseVoice model file missing from manifest.')
    args.push(`--sense-voice-model=${modelDir}/${manifest.model}`)
    args.push(`--sense-voice-language=${manifest.senseVoiceLanguage ?? 'auto'}`)
    args.push(`--sense-voice-use-itn=${manifest.senseVoiceItn ? 'true' : 'false'}`)
  } else if (manifest.kind === 'nemo-ctc') {
    if (!manifest.model) throw new Error('NeMo model file missing from manifest.')
    args.push(`--nemo-ctc-model=${modelDir}/${manifest.model}`)
  }

  return args
}

function parseSherpaOutput(raw: string): string {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (!lines[i].startsWith('{')) continue
    try {
      const parsed = JSON.parse(lines[i]) as { text?: string }
      if (typeof parsed.text === 'string') return parsed.text.trim()
    } catch {
      // try next
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (lines[i].startsWith('{') || lines[i].endsWith('.wav')) continue
    if (lines[i] === '----') continue
    return lines[i]
  }

  return ''
}

function formatSherpaFailure(err: unknown, manifest: SherpaManifest): string {
  const execErr = err as { stderr?: string; signal?: string }
  const stderr = execErr.stderr ?? ''

  if (stderr.includes('Ort::Exception') || execErr.signal === 'SIGABRT') {
    if (manifest.kind === 'nemo-ctc' && manifest.model === 'model.onnx') {
      return 'NeMo Fast Conformer is incompatible with the current sherpa-onnx runtime. Delete it and use NeMo Conformer Medium instead.'
    }
    return 'The speech model crashed while loading. Try Moonshine, NeMo Conformer Medium, or Whisper.'
  }

  if (err instanceof Error && err.message.startsWith('Command failed:')) {
    return 'Sherpa-ONNX transcription failed. Check that the model finished downloading.'
  }

  return err instanceof Error ? err.message : 'Sherpa-ONNX transcription failed'
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildSherpaArgs', () => {
  it('always includes num-threads, model-type, and tokens', () => {
    const args = buildSherpaArgs('/m', {
      kind: 'moonshine',
      modelType: 'moonshine',
      tokens: 'tokens.txt',
      preprocessor: 'preprocess.onnx',
      encoder: 'encode.int8.onnx',
      uncachedDecoder: 'uncached.int8.onnx',
      cachedDecoder: 'cached.int8.onnx'
    })
    expect(args[0]).toBe('--num-threads=2')
    expect(args).toContain('--model-type=moonshine')
    expect(args).toContain('--tokens=/m/tokens.txt')
  })

  it('builds moonshine args when all moonshine files present', () => {
    const args = buildSherpaArgs('/m', {
      kind: 'moonshine',
      modelType: 'moonshine',
      tokens: 'tokens.txt',
      preprocessor: 'preprocess.onnx',
      encoder: 'encode.int8.onnx',
      uncachedDecoder: 'uncached.int8.onnx',
      cachedDecoder: 'cached.int8.onnx'
    })
    expect(args).toContain('--moonshine-preprocessor=/m/preprocess.onnx')
    expect(args).toContain('--moonshine-encoder=/m/encode.int8.onnx')
    expect(args).toContain('--moonshine-uncached-decoder=/m/uncached.int8.onnx')
    expect(args).toContain('--moonshine-cached-decoder=/m/cached.int8.onnx')
  })

  it('omits moonshine args when fields are missing', () => {
    const args = buildSherpaArgs('/m', {
      kind: 'moonshine',
      modelType: 'moonshine',
      tokens: 'tokens.txt'
    })
    expect(args.some((a) => a.startsWith('--moonshine-preprocessor='))).toBe(false)
    expect(args.some((a) => a.startsWith('--moonshine-encoder='))).toBe(false)
  })

  it('builds sense-voice args with default language auto and ITN true', () => {
    const args = buildSherpaArgs('/m', {
      kind: 'sense-voice',
      modelType: 'sense_voice',
      tokens: 'tokens.txt',
      model: 'model.int8.onnx',
      senseVoiceLanguage: 'auto',
      senseVoiceItn: true
    })
    expect(args).toContain('--sense-voice-model=/m/model.int8.onnx')
    expect(args).toContain('--sense-voice-language=auto')
    expect(args).toContain('--sense-voice-use-itn=true')
  })

  it('defaults sense-voice language to auto and ITN to false when omitted', () => {
    const args = buildSherpaArgs('/m', {
      kind: 'sense-voice',
      modelType: 'sense_voice',
      tokens: 'tokens.txt',
      model: 'model.int8.onnx'
    })
    expect(args).toContain('--sense-voice-language=auto')
    expect(args).toContain('--sense-voice-use-itn=false')
  })

  it('throws if sense-voice manifest is missing model file', () => {
    expect(() =>
      buildSherpaArgs('/m', {
        kind: 'sense-voice',
        modelType: 'sense_voice',
        tokens: 'tokens.txt'
      })
    ).toThrow('SenseVoice model file missing from manifest.')
  })

  it('builds nemo-ctc args', () => {
    const args = buildSherpaArgs('/m', {
      kind: 'nemo-ctc',
      modelType: 'nemo_ctc',
      tokens: 'tokens.txt',
      model: 'model.int8.onnx'
    })
    expect(args).toContain('--nemo-ctc-model=/m/model.int8.onnx')
  })

  it('throws if nemo-ctc manifest is missing model file', () => {
    expect(() =>
      buildSherpaArgs('/m', {
        kind: 'nemo-ctc',
        modelType: 'nemo_ctc',
        tokens: 'tokens.txt'
      })
    ).toThrow('NeMo model file missing from manifest.')
  })
})

describe('parseSherpaOutput', () => {
  it('extracts text from a single JSON line', () => {
    expect(parseSherpaOutput('{"text":"hello world"}')).toBe('hello world')
  })

  it('prefers the LAST non-log JSON line', () => {
    const out = 'whisper_init: ready\n{"text":"first"}\n{"text":"second"}'
    expect(parseSherpaOutput(out)).toBe('second')
  })

  it('skips engine log lines when finding JSON', () => {
    const out = 'whisper_init: ready\nggml_metal: free\n{"text":"speech"}'
    expect(parseSherpaOutput(out)).toBe('speech')
  })

  it('falls back to a plain-text non-log line when no JSON found', () => {
    const out = 'whisper_init: ready\nhello there\n----'
    expect(parseSherpaOutput(out)).toBe('hello there')
  })

  it('skips bare wav paths in the plain-text fallback', () => {
    const out = '/tmp/audio/recording.wav\nthe real text'
    expect(parseSherpaOutput(out)).toBe('the real text')
  })

  it('skips lines that start with { when in plain-text fallback', () => {
    const out = 'whisper_init: ready\n{"broken": json\nfallback text'
    expect(parseSherpaOutput(out)).toBe('fallback text')
  })

  it('returns empty string when there is no usable text', () => {
    expect(parseSherpaOutput('whisper_init: ready\n----\n/tmp/x.wav')).toBe('')
  })

  it('returns empty for empty input', () => {
    expect(parseSherpaOutput('')).toBe('')
  })
})

describe('formatSherpaFailure', () => {
  const moonshineManifest: SherpaManifest = {
    kind: 'moonshine',
    modelType: 'moonshine',
    tokens: 'tokens.txt'
  }

  it('returns Fast Conformer incompatibility message for nemo + model.onnx + Ort::Exception', () => {
    const err = { stderr: 'Ort::Exception thrown', signal: 'SIGABRT' }
    const msg = formatSherpaFailure(err, {
      kind: 'nemo-ctc',
      modelType: 'nemo_ctc',
      tokens: 'tokens.txt',
      model: 'model.onnx'
    })
    expect(msg).toContain('NeMo Fast Conformer')
  })

  it('returns generic crash message for Ort::Exception on non-nemo models', () => {
    const err = { stderr: 'Ort::Exception', signal: 'SIGABRT' }
    expect(formatSherpaFailure(err, moonshineManifest)).toContain('speech model crashed')
  })

  it('returns generic crash message for SIGABRT without Ort::Exception', () => {
    const err = { stderr: '', signal: 'SIGABRT' }
    expect(formatSherpaFailure(err, moonshineManifest)).toContain('speech model crashed')
  })

  it('returns Sherpa-ONNX message for Command failed errors', () => {
    const err = new Error('Command failed: /bin/sh')
    expect(formatSherpaFailure(err, moonshineManifest)).toContain('Sherpa-ONNX transcription failed')
    expect(formatSherpaFailure(err, moonshineManifest)).toContain('finished downloading')
  })

  it('falls back to error.message for unknown errors', () => {
    const err = new Error('something weird')
    expect(formatSherpaFailure(err, moonshineManifest)).toBe('something weird')
  })

  it('returns generic message for string error values', () => {
    // Note: passing null/undefined would throw because the function reads
    // .stderr from the value without a null-guard. The documented contract
    // is "err is an Error or a node execFile error object".
    expect(formatSherpaFailure('string error', moonshineManifest)).toBe(
      'Sherpa-ONNX transcription failed'
    )
  })
})
