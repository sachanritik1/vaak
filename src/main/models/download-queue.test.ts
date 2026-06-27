import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { it as itEffect, expect as expectEffect } from '@effect/vitest'
import { Effect, Exit, Layer } from 'effect'
import { TestClock } from 'effect/testing'

// Mock BrowserWindow.getAllWindows so broadcasts are observable.
const sentMessages: Array<{ channel: string; payload: unknown }> = []

const getAllWindows = vi.hoisted(() => vi.fn(() => {
  return [{
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, payload: unknown) => {
        sentMessages.push({ channel, payload })
      }
    }
  }]
}))
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows }
}))

import { DownloadQueueService, DownloadQueueLive } from './download-queue'
import { ModelsService, type ModelsService as ModelsServiceI } from './manager'
import { makeSettingsStub } from '../test/stubs'
import { DownloadError, UnknownModelError } from '../errors'
import { DEFAULT_SETTINGS, type DownloadProgress, type InstalledModel } from '../../shared/types'

beforeEach(() => {
  sentMessages.length = 0
  getAllWindows.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

function makeInstalledModel(id: string): InstalledModel {
  return {
    id,
    name: id,
    filename: `${id}.bin`,
    path: `/models/${id}.bin`,
    sizeBytes: 100,
    language: 'en',
    source: 'catalog',
    engine: 'whisper'
  }
}

type ModelsStubOpts = {
  installed?: InstalledModel[]
  downloadCatalogImpl?: (
    id: string,
    onProgress: (p: DownloadProgress) => void
  ) => Effect.Effect<InstalledModel, DownloadError | UnknownModelError>
  downloadCustomImpl?: (
    url: string,
    name: string | undefined,
    onProgress: (p: DownloadProgress) => void
  ) => Effect.Effect<InstalledModel, DownloadError>
}

const makeModelsStub = (opts: ModelsStubOpts = {}) =>
  Layer.succeed(ModelsService, {
    getInstalled: Effect.succeed(opts.installed ?? []),
    getActive: Effect.succeed(null),
    setActive: Effect.void as unknown as ModelsServiceI['setActive'],
    deleteModel: ((_: string) => Effect.void) as ModelsServiceI['deleteModel'],
    downloadCatalog:
      opts.downloadCatalogImpl ??
      (() => Effect.succeed(makeInstalledModel('default'))),
    downloadCustom:
      opts.downloadCustomImpl ?? (() => Effect.succeed(makeInstalledModel('default')))
  } as unknown as ModelsServiceI)

const withDeps = (opts: ModelsStubOpts = {}) =>
  DownloadQueueLive.pipe(
    Layer.provideMerge(makeSettingsStub()),
    Layer.provideMerge(makeModelsStub(opts))
  )

const withCustomDeps = (settings = DEFAULT_SETTINGS, opts: ModelsStubOpts = {}) =>
  DownloadQueueLive.pipe(
    Layer.provideMerge(makeSettingsStub(settings)),
    Layer.provideMerge(makeModelsStub(opts))
  )

describe('DownloadQueueService — enqueueCatalog', () => {
  itEffect('returns { accepted: true, modelId } for a fresh catalog id', () =>
    Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const res = yield* q.enqueueCatalog('tiny')
      expectEffect(res.accepted).toBe(true)
      expectEffect(res.modelId).toBe('tiny')
    }).pipe(Effect.provide(withDeps()))
  )

  itEffect('fails with UnknownModelError for an unknown catalog id', () =>
    Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const exit = yield* Effect.exit(q.enqueueCatalog('does-not-exist'))
      expectEffect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(withDeps()))
  )

  itEffect('returns { accepted: false, reason: "installed" } for an already-installed id', () => {
    const installed: InstalledModel[] = [makeInstalledModel('tiny')]
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const res = yield* q.enqueueCatalog('tiny')
      expectEffect(res.accepted).toBe(false)
      expectEffect(res.reason).toBe('installed')
    }).pipe(Effect.provide(withCustomDeps(DEFAULT_SETTINGS, { installed })))
  })

  itEffect('returns { accepted: false, reason: "already_active" } when a job is in progress', () => {
    const slowDownload = (id: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep('30 seconds')
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const first = yield* q.enqueueCatalog('tiny')
      expectEffect(first.accepted).toBe(true)
      const second = yield* q.enqueueCatalog('tiny')
      expectEffect(second.accepted).toBe(false)
      expectEffect(second.reason).toBe('already_active')
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: slowDownload })))
  })

  itEffect('clears a failed job so a re-enqueue starts fresh', () => {
    const failingDownload = () =>
      Effect.fail(new DownloadError({ message: 'network', modelId: 'tiny' }))
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const first = yield* q.enqueueCatalog('tiny')
      expectEffect(first.accepted).toBe(true)
      // Let the forked job fail
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      // Re-enqueue should be accepted (failed job was cleared)
      const second = yield* q.enqueueCatalog('tiny')
      expectEffect(second.accepted).toBe(true)
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: failingDownload })))
  })

  itEffect('invokes the models.downloadCatalog with the catalog id and progress callback', () => {
    let calledWith: string | null = null
    let progressCallback: ((p: DownloadProgress) => void) | null = null
    const download = (id: string, onProgress: (p: DownloadProgress) => void) =>
      Effect.gen(function* () {
        calledWith = id
        progressCallback = onProgress
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('base')
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      expectEffect(calledWith).toBe('base')
      expectEffect(progressCallback).not.toBeNull()
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: download })))
  })
})

describe('DownloadQueueService — enqueueCustom', () => {
  itEffect('hashes the URL to derive a stable model id', () =>
    Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const res = yield* q.enqueueCustom('https://example.com/foo.gguf', 'My Model')
      expectEffect(res.accepted).toBe(true)
      expectEffect(res.modelId).toMatch(/^custom-[a-f0-9]{12}$/)
    }).pipe(Effect.provide(withDeps()))
  )

  itEffect('accepts a different URL even if the previous is still in-flight', () => {
    const slowDownload = (id: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep('30 seconds')
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const first = yield* q.enqueueCustom('https://example.com/x.gguf', 'X')
      expectEffect(first.accepted).toBe(true)
      const second = yield* q.enqueueCustom('https://example.com/y.gguf', 'Y')
      expectEffect(second.accepted).toBe(true)
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: slowDownload })))
  })

  itEffect('forwards the resolved URL and name to models.downloadCustom', () => {
    let capturedUrl: string | null = null
    let capturedName: string | null = null
    const downloadCustom = (
      url: string,
      name: string | undefined,
      _onProgress: (p: DownloadProgress) => void
    ) =>
      Effect.gen(function* () {
        capturedUrl = url
        capturedName = name ?? null
        return makeInstalledModel('custom-1')
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCustom('https://example.com/x.gguf', 'My Name')
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      expectEffect(capturedUrl).toBe('https://example.com/x.gguf')
      expectEffect(capturedName).toBe('My Name')
    }).pipe(Effect.provide(withDeps({ downloadCustomImpl: downloadCustom })))
  })
})

describe('DownloadQueueService — getJobs', () => {
  itEffect('returns an empty list when nothing is enqueued', () =>
    Effect.gen(function* () {
      const q = yield* DownloadQueueService
      const jobs = yield* q.getJobs
      expectEffect(jobs).toEqual([])
    }).pipe(Effect.provide(withDeps()))
  )

  itEffect('exposes the current job list with the expected shape', () => {
    const slowDownload = (id: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep('30 seconds')
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('tiny')
      const jobs = yield* q.getJobs
      expectEffect(jobs.length).toBe(1)
      expectEffect(jobs[0].modelId).toBe('tiny')
      expectEffect(['queued', 'downloading']).toContain(jobs[0].status)
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: slowDownload })))
  })
})

describe('DownloadQueueService — progress broadcast', () => {
  itEffect('emits DOWNLOAD_UPDATED to BrowserWindow on enqueue and progress', () => {
    let progressCb: ((p: DownloadProgress) => void) | null = null
    const slowDownload = (id: string, onProgress: (p: DownloadProgress) => void) =>
      Effect.gen(function* () {
        progressCb = onProgress
        yield* Effect.sleep('30 seconds')
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('tiny')
      expectEffect(sentMessages.length).toBeGreaterThan(0)
      expectEffect(sentMessages.some((m) => m.channel === 'models:download-updated')).toBe(true)
      if (progressCb) progressCb({ modelId: 'tiny', downloaded: 50, total: 100, percent: 50 })
      expectEffect(sentMessages.length).toBeGreaterThan(1)
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: slowDownload })))
  })
})

describe('DownloadQueueService — concurrency limit', () => {
  itEffect('runs at most 3 downloads concurrently (Semaphore)', () => {
    let inflight = 0
    let maxInflight = 0
    const tracker = (id: string) => {
      inflight++
      if (inflight > maxInflight) maxInflight = inflight
      return Effect.gen(function* () {
        yield* Effect.sleep('5 seconds')
        inflight--
        return makeInstalledModel(id)
      })
    }
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('a')
      yield* q.enqueueCatalog('b')
      yield* q.enqueueCatalog('c')
      yield* q.enqueueCatalog('d')
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      expectEffect(maxInflight).toBeLessThanOrEqual(3)
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: tracker })))
  })
})

describe('DownloadQueueService — completion lifecycle', () => {
  itEffect('marks the job as completed after the download resolves', () => {
    const fastDownload = (id: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep('100 millis')
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('tiny')
      yield* TestClock.adjust('200 millis')
      const jobs = yield* q.getJobs
      const tiny = jobs.find((j) => j.modelId === 'tiny')
      expectEffect(tiny?.status).toBe('completed')
      expectEffect(tiny?.percent).toBe(100)
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: fastDownload })))
  })

  itEffect('removes the completed job after 4 seconds', () => {
    const fastDownload = (id: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep('100 millis')
        return makeInstalledModel(id)
      })
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('tiny')
      yield* TestClock.adjust('200 millis')
      yield* TestClock.adjust('4100 millis')
      const jobs = yield* q.getJobs
      expectEffect(jobs.find((j) => j.modelId === 'tiny')).toBeUndefined()
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: fastDownload })))
  })
})

describe('DownloadQueueService — failure lifecycle', () => {
  itEffect('marks the job as failed with the error message', () => {
    const failDownload = () =>
      Effect.fail(new DownloadError({ message: 'network died', modelId: 'tiny' }))
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('tiny')
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      const jobs = yield* q.getJobs
      const tiny = jobs.find((j) => j.modelId === 'tiny')
      expectEffect(tiny?.status).toBe('failed')
      expectEffect(tiny?.error).toBe('network died')
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: failDownload })))
  })

  itEffect('uses "Download failed" fallback when the error is not an Error instance', () => {
    const failDownload: ModelsStubOpts['downloadCatalogImpl'] = () =>
      Effect.fail('string-failure') as never
    return Effect.gen(function* () {
      const q = yield* DownloadQueueService
      yield* q.enqueueCatalog('tiny')
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      const jobs = yield* q.getJobs
      const tiny = jobs.find((j) => j.modelId === 'tiny')
      expectEffect(tiny?.status).toBe('failed')
      expectEffect(tiny?.error).toBe('Download failed')
    }).pipe(Effect.provide(withDeps({ downloadCatalogImpl: failDownload })))
  })
})

// Keep unused imports referenced for the typechecker.
void TestClock
void Layer
