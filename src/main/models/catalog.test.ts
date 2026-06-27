import { describe, it, expect } from 'vitest'
import {
  findCatalogEntry,
  resolveHuggingFaceUrl,
  filenameFromUrl,
  inferEngineFromFilename,
  MODEL_CATALOG,
  WHISPER_CATALOG,
  PARAKEET_CATALOG,
  MOONSHINE_CATALOG,
  SENSEVOICE_CATALOG,
  NEMO_CATALOG
} from './catalog'

describe('MODEL_CATALOG', () => {
  it('aggregates all per-engine catalogs', () => {
    const total =
      WHISPER_CATALOG.length +
      PARAKEET_CATALOG.length +
      MOONSHINE_CATALOG.length +
      SENSEVOICE_CATALOG.length +
      NEMO_CATALOG.length
    expect(MODEL_CATALOG.length).toBe(total)
  })

  it('contains no duplicate ids', () => {
    const ids = MODEL_CATALOG.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry has a non-empty filename and id', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.id).toBeTruthy()
      expect(m.filename).toBeTruthy()
    }
  })
})

describe('findCatalogEntry', () => {
  it('returns the matching catalog entry', () => {
    const entry = findCatalogEntry('tiny')
    expect(entry).toBeDefined()
    expect(entry?.engine).toBe('whisper')
    expect(entry?.filename).toBe('ggml-tiny.bin')
  })

  it('returns undefined for an unknown id', () => {
    expect(findCatalogEntry('does-not-exist')).toBeUndefined()
  })

  it('finds a sherpa moonshine entry', () => {
    const entry = findCatalogEntry('moonshine-tiny-en')
    expect(entry).toBeDefined()
    expect(entry?.engine).toBe('sherpa-onnx')
    expect(entry?.files).toBeDefined()
    expect(entry?.files?.length).toBeGreaterThan(0)
    expect(entry?.sherpa).toBeDefined()
  })
})

describe('resolveHuggingFaceUrl', () => {
  it('rewrites HF tree URL to resolve/main URL (uses last path segment as filename)', () => {
    const input = 'https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-tiny-en-int8/tree/main'
    // The last URL path segment is "main" (the branch name); the function
    // falls back to that as the filename when no /tree/main/<file> is present.
    expect(resolveHuggingFaceUrl(input)).toBe(
      'https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-tiny-en-int8/resolve/main/main'
    )
  })

  it('rewrites HF tree URL with file to resolve/main/file', () => {
    const input =
      'https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-tiny-en-int8/tree/main/preprocess.onnx'
    expect(resolveHuggingFaceUrl(input)).toBe(
      'https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-tiny-en-int8/resolve/main/preprocess.onnx'
    )
  })

  it('leaves already-resolved HF URLs unchanged', () => {
    const url = 'https://huggingface.co/csukuangfj/foo/resolve/main/model.onnx'
    expect(resolveHuggingFaceUrl(url)).toBe(url)
  })

  it('leaves non-HF HTTPS URLs unchanged', () => {
    const url = 'https://example.com/some/model.bin'
    expect(resolveHuggingFaceUrl(url)).toBe(url)
  })

  it('returns the input unchanged when it is not a URL', () => {
    expect(resolveHuggingFaceUrl('not-a-url')).toBe('not-a-url')
  })

  it('trims surrounding whitespace', () => {
    expect(resolveHuggingFaceUrl('  https://example.com/x  ')).toBe('https://example.com/x')
  })
})

describe('filenameFromUrl', () => {
  it('extracts filename from a standard URL', () => {
    expect(filenameFromUrl('https://example.com/path/to/model.gguf')).toBe('model.gguf')
  })

  it('decodes percent-encoded filenames', () => {
    expect(filenameFromUrl('https://example.com/my%20model.gguf')).toBe('my model.gguf')
  })

  it('returns fallback for invalid URL', () => {
    expect(filenameFromUrl('not a url at all')).toBe('custom-model.bin')
  })

  it('handles URL with no path component', () => {
    expect(filenameFromUrl('https://example.com')).toBe('custom-model.bin')
  })

  it('handles URL with trailing slash', () => {
    expect(filenameFromUrl('https://example.com/path/')).toBe('custom-model.bin')
  })
})

describe('inferEngineFromFilename', () => {
  it('classifies .gguf (non-ggml) as parakeet-gguf', () => {
    expect(inferEngineFromFilename('tdt-0.6b-v3-q5_k.gguf')).toBe('parakeet-gguf')
  })

  it('classifies ggml-*.bin as whisper (ggml prefix is a parakeet-gguf disqualifier)', () => {
    expect(inferEngineFromFilename('ggml-tiny.bin')).toBe('whisper')
    expect(inferEngineFromFilename('ggml-base.en.bin')).toBe('whisper')
  })

  it('classifies .onnx as sherpa-onnx', () => {
    expect(inferEngineFromFilename('model.int8.onnx')).toBe('sherpa-onnx')
    expect(inferEngineFromFilename('preprocess.onnx')).toBe('sherpa-onnx')
  })

  it('classifies unknown extensions as whisper (default)', () => {
    expect(inferEngineFromFilename('custom-model.bin')).toBe('whisper')
    expect(inferEngineFromFilename('no-extension')).toBe('whisper')
  })
})
