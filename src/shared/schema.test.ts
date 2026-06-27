import { describe, it, expect } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Schema } from 'effect'
import {
  AppSettingsSchema,
  HotkeyConfigSchema,
  AiConfigSchema,
  DictionaryEntrySchema,
  SnippetSchema,
  HistoryEntrySchema,
  InstalledModelSchema,
  ModelCatalogEntrySchema,
  ModelCatalogFileSchema,
  SherpaCatalogConfigSchema
} from './schema'
import { DEFAULT_SETTINGS, DEFAULT_HOTKEY, DEFAULT_AI_CONFIG } from './types'

describe('Schema — DEFAULT_SETTINGS round-trip', () => {
  itEffect('decodes DEFAULT_SETTINGS without modification', () =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknownEffect(AppSettingsSchema)(DEFAULT_SETTINGS)
      expectEffect(decoded.activeModelId).toBe(DEFAULT_SETTINGS.activeModelId)
      expectEffect(decoded.hotkey.mode).toBe('hold')
      expectEffect(decoded.hotkey.keycode).toBe(3640)
      expectEffect(decoded.ai.provider).toBe('none')
      expectEffect(decoded.ai.enabled).toBe(false)
      expectEffect(decoded.dictionary).toEqual([])
      expectEffect(decoded.snippets).toEqual([])
      expectEffect(decoded.history).toEqual([])
      expectEffect(decoded.installedModels).toEqual([])
      expectEffect(decoded.gpuEnabled).toBe(true)
      expectEffect(decoded.autoStart).toBe(false)
    })
  )

  it('encodes then decodes back to the same shape (idempotent)', () => {
    const encoded = Schema.encodeSync(AppSettingsSchema)(DEFAULT_SETTINGS)
    const decoded = Schema.decodeUnknownSync(AppSettingsSchema)(encoded)
    expect(decoded).toEqual(DEFAULT_SETTINGS)
  })
})

describe('Schema — HotkeyConfigSchema', () => {
  it('accepts a valid hotkey config', () => {
    const decoded = Schema.decodeUnknownSync(HotkeyConfigSchema)(DEFAULT_HOTKEY)
    expect(decoded).toEqual(DEFAULT_HOTKEY)
  })

  it('rejects an invalid hotkey mode', () => {
    const bad = { ...DEFAULT_HOTKEY, mode: 'bogus' }
    expect(() => Schema.decodeUnknownSync(HotkeyConfigSchema)(bad)).toThrow()
  })

  it('rejects a non-numeric keycode', () => {
    const bad = { ...DEFAULT_HOTKEY, keycode: '3640' }
    expect(() => Schema.decodeUnknownSync(HotkeyConfigSchema)(bad)).toThrow()
  })
})

describe('Schema — AiConfigSchema', () => {
  it('accepts the default AI config', () => {
    const decoded = Schema.decodeUnknownSync(AiConfigSchema)(DEFAULT_AI_CONFIG)
    expect(decoded).toEqual(DEFAULT_AI_CONFIG)
  })

  it('rejects an invalid provider', () => {
    const bad = { ...DEFAULT_AI_CONFIG, provider: 'grok' }
    expect(() => Schema.decodeUnknownSync(AiConfigSchema)(bad)).toThrow()
  })

  it('accepts all valid providers', () => {
    for (const provider of ['none', 'ollama', 'openai', 'anthropic', 'openrouter'] as const) {
      const cfg = { ...DEFAULT_AI_CONFIG, provider }
      expect(() => Schema.decodeUnknownSync(AiConfigSchema)(cfg)).not.toThrow()
    }
  })
})

describe('Schema — DictionaryEntrySchema', () => {
  it('accepts a word with optional replacement', () => {
    const decoded = Schema.decodeUnknownSync(DictionaryEntrySchema)({ word: 'k8s', replacement: 'kubernetes' })
    expect(decoded.word).toBe('k8s')
    expect(decoded.replacement).toBe('kubernetes')
  })

  it('accepts a word without replacement (undefined)', () => {
    const decoded = Schema.decodeUnknownSync(DictionaryEntrySchema)({ word: 'k8s' })
    expect(decoded.word).toBe('k8s')
    expect(decoded.replacement).toBeUndefined()
  })

  it('rejects an empty word (number type)', () => {
    expect(() => Schema.decodeUnknownSync(DictionaryEntrySchema)({ word: 123 })).toThrow()
  })
})

describe('Schema — SnippetSchema', () => {
  it('accepts a valid snippet', () => {
    const decoded = Schema.decodeUnknownSync(SnippetSchema)({
      id: 's1',
      trigger: 'my addr',
      content: '123 Main St'
    })
    expect(decoded).toEqual({ id: 's1', trigger: 'my addr', content: '123 Main St' })
  })

  it('rejects a snippet missing id', () => {
    expect(() =>
      Schema.decodeUnknownSync(SnippetSchema)({ trigger: 'x', content: 'y' })
    ).toThrow()
  })
})

describe('Schema — HistoryEntrySchema', () => {
  it('accepts a valid history entry', () => {
    const entry = {
      id: 'h1',
      text: 'hello',
      rawText: 'hello',
      timestamp: 12345,
      durationMs: 1500
    }
    const decoded = Schema.decodeUnknownSync(HistoryEntrySchema)(entry)
    expect(decoded).toEqual(entry)
  })

  it('rejects a non-numeric timestamp', () => {
    const bad = {
      id: 'h1',
      text: 'x',
      rawText: 'x',
      timestamp: 'not-a-number',
      durationMs: 0
    }
    expect(() => Schema.decodeUnknownSync(HistoryEntrySchema)(bad)).toThrow()
  })
})

describe('Schema — InstalledModelSchema', () => {
  it('accepts a valid installed model', () => {
    const m = {
      id: 'whisper-tiny',
      name: 'Whisper Tiny',
      filename: 'ggml-tiny.bin',
      path: '/models/ggml-tiny.bin',
      sizeBytes: 75_000_000,
      language: 'multilingual',
      source: 'catalog',
      engine: 'whisper',
      url: 'https://example.com/tiny.bin'
    }
    const decoded = Schema.decodeUnknownSync(InstalledModelSchema)(m)
    expect(decoded.id).toBe('whisper-tiny')
    expect(decoded.engine).toBe('whisper')
  })

  it('rejects an unknown engine type', () => {
    const m = {
      id: 'm',
      name: 'M',
      filename: 'm',
      path: '/m',
      sizeBytes: 0,
      language: 'en',
      source: 'catalog',
      engine: 'made-up'
    }
    expect(() => Schema.decodeUnknownSync(InstalledModelSchema)(m)).toThrow()
  })

  it('accepts a sherpa install with manifest', () => {
    const m = {
      id: 'moonshine-tiny-en',
      name: 'Moonshine Tiny',
      filename: 'moonshine-tiny-en',
      path: '/models/moonshine-tiny-en',
      sizeBytes: 124_000_000,
      language: 'english',
      source: 'catalog',
      engine: 'sherpa-onnx',
      sherpaManifest: {
        kind: 'moonshine',
        modelType: 'moonshine',
        tokens: 'tokens.txt',
        preprocessor: 'preprocess.onnx',
        encoder: 'encode.int8.onnx',
        uncachedDecoder: 'uncached_decode.int8.onnx',
        cachedDecoder: 'cached_decode.int8.onnx'
      }
    }
    const decoded = Schema.decodeUnknownSync(InstalledModelSchema)(m)
    expect(decoded.sherpaManifest?.kind).toBe('moonshine')
  })
})

describe('Schema — ModelCatalogEntrySchema and File schema', () => {
  it('accepts a single-file catalog entry', () => {
    const e = {
      id: 'tiny',
      name: 'Whisper Tiny',
      filename: 'ggml-tiny.bin',
      url: 'https://huggingface.co/x/resolve/main/ggml-tiny.bin',
      sizeBytes: 75_000_000,
      language: 'multilingual',
      description: 'fast',
      engine: 'whisper',
      family: 'whisper'
    }
    const decoded = Schema.decodeUnknownSync(ModelCatalogEntrySchema)(e)
    expect(decoded.id).toBe('tiny')
    expect(decoded.files).toBeUndefined()
  })

  it('accepts a multi-file sherpa entry', () => {
    const e = {
      id: 'moonshine-tiny-en',
      name: 'Moonshine Tiny',
      filename: 'moonshine-tiny-en',
      url: '',
      sizeBytes: 124_000_000,
      language: 'english',
      description: 'fast',
      engine: 'sherpa-onnx',
      family: 'moonshine',
      files: [
        { filename: 'preprocess.onnx', url: 'https://example.com/p.onnx' },
        { filename: 'tokens.txt', url: 'https://example.com/t.txt' }
      ]
    }
    const decoded = Schema.decodeUnknownSync(ModelCatalogEntrySchema)(e)
    expect(decoded.files).toHaveLength(2)
  })

  it('rejects an unknown family', () => {
    const e = {
      id: 'm',
      name: 'M',
      filename: 'm',
      url: '',
      sizeBytes: 0,
      language: 'en',
      description: '',
      engine: 'whisper',
      family: 'coqui'
    }
    expect(() => Schema.decodeUnknownSync(ModelCatalogEntrySchema)(e)).toThrow()
  })

  it('ModelCatalogFileSchema accepts filename + url', () => {
    const f = { filename: 'model.onnx', url: 'https://example.com/model.onnx' }
    const decoded = Schema.decodeUnknownSync(ModelCatalogFileSchema)(f)
    expect(decoded).toEqual(f)
  })
})

describe('Schema — SherpaCatalogConfigSchema', () => {
  it('accepts a moonshine config with all fields', () => {
    const c = {
      kind: 'moonshine',
      modelType: 'moonshine',
      tokens: 'tokens.txt',
      preprocessor: 'preprocess.onnx',
      encoder: 'encode.int8.onnx',
      uncachedDecoder: 'u.onnx',
      cachedDecoder: 'c.onnx'
    }
    const decoded = Schema.decodeUnknownSync(SherpaCatalogConfigSchema)(c)
    expect(decoded.kind).toBe('moonshine')
  })

  it('accepts a sense-voice config with language + itn', () => {
    const c = {
      kind: 'sense-voice',
      modelType: 'sense_voice',
      tokens: 'tokens.txt',
      model: 'model.int8.onnx',
      senseVoiceLanguage: 'auto',
      senseVoiceItn: true
    }
    const decoded = Schema.decodeUnknownSync(SherpaCatalogConfigSchema)(c)
    expect(decoded.senseVoiceItn).toBe(true)
  })

  it('rejects an unknown kind', () => {
    const c = {
      kind: 'whisper',
      modelType: 'whisper',
      tokens: 'tokens.txt'
    }
    expect(() => Schema.decodeUnknownSync(SherpaCatalogConfigSchema)(c)).toThrow()
  })
})

describe('Schema — AppSettings full validation', () => {
  itEffect('rejects when hotkey mode is invalid', () =>
    Effect.gen(function* () {
      const bad = {
        ...DEFAULT_SETTINGS,
        hotkey: { ...DEFAULT_HOTKEY, mode: 'invalid-mode' }
      }
      const exit = yield* Effect.exit(Schema.decodeUnknownEffect(AppSettingsSchema)(bad))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )

  itEffect('rejects when activeModelId is wrong type', () =>
    Effect.gen(function* () {
      const bad = { ...DEFAULT_SETTINGS, activeModelId: 123 }
      const exit = yield* Effect.exit(Schema.decodeUnknownEffect(AppSettingsSchema)(bad))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    })
  )

  itEffect('accepts null activeModelId', () =>
    Effect.gen(function* () {
      const ok = { ...DEFAULT_SETTINGS, activeModelId: null }
      const decoded = yield* Schema.decodeUnknownEffect(AppSettingsSchema)(ok)
      expectEffect(decoded.activeModelId).toBeNull()
    })
  )

  itEffect('accepts a string activeModelId', () =>
    Effect.gen(function* () {
      const ok = { ...DEFAULT_SETTINGS, activeModelId: 'whisper-tiny' }
      const decoded = yield* Schema.decodeUnknownEffect(AppSettingsSchema)(ok)
      expectEffect(decoded.activeModelId).toBe('whisper-tiny')
    })
  )

  it('encodes then re-decodes round-trips (extra fields are stripped or preserved per default)', () => {
    // Effect v4's Schema.Struct does not reject extra keys by default; the
    // encoded form only includes the declared fields, so decode is idempotent.
    const bad = { ...DEFAULT_SETTINGS, unknownField: 'surprise' }
    const encoded = Schema.encodeSync(AppSettingsSchema)(bad as typeof DEFAULT_SETTINGS)
    const decoded = Schema.decodeUnknownSync(AppSettingsSchema)(encoded)
    expect(decoded).toEqual(DEFAULT_SETTINGS)
  })
})
