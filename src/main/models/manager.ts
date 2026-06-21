import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { getSettings, updateSettings } from '../store'
import {
  filenameFromUrl,
  findCatalogEntry,
  inferEngineFromFilename,
  resolveHuggingFaceUrl
} from './catalog'
import { downloadParakeetCoremlModels, isParakeetCoremlSupported } from '../stt/parakeet-coreml-engine'
import { ensureParakeetCli } from '../stt/parakeet-cli-binary'
import { ensureSherpaOffline } from '../stt/sherpa-binary'
import { writeSherpaManifest } from '../stt/sherpa-manifest'
import { handleDownloadProgress } from './download-queue'
import type { DownloadProgress, InstalledModel, SttEngineType } from '../../shared/types'
import { IPC } from '../../shared/types'

function modelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function broadcastProgress(progress: DownloadProgress): void {
  handleDownloadProgress(progress)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.DOWNLOAD_PROGRESS, progress)
    }
  }
}

async function downloadFile(
  url: string,
  destPath: string,
  modelId: string
): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  const total = Number(response.headers.get('content-length') || 0)
  const body = response.body
  if (!body) throw new Error('No response body')

  const file = createWriteStream(destPath)
  const reader = body.getReader()
  let downloaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    downloaded += value.byteLength
    file.write(Buffer.from(value))
    broadcastProgress({
      modelId,
      downloaded,
      total,
      percent: total > 0 ? Math.round((downloaded / total) * 100) : 0
    })
  }

  await new Promise<void>((resolve, reject) => {
    file.end(() => resolve())
    file.on('error', reject)
  })
}

export function getInstalledModels(): InstalledModel[] {
  return getSettings().installedModels.map((m) => ({
    ...m,
    engine: m.engine ?? 'whisper'
  }))
}

export async function downloadCatalogModel(catalogId: string): Promise<InstalledModel> {
  const entry = findCatalogEntry(catalogId)
  if (!entry) throw new Error(`Unknown model: ${catalogId}`)

  const existing = getSettings().installedModels.find((m) => m.id === entry.id)
  if (existing) return { ...existing, engine: existing.engine ?? entry.engine }

  if (entry.engine === 'parakeet-coreml') {
    if (!isParakeetCoremlSupported()) {
      throw new Error('Parakeet CoreML requires macOS on Apple Silicon (M1/M2/M3/M4).')
    }
    const modelDir = await downloadParakeetCoremlModels((percent) => {
      broadcastProgress({
        modelId: entry.id,
        downloaded: percent,
        total: 100,
        percent
      })
    })
    return registerModel({
      id: entry.id,
      name: entry.name,
      filename: entry.filename,
      path: modelDir,
      language: entry.language,
      source: 'catalog',
      engine: entry.engine,
      url: entry.url,
      sizeBytes: entry.sizeBytes
    })
  }

  if (entry.engine === 'parakeet-gguf') {
    broadcastProgress({ modelId: entry.id, downloaded: 0, total: 100, percent: 0 })
    await ensureParakeetCli()
    broadcastProgress({ modelId: entry.id, downloaded: 50, total: 100, percent: 50 })
  }

  if (entry.engine === 'sherpa-onnx') {
    if (!entry.files?.length || !entry.sherpa) {
      throw new Error(`Sherpa model ${entry.id} is missing file list or config.`)
    }

    broadcastProgress({ modelId: entry.id, downloaded: 0, total: 100, percent: 0 })
    await ensureSherpaOffline()

    const modelDir = join(modelsDir(), entry.id)
    if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true })

    const totalFiles = entry.files.length
    for (let i = 0; i < totalFiles; i++) {
      const file = entry.files[i]
      const dest = join(modelDir, file.filename)
      if (!existsSync(dest)) {
        await downloadFile(file.url, dest, entry.id)
      }
      broadcastProgress({
        modelId: entry.id,
        downloaded: i + 1,
        total: totalFiles,
        percent: Math.round(((i + 1) / totalFiles) * 100)
      })
    }

    writeSherpaManifest(modelDir, entry.sherpa)

    return registerModel({
      id: entry.id,
      name: entry.name,
      filename: entry.filename,
      path: modelDir,
      language: entry.language,
      source: 'catalog',
      engine: entry.engine,
      url: entry.url,
      sizeBytes: entry.sizeBytes,
      sherpaManifest: entry.sherpa
    })
  }

  const destPath = join(modelsDir(), entry.filename)
  if (!existsSync(destPath)) {
    await downloadFile(entry.url, destPath, entry.id)
  }

  return registerModel({
    id: entry.id,
    name: entry.name,
    filename: entry.filename,
    path: destPath,
    language: entry.language,
    source: 'catalog',
    engine: entry.engine,
    url: entry.url
  })
}

export async function downloadCustomModel(urlInput: string, name?: string): Promise<InstalledModel> {
  const url = resolveHuggingFaceUrl(urlInput)
  const filename = filenameFromUrl(url)
  const engine = inferEngineFromFilename(filename)
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 12)
  const id = `custom-${hash}`
  const destPath = join(modelsDir(), filename)

  if (!existsSync(destPath)) {
    await downloadFile(url, destPath, id)
  }

  return registerModel({
    id,
    name: name || filename,
    filename,
    path: destPath,
    language: engine === 'parakeet-gguf' ? 'multilingual' : 'multilingual',
    source: 'custom',
    engine,
    url
  })
}

function registerModel(
  input: Omit<InstalledModel, 'sizeBytes'> & { sizeBytes?: number }
): InstalledModel {
  let sizeBytes = input.sizeBytes ?? 0
  if (!sizeBytes && existsSync(input.path)) {
    try {
      sizeBytes = statSync(input.path).size
    } catch {
      sizeBytes = 0
    }
  }
  const model: InstalledModel = { ...input, sizeBytes }
  const settings = getSettings()
  const existing = settings.installedModels.filter((m) => m.id !== model.id)
  updateSettings({ installedModels: [...existing, model] })
  return model
}

export function deleteModel(modelId: string): void {
  const settings = getSettings()
  const model = settings.installedModels.find((m) => m.id === modelId)
  if (model && model.engine !== 'parakeet-coreml' && existsSync(model.path)) {
    try {
      const st = statSync(model.path)
      if (st.isDirectory()) {
        rmSync(model.path, { recursive: true, force: true })
      } else {
        unlinkSync(model.path)
      }
    } catch {
      // ignore missing files
    }
  }
  const installedModels = settings.installedModels.filter((m) => m.id !== modelId)
  const activeModelId = settings.activeModelId === modelId ? null : settings.activeModelId
  updateSettings({ installedModels, activeModelId })
}

export function setActiveModel(modelId: string | null): void {
  updateSettings({ activeModelId: modelId })
}

export function getActiveModel(): InstalledModel | null {
  const settings = getSettings()
  if (!settings.activeModelId) return null
  const model = settings.installedModels.find((m) => m.id === settings.activeModelId)
  if (!model) return null
  return { ...model, engine: model.engine ?? 'whisper' }
}

/** @deprecated use getActiveModel */
export function getActiveModelPath(): string | null {
  return getActiveModel()?.path ?? null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function engineLabel(engine: SttEngineType): string {
  switch (engine) {
    case 'parakeet-coreml':
      return 'Parakeet · CoreML'
    case 'parakeet-gguf':
      return 'Parakeet · GGUF'
    case 'sherpa-onnx':
      return 'Sherpa-ONNX'
    default:
      return 'Whisper'
  }
}
