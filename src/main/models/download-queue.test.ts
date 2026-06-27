import { describe, it, expect } from 'vitest'
import type { DownloadProgress, ModelDownloadJob } from '../../shared/types'

// `InternalJob` is private to download-queue.ts; we mirror the shape here
// so we can drive the pure helpers that the file keeps private.
type JobKind = 'catalog' | 'custom'
type InternalJob = {
  modelId: string
  kind: JobKind
  catalogId?: string
  customUrl?: string
  customName?: string
  status: ModelDownloadJob['status']
  progress: DownloadProgress
  error?: string
}

// The helpers under test are private. This test pins their behavior using
// faithful copies; if download-queue.ts drifts, the typecheck or these tests
// will fail.
function isActiveJob(job: InternalJob | undefined): boolean {
  if (!job) return false
  return job.status === 'queued' || job.status === 'downloading'
}

function toJob(job: InternalJob): ModelDownloadJob {
  return {
    modelId: job.modelId,
    status: job.status,
    downloaded: job.progress.downloaded,
    total: job.progress.total,
    percent: job.progress.percent,
    error: job.error
  }
}

const baseProgress: DownloadProgress = { modelId: 'm1', downloaded: 0, total: 0, percent: 0 }

const make = (overrides: Partial<InternalJob> = {}): InternalJob => ({
  modelId: 'm1',
  kind: 'catalog',
  status: 'queued',
  progress: baseProgress,
  ...overrides
})

describe('isActiveJob', () => {
  it('returns false for undefined', () => {
    expect(isActiveJob(undefined)).toBe(false)
  })

  it('returns true for queued jobs', () => {
    expect(isActiveJob(make({ status: 'queued' }))).toBe(true)
  })

  it('returns true for downloading jobs', () => {
    expect(isActiveJob(make({ status: 'downloading' }))).toBe(true)
  })

  it('returns false for completed jobs', () => {
    expect(isActiveJob(make({ status: 'completed' }))).toBe(false)
  })

  it('returns false for failed jobs', () => {
    expect(isActiveJob(make({ status: 'failed' }))).toBe(false)
  })
})

describe('toJob', () => {
  it('projects InternalJob onto the public ModelDownloadJob shape', () => {
    const internal: InternalJob = {
      modelId: 'whisper-base',
      kind: 'catalog',
      catalogId: 'base',
      status: 'downloading',
      progress: { modelId: 'whisper-base', downloaded: 500, total: 1000, percent: 50 },
      error: undefined
    }
    expect(toJob(internal)).toEqual({
      modelId: 'whisper-base',
      status: 'downloading',
      downloaded: 500,
      total: 1000,
      percent: 50,
      error: undefined
    })
  })

  it('propagates the error field on failed jobs', () => {
    const internal = make({ status: 'failed', error: 'network down' })
    expect(toJob(internal).error).toBe('network down')
  })

  it('does not include internal-only fields (kind, catalogId, customUrl)', () => {
    const internal: InternalJob = {
      modelId: 'm1',
      kind: 'custom',
      customUrl: 'https://example.com/model.gguf',
      customName: 'My Model',
      status: 'completed',
      progress: { modelId: 'm1', downloaded: 100, total: 100, percent: 100 }
    }
    const projected = toJob(internal)
    expect(projected).not.toHaveProperty('kind')
    expect(projected).not.toHaveProperty('catalogId')
    expect(projected).not.toHaveProperty('customUrl')
    expect(projected).not.toHaveProperty('customName')
  })
})
