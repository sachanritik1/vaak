import { BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { getSettings } from '../store'
import { findCatalogEntry, resolveHuggingFaceUrl, filenameFromUrl } from './catalog'
import { downloadCatalogModel, downloadCustomModel } from './manager'
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

const jobs = new Map<string, InternalJob>()
const pending: string[] = []
let activeCount = 0

function snapshot(): ModelDownloadJob[] {
  return [...jobs.values()].map((job) => ({
    modelId: job.modelId,
    status: job.status,
    downloaded: job.progress.downloaded,
    total: job.progress.total,
    percent: job.progress.percent,
    error: job.error
  }))
}

function broadcastJobs(): void {
  const state = snapshot()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.DOWNLOAD_UPDATED, state)
    }
  }
}

function updateJobProgress(progress: DownloadProgress): void {
  const job = jobs.get(progress.modelId)
  if (!job) return
  job.progress = progress
  if (job.status === 'queued') {
    job.status = 'downloading'
  }
}

export function handleDownloadProgress(progress: DownloadProgress): void {
  updateJobProgress(progress)
}

function isActiveJob(job: InternalJob | undefined): boolean {
  if (!job) return false
  return job.status === 'queued' || job.status === 'downloading'
}

function removeJob(modelId: string): void {
  jobs.delete(modelId)
  broadcastJobs()
}

async function runJob(modelId: string): Promise<void> {
  const job = jobs.get(modelId)
  if (!job) return

  job.status = 'downloading'
  job.progress = { modelId, downloaded: 0, total: 0, percent: 0 }
  job.error = undefined
  broadcastJobs()

  try {
    if (job.kind === 'catalog' && job.catalogId) {
      await downloadCatalogModel(job.catalogId)
    } else if (job.kind === 'custom' && job.customUrl) {
      await downloadCustomModel(job.customUrl, job.customName)
    } else {
      throw new Error('Invalid download job')
    }

    job.status = 'completed'
    job.progress.percent = 100
    broadcastJobs()
    setTimeout(() => removeJob(modelId), 4000)
  } catch (err) {
    job.status = 'failed'
    job.error = err instanceof Error ? err.message : 'Download failed'
    broadcastJobs()
  }
}

function pumpQueue(): void {
  while (activeCount < MAX_CONCURRENT && pending.length > 0) {
    const modelId = pending.shift()
    if (!modelId) break

    const job = jobs.get(modelId)
    if (!job || job.status === 'completed') continue

    activeCount++
    void runJob(modelId).finally(() => {
      activeCount--
      pumpQueue()
    })
  }
}

export type EnqueueResult = {
  accepted: boolean
  modelId: string
  reason?: 'installed' | 'already_active'
}

export function enqueueCatalogDownload(catalogId: string): EnqueueResult {
  const entry = findCatalogEntry(catalogId)
  if (!entry) throw new Error(`Unknown model: ${catalogId}`)

  const installed = getSettings().installedModels.some((m) => m.id === catalogId)
  if (installed) {
    return { accepted: false, modelId: catalogId, reason: 'installed' }
  }

  const existing = jobs.get(catalogId)
  if (isActiveJob(existing)) {
    return { accepted: false, modelId: catalogId, reason: 'already_active' }
  }

  if (existing?.status === 'failed') {
    jobs.delete(catalogId)
  }

  jobs.set(catalogId, {
    modelId: catalogId,
    kind: 'catalog',
    catalogId,
    status: 'queued',
    progress: { modelId: catalogId, downloaded: 0, total: 0, percent: 0 }
  })

  pending.push(catalogId)
  broadcastJobs()
  pumpQueue()

  return { accepted: true, modelId: catalogId }
}

export function enqueueCustomDownload(urlInput: string, name?: string): EnqueueResult {
  const url = resolveHuggingFaceUrl(urlInput)
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 12)
  const modelId = `custom-${hash}`

  const installed = getSettings().installedModels.some((m) => m.id === modelId)
  if (installed) {
    return { accepted: false, modelId, reason: 'installed' }
  }

  const existing = jobs.get(modelId)
  if (isActiveJob(existing)) {
    return { accepted: false, modelId, reason: 'already_active' }
  }

  if (existing?.status === 'failed') {
    jobs.delete(modelId)
  }

  jobs.set(modelId, {
    modelId,
    kind: 'custom',
    customUrl: url,
    customName: name,
    status: 'queued',
    progress: { modelId, downloaded: 0, total: 0, percent: 0 }
  })

  pending.push(modelId)
  broadcastJobs()
  pumpQueue()

  return { accepted: true, modelId }
}

export function getDownloadJobs(): ModelDownloadJob[] {
  return snapshot()
}
