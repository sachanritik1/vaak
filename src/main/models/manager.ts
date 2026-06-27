import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { app } from 'electron'
import { Context, Effect, Layer, Schema } from 'effect'
import { SettingsService } from '../store'
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
import { DownloadError, UnknownModelError } from '../errors'
import type { DownloadProgress, InstalledModel, SttEngineType } from '../../shared/types'

/**
 * ModelsService owns the model filesystem + the installed-models settings
 * list. Downloads report progress through a sync callback supplied by the
 * caller (the DownloadQueueService), preserving the original broadcast
 * behavior.
 */

type ProgressCb = (progress: DownloadProgress) => void

export interface ModelsService {
  readonly getInstalled: Effect.Effect<InstalledModel[], Schema.SchemaError>
  readonly downloadCatalog: (catalogId: string, onProgress: ProgressCb) => Effect.Effect<InstalledModel, DownloadError | UnknownModelError | Schema.SchemaError>
  readonly downloadCustom: (url: string, name: string | undefined, onProgress: ProgressCb) => Effect.Effect<InstalledModel, DownloadError | Schema.SchemaError>
  readonly deleteModel: (modelId: string) => Effect.Effect<void, Schema.SchemaError>
  readonly setActive: (modelId: string | null) => Effect.Effect<void, Schema.SchemaError>
  readonly getActive: Effect.Effect<InstalledModel | null, Schema.SchemaError>
}

export const ModelsService = Context.Service<ModelsService>('@vaak/Models')

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

function modelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function safeStatSize(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

function safeRemovePath(path: string): void {
  try {
    const st = statSync(path)
    if (st.isDirectory()) {
      rmSync(path, { recursive: true, force: true })
    } else {
      unlinkSync(path)
    }
  } catch {
    // ignore missing files
  }
}

export const ModelsLive = Layer.effect(ModelsService, Effect.gen(function* () {
  const settings = yield* SettingsService

  const downloadFile = (url: string, destPath: string, modelId: string, onProgress: ProgressCb) =>
    Effect.tryPromise({
      try: () =>
        new Promise<void>((resolve, reject) => {
          fetch(url, { redirect: 'follow' })
            .then((response) => {
              if (!response.ok) {
                reject(new DownloadError({ message: `Download failed: ${response.status} ${response.statusText}`, modelId }))
                return
              }
              const total = Number(response.headers.get('content-length') || 0)
              const body = response.body
              if (!body) {
                reject(new DownloadError({ message: 'No response body', modelId }))
                return
              }
              const file = createWriteStream(destPath)
              const reader = body.getReader()
              let downloaded = 0
              const pump = (): void => {
                reader
                  .read()
                  .then(({ done, value }) => {
                    if (done) {
                      file.end(() => resolve())
                      return
                    }
                    downloaded += value.byteLength
                    file.write(Buffer.from(value))
                    onProgress({
                      modelId,
                      downloaded,
                      total,
                      percent: total > 0 ? Math.round((downloaded / total) * 100) : 0
                    })
                    pump()
                  })
                  .catch((cause) => {
                    reject(new DownloadError({ message: 'Download stream failed', modelId, error: cause }))
                  })
              }
              pump()
            })
            .catch((cause) => {
              reject(new DownloadError({ message: 'Download request failed', modelId, error: cause }))
            })
        }),
      catch: (error) => error as DownloadError
    })

  const registerModel = (
    input: Omit<InstalledModel, 'sizeBytes'> & { sizeBytes?: number }
  ): Effect.Effect<InstalledModel, Schema.SchemaError> =>
    Effect.gen(function* () {
      let sizeBytes = input.sizeBytes ?? 0
      if (!sizeBytes && existsSync(input.path)) {
        sizeBytes = yield* Effect.sync(() => safeStatSize(input.path))
      }
      const model: InstalledModel = { ...input, sizeBytes }
      const current = yield* settings.get
      const existing = current.installedModels.filter((m) => m.id !== model.id)
      yield* settings.update({ installedModels: [...existing, model] })
      return model
    })

  const downloadCatalog = Effect.fn('Models.downloadCatalog')(
    function* (catalogId: string, onProgress: ProgressCb) {
      const entry = findCatalogEntry(catalogId)
      if (!entry) return yield* new UnknownModelError({ modelId: catalogId })

      const current = yield* settings.get
      const existing = current.installedModels.find((m) => m.id === entry!.id)
      if (existing) return { ...existing, engine: existing.engine ?? entry!.engine }

      if (entry!.engine === 'parakeet-coreml') {
        if (!isParakeetCoremlSupported()) {
          return yield* new DownloadError({
            message: 'Parakeet CoreML requires macOS on Apple Silicon (M1/M2/M3/M4).',
            modelId: entry!.id
          })
        }
        const modelDir = yield* Effect.tryPromise({
          try: () =>
            downloadParakeetCoremlModels((percent) => {
              onProgress({ modelId: entry!.id, downloaded: percent, total: 100, percent })
            }),
          catch: (cause) => new DownloadError({ message: 'Parakeet CoreML download failed', modelId: entry!.id, error: cause })
        })
        return yield* registerModel({
          id: entry!.id,
          name: entry!.name,
          filename: entry!.filename,
          path: modelDir,
          language: entry!.language,
          source: 'catalog',
          engine: entry!.engine,
          url: entry!.url,
          sizeBytes: entry!.sizeBytes
        })
      }

      if (entry!.engine === 'parakeet-gguf') {
        onProgress({ modelId: entry!.id, downloaded: 0, total: 100, percent: 0 })
        yield* Effect.tryPromise({
          try: () => ensureParakeetCli(),
          catch: (cause) => new DownloadError({ message: 'parakeet-cli setup failed', modelId: entry!.id, error: cause })
        })
        onProgress({ modelId: entry!.id, downloaded: 50, total: 100, percent: 50 })
      }

      if (entry!.engine === 'sherpa-onnx') {
        if (!entry!.files?.length || !entry!.sherpa) {
          return yield* new DownloadError({
            message: `Sherpa model ${entry!.id} is missing file list or config.`,
            modelId: entry!.id
          })
        }

        onProgress({ modelId: entry!.id, downloaded: 0, total: 100, percent: 0 })
        yield* Effect.tryPromise({
          try: () => ensureSherpaOffline(),
          catch: (cause) => new DownloadError({ message: 'sherpa-onnx setup failed', modelId: entry!.id, error: cause })
        })

        const modelDir = join(modelsDir(), entry!.id)
        if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true })

        const totalFiles = entry!.files!.length
        for (let i = 0; i < totalFiles; i++) {
          const file = entry!.files![i]
          const dest = join(modelDir, file.filename)
          if (!existsSync(dest)) {
            yield* downloadFile(file.url, dest, entry!.id, onProgress)
          }
          onProgress({
            modelId: entry!.id,
            downloaded: i + 1,
            total: totalFiles,
            percent: Math.round(((i + 1) / totalFiles) * 100)
          })
        }

        writeSherpaManifest(modelDir, entry!.sherpa!)

        return yield* registerModel({
          id: entry!.id,
          name: entry!.name,
          filename: entry!.filename,
          path: modelDir,
          language: entry!.language,
          source: 'catalog',
          engine: entry!.engine,
          url: entry!.url,
          sizeBytes: entry!.sizeBytes,
          sherpaManifest: entry!.sherpa
        })
      }

      const destPath = join(modelsDir(), entry!.filename)
      if (!existsSync(destPath)) {
        yield* downloadFile(entry!.url, destPath, entry!.id, onProgress)
      }

      return yield* registerModel({
        id: entry!.id,
        name: entry!.name,
        filename: entry!.filename,
        path: destPath,
        language: entry!.language,
        source: 'catalog',
        engine: entry!.engine,
        url: entry!.url
      })
    }
  )

  const downloadCustom = Effect.fn('Models.downloadCustom')(
    function* (urlInput: string, name: string | undefined, onProgress: ProgressCb) {
      const url = resolveHuggingFaceUrl(urlInput)
      const filename = filenameFromUrl(url)
      const engine = inferEngineFromFilename(filename)
      const hash = createHash('sha256').update(url).digest('hex').slice(0, 12)
      const id = `custom-${hash}`
      const destPath = join(modelsDir(), filename)

      if (!existsSync(destPath)) {
        yield* downloadFile(url, destPath, id, onProgress)
      }

      return yield* registerModel({
        id,
        name: name || filename,
        filename,
        path: destPath,
        language: 'multilingual',
        source: 'custom',
        engine,
        url
      })
    }
  )

  const deleteModel = Effect.fn('Models.delete')(function* (modelId: string) {
    const current = yield* settings.get
    const model = current.installedModels.find((m) => m.id === modelId)
    if (model && model.engine !== 'parakeet-coreml' && existsSync(model.path)) {
      yield* Effect.sync(() => safeRemovePath(model.path))
    }
    const installedModels = current.installedModels.filter((m) => m.id !== modelId)
    const activeModelId = current.activeModelId === modelId ? null : current.activeModelId
    yield* settings.update({ installedModels, activeModelId })
  })

  const setActive = Effect.fn('Models.setActive')(function* (modelId: string | null) {
    yield* settings.update({ activeModelId: modelId })
  })

  const getActive = Effect.gen(function* () {
    const current = yield* settings.get
    if (!current.activeModelId) return null
    const model = current.installedModels.find((m) => m.id === current.activeModelId)
    if (!model) return null
    return { ...model, engine: model.engine ?? ('whisper' as SttEngineType) }
  })

  const getInstalled = Effect.gen(function* () {
    const current = yield* settings.get
    return current.installedModels.map((m) => ({ ...m, engine: m.engine ?? ('whisper' as SttEngineType) }))
  })

  return { getInstalled, downloadCatalog, downloadCustom, deleteModel, setActive, getActive }
}))
