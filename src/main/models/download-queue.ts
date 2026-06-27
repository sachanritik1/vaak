import { BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { Context, Effect, Layer, Ref, Schema, Semaphore } from 'effect'
import { SettingsService } from '../store'
import { ModelsService } from './manager'
import { findCatalogEntry, resolveHuggingFaceUrl } from './catalog'
import { DownloadError, UnknownModelError } from '../errors'
import type { DownloadProgress, ModelDownloadJob } from '../../shared/types'
import { IPC } from '../../shared/types'

const MAX_CONCURRENT = 3

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

export type EnqueueResult = {
  accepted: boolean
  modelId: string
  reason?: 'installed' | 'already_active'
}

export interface DownloadQueueService {
  readonly enqueueCatalog: (catalogId: string) => Effect.Effect<EnqueueResult, UnknownModelError | Schema.SchemaError>
  readonly enqueueCustom: (url: string, name?: string) => Effect.Effect<EnqueueResult, Schema.SchemaError>
  readonly getJobs: Effect.Effect<ModelDownloadJob[]>
}

export const DownloadQueueService = Context.Service<DownloadQueueService>('@vaak/DownloadQueue')

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

/**
 * Sync progress callback body, lifted to module scope so the `Effect.runFork`
 * is not lexically inside an `Effect.gen`. The download stream fires this at
 * event time; it only touches `R = never` effects on the live runtime.
 */
function emitProgress(
  jobsRef: Ref.Ref<Map<string, InternalJob>>,
  progress: DownloadProgress
): void {
  Effect.runFork(
    Effect.gen(function* () {
      yield* Ref.update(jobsRef, (map) => {
        const job = map.get(progress.modelId)
        if (!job) return map
        return new Map(map).set(progress.modelId, {
          ...job,
          progress,
          status: job.status === 'queued' ? 'downloading' : job.status
        })
      })
      const jobs = yield* Ref.get(jobsRef)
      const state = [...jobs.values()].map(toJob)
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.DOWNLOAD_UPDATED, state)
        }
      }
    })
  )
}

export const DownloadQueueLive = Layer.effect(DownloadQueueService, Effect.gen(function* () {
  const settings = yield* SettingsService
  const models = yield* ModelsService
  const semaphore = yield* Semaphore.make(MAX_CONCURRENT)
  const jobsRef = yield* Ref.make<Map<string, InternalJob>>(new Map())

  const snapshot = Effect.gen(function* () {
    const jobs = yield* Ref.get(jobsRef)
    return [...jobs.values()].map(toJob)
  })

  const broadcastJobs = Effect.gen(function* () {
    const state = yield* snapshot
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.DOWNLOAD_UPDATED, state)
      }
    }
  })

  const updateJob = (modelId: string, mutate: (job: InternalJob) => InternalJob) =>
    Ref.update(jobsRef, (map) => {
      const job = map.get(modelId)
      if (!job) return map
      const next = mutate(job)
      return new Map(map).set(modelId, next)
    })

  // Sync progress callback handed to ModelsService downloads.
  const onProgress = (progress: DownloadProgress): void => {
    emitProgress(jobsRef, progress)
  }

  const removeJob = (modelId: string) =>
    Effect.gen(function* () {
      yield* Ref.update(jobsRef, (map) => {
        const next = new Map(map)
        next.delete(modelId)
        return next
      })
      yield* broadcastJobs
    })

  const runJob = (modelId: string): Effect.Effect<void> =>
    Effect.gen(function* () {
      const jobs = yield* Ref.get(jobsRef)
      const job = jobs.get(modelId)
      if (!job) return

      yield* updateJob(modelId, (j) => ({
        ...j,
        status: 'downloading',
        progress: { modelId, downloaded: 0, total: 0, percent: 0 },
        error: undefined
      }))
      yield* broadcastJobs

      yield* Effect.gen(function* () {
        if (job.kind === 'catalog' && job.catalogId) {
          yield* models.downloadCatalog(job.catalogId, onProgress)
        } else if (job.kind === 'custom' && job.customUrl) {
          yield* models.downloadCustom(job.customUrl, job.customName, onProgress)
        } else {
          return yield* new DownloadError({ message: 'Invalid download job', modelId })
        }
      }).pipe(
        Effect.andThen(
          Effect.gen(function* () {
            yield* updateJob(modelId, (j) => ({ ...j, status: 'completed', progress: { ...j.progress, percent: 100 } }))
            yield* broadcastJobs
            yield* Effect.sleep(4000).pipe(Effect.andThen(removeJob(modelId)), Effect.forkDetach)
          })
        ),
        Effect.catch((err) =>
          Effect.gen(function* () {
            yield* updateJob(modelId, (j) => ({
              ...j,
              status: 'failed',
              error: err instanceof Error ? err.message : 'Download failed'
            }))
            yield* broadcastJobs
          })
        )
      )
    })

  const enqueueCatalog = Effect.fn('DownloadQueue.enqueueCatalog')(function* (catalogId: string) {
    const entry = findCatalogEntry(catalogId)
    if (!entry) return yield* new UnknownModelError({ modelId: catalogId })

    const current = yield* settings.get
    if (current.installedModels.some((m) => m.id === catalogId)) {
      return { accepted: false, modelId: catalogId, reason: 'installed' as const }
    }

    const jobs = yield* Ref.get(jobsRef)
    const existing = jobs.get(catalogId)
    if (isActiveJob(existing)) {
      return { accepted: false, modelId: catalogId, reason: 'already_active' as const }
    }
    if (existing?.status === 'failed') {
      yield* Ref.update(jobsRef, (map) => {
        const next = new Map(map)
        next.delete(catalogId)
        return next
      })
    }

    yield* Ref.update(jobsRef, (map) => {
      const next = new Map(map)
      next.set(catalogId, {
        modelId: catalogId,
        kind: 'catalog',
        catalogId,
        status: 'queued',
        progress: { modelId: catalogId, downloaded: 0, total: 0, percent: 0 }
      })
      return next
    })
    yield* broadcastJobs

    yield* runJob(catalogId).pipe(semaphore.withPermits(1), Effect.forkDetach)

    return { accepted: true, modelId: catalogId }
  })

  const enqueueCustom = Effect.fn('DownloadQueue.enqueueCustom')(function* (urlInput: string, name?: string) {
    const url = resolveHuggingFaceUrl(urlInput)
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 12)
    const modelId = `custom-${hash}`

    const current = yield* settings.get
    if (current.installedModels.some((m) => m.id === modelId)) {
      return { accepted: false, modelId, reason: 'installed' as const }
    }

    const jobs = yield* Ref.get(jobsRef)
    const existing = jobs.get(modelId)
    if (isActiveJob(existing)) {
      return { accepted: false, modelId, reason: 'already_active' as const }
    }
    if (existing?.status === 'failed') {
      yield* Ref.update(jobsRef, (map) => {
        const next = new Map(map)
        next.delete(modelId)
        return next
      })
    }

    yield* Ref.update(jobsRef, (map) => {
      const next = new Map(map)
      next.set(modelId, {
        modelId,
        kind: 'custom',
        customUrl: url,
        customName: name,
        status: 'queued',
        progress: { modelId, downloaded: 0, total: 0, percent: 0 }
      })
      return next
    })
    yield* broadcastJobs

    yield* runJob(modelId).pipe(semaphore.withPermits(1), Effect.forkDetach)

    return { accepted: true, modelId }
  })

  return { enqueueCatalog, enqueueCustom, getJobs: snapshot }
}))
