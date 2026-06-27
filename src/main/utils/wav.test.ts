import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const writeFileSync = vi.hoisted(() => vi.fn())
vi.mock('node:fs', () => ({ writeFileSync }))

import { writeWavFile } from './wav'

beforeEach(() => {
  writeFileSync.mockReset()
})

afterEach(() => {
  writeFileSync.mockReset()
})

function decodeHeader(buf: Buffer) {
  return {
    riff: buf.toString('ascii', 0, 4),
    chunkSize: buf.readUInt32LE(4),
    wave: buf.toString('ascii', 8, 12),
    fmt: buf.toString('ascii', 12, 16),
    fmtSize: buf.readUInt32LE(16),
    audioFormat: buf.readUInt16LE(20),
    numChannels: buf.readUInt16LE(22),
    sampleRate: buf.readUInt32LE(24),
    byteRate: buf.readUInt32LE(28),
    blockAlign: buf.readUInt16LE(32),
    bitsPerSample: buf.readUInt16LE(34),
    data: buf.toString('ascii', 36, 40),
    dataSize: buf.readUInt32LE(40)
  }
}

describe('writeWavFile', () => {
  it('writes a 16 kHz mono 16-bit PCM header', () => {
    const pcm = new Float32Array([0, 0])
    writeWavFile(pcm, '/tmp/out.wav')

    expect(writeFileSync).toHaveBeenCalledTimes(1)
    const [path, buffer] = writeFileSync.mock.calls[0] as [string, Buffer]
    expect(path).toBe('/tmp/out.wav')
    const h = decodeHeader(buffer)
    expect(h.riff).toBe('RIFF')
    expect(h.wave).toBe('WAVE')
    expect(h.fmt).toBe('fmt ')
    expect(h.data).toBe('data')
    expect(h.audioFormat).toBe(1) // PCM
    expect(h.numChannels).toBe(1)
    expect(h.sampleRate).toBe(16000)
    expect(h.bitsPerSample).toBe(16)
    expect(h.blockAlign).toBe(2)
    expect(h.byteRate).toBe(32000)
  })

  it('computes correct data size from sample count', () => {
    const pcm = new Float32Array(100)
    writeWavFile(pcm, '/tmp/out.wav')
    const buffer = writeFileSync.mock.calls[0][1] as Buffer
    const h = decodeHeader(buffer)
    expect(h.dataSize).toBe(200) // 100 samples * 2 bytes
    expect(h.chunkSize).toBe(36 + 200)
    expect(buffer.length).toBe(44 + 200)
  })

  it('clamps samples to [-1, 1] before quantization', () => {
    const pcm = new Float32Array([2.0, -2.0, 1.0, -1.0, 0.0])
    writeWavFile(pcm, '/tmp/out.wav')
    const buffer = writeFileSync.mock.calls[0][1] as Buffer
    expect(buffer.readInt16LE(44)).toBe(32767)
    expect(buffer.readInt16LE(46)).toBe(-32767)
    expect(buffer.readInt16LE(48)).toBe(32767)
    expect(buffer.readInt16LE(50)).toBe(-32767)
    expect(buffer.readInt16LE(52)).toBe(0)
  })

  it('rounds fractional samples correctly', () => {
    // 0.5 * 32767 = 16383.5 -> Math.round -> 16384
    // -0.5 * 32767 = -16383.5 -> Math.round -> -16383 (JS Math.round rounds half-values toward +Inf)
    const pcm = new Float32Array([0.5, -0.5, 0.25, -0.25])
    writeWavFile(pcm, '/tmp/out.wav')
    const buffer = writeFileSync.mock.calls[0][1] as Buffer
    expect(buffer.readInt16LE(44)).toBe(16384)
    expect(buffer.readInt16LE(46)).toBe(-16383)
    expect(buffer.readInt16LE(48)).toBe(8192)
    expect(buffer.readInt16LE(50)).toBe(-8192)
  })

  it('writes little-endian sample bytes', () => {
    const pcm = new Float32Array([1.0])
    writeWavFile(pcm, '/tmp/out.wav')
    const buffer = writeFileSync.mock.calls[0][1] as Buffer
    expect(buffer[44]).toBe(0xff)
    expect(buffer[45]).toBe(0x7f)
  })

  it('handles an empty PCM array', () => {
    writeWavFile(new Float32Array(0), '/tmp/out.wav')
    const buffer = writeFileSync.mock.calls[0][1] as Buffer
    const h = decodeHeader(buffer)
    expect(h.dataSize).toBe(0)
    expect(h.chunkSize).toBe(36)
    expect(buffer.length).toBe(44)
  })
})
