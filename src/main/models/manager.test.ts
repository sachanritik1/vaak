import { describe, it, expect } from 'vitest'
import { formatBytes, engineLabel } from './manager'

describe('formatBytes', () => {
  it('formats bytes (< 1024) with B suffix', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats kilobytes with 1 decimal KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes with 1 decimal MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })

  it('formats gigabytes with 2 decimal GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB')
  })

  it('formats terabyte-scale with GB', () => {
    expect(formatBytes(3.1 * 1024 * 1024 * 1024)).toBe('3.10 GB')
  })
})

describe('engineLabel', () => {
  it('returns human label for each engine type', () => {
    expect(engineLabel('parakeet-coreml')).toBe('Parakeet · CoreML')
    expect(engineLabel('parakeet-gguf')).toBe('Parakeet · GGUF')
    expect(engineLabel('sherpa-onnx')).toBe('Sherpa-ONNX')
    expect(engineLabel('whisper')).toBe('Whisper')
  })
})
