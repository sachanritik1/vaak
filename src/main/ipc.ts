import { ipcMain } from 'electron'
import { Effect } from 'effect'
import { IPC } from '../shared/types'
import { SettingsService } from './store'
import { PermissionsService } from './permissions'
import { ModelsService } from './models/manager'
import { DownloadQueueService } from './models/download-queue'
import { InjectionService } from './injection/macos'
import { AiCleanupService } from './ai/index'
import { HotkeyService } from './hotkey/manager'
import { PipelineService } from './pipeline'
import { DictationStateService } from './dictation-state'
import { HudService } from './windows/hud'
import { MODEL_CATALOG } from './models/catalog'
import { isParakeetCoremlSupported } from './stt/parakeet-coreml-engine'
import { runMain } from './runtime'

const MIN_PCM_SAMPLES = 1600 // ~100ms at 16kHz

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GET_SETTINGS, () =>
    runMain(Effect.gen(function* () {
      const settings = yield* SettingsService
      return yield* settings.get
    }))
  )

  ipcMain.handle(IPC.SET_SETTINGS, (_e, partial) =>
    runMain(
      Effect.gen(function* () {
        const settings = yield* SettingsService
        const hotkey = yield* HotkeyService
        const updated = yield* settings.update(partial)
        yield* hotkey.reload
        return updated
      })
    )
  )

  ipcMain.handle(IPC.GET_PERMISSIONS, () =>
    runMain(Effect.gen(function* () {
      const perms = yield* PermissionsService
      return yield* perms.getStatus
    }))
  )

  ipcMain.handle(IPC.REQUEST_MICROPHONE, () =>
    runMain(Effect.gen(function* () {
      const perms = yield* PermissionsService
      return yield* perms.requestMicrophone
    }))
  )

  ipcMain.handle(IPC.OPEN_ACCESSIBILITY, () =>
    runMain(Effect.gen(function* () {
      const perms = yield* PermissionsService
      yield* perms.openAccessibility
    }))
  )

  ipcMain.handle(IPC.OPEN_INPUT_MONITORING, () =>
    runMain(Effect.gen(function* () {
      const perms = yield* PermissionsService
      yield* perms.openInputMonitoring
    }))
  )

  ipcMain.handle(IPC.GET_MODEL_CATALOG, () =>
    MODEL_CATALOG.filter(
      (entry) => entry.engine !== 'parakeet-coreml' || isParakeetCoremlSupported()
    )
  )

  ipcMain.handle(IPC.GET_INSTALLED_MODELS, () =>
    runMain(Effect.gen(function* () {
      const models = yield* ModelsService
      return yield* models.getInstalled
    }))
  )

  ipcMain.handle(IPC.GET_DOWNLOADS, () =>
    runMain(Effect.gen(function* () {
      const queue = yield* DownloadQueueService
      return yield* queue.getJobs
    }))
  )

  ipcMain.handle(IPC.DOWNLOAD_MODEL, (_e, catalogId: string) =>
    runMain(Effect.gen(function* () {
      const queue = yield* DownloadQueueService
      return yield* queue.enqueueCatalog(catalogId)
    }))
  )

  ipcMain.handle(IPC.DOWNLOAD_CUSTOM, (_e, url: string, name?: string) =>
    runMain(Effect.gen(function* () {
      const queue = yield* DownloadQueueService
      return yield* queue.enqueueCustom(url, name)
    }))
  )

  ipcMain.handle(IPC.DELETE_MODEL, (_e, modelId: string) =>
    runMain(
      Effect.gen(function* () {
        const models = yield* ModelsService
        yield* models.deleteModel(modelId)
        return yield* models.getInstalled
      })
    )
  )

  ipcMain.handle(IPC.SET_ACTIVE_MODEL, (_e, modelId: string | null) =>
    runMain(
      Effect.gen(function* () {
        const models = yield* ModelsService
        const settings = yield* SettingsService
        yield* models.setActive(modelId)
        return yield* settings.get
      })
    )
  )

  ipcMain.handle(IPC.TEST_INJECTION, () =>
    runMain(Effect.gen(function* () {
      const injection = yield* InjectionService
      return yield* injection.testInjection
    }))
  )

  ipcMain.handle(IPC.AI_CLEANUP, (_e, text: string) =>
    runMain(
      Effect.gen(function* () {
        const settings = yield* SettingsService
        const ai = yield* AiCleanupService
        const current = yield* settings.get
        return yield* ai.cleanupText(text, current.ai)
      })
    )
  )

  ipcMain.handle(IPC.CLEAR_HISTORY, () =>
    runMain(
      Effect.gen(function* () {
        const settings = yield* SettingsService
        yield* settings.clearHistory
        return yield* settings.get
      })
    )
  )

  ipcMain.handle(IPC.PROCESS_RECORDING, (_e, buffer: ArrayBuffer) =>
    runMain(handleProcessRecording(buffer))
  )
}

function handleProcessRecording(buffer: ArrayBuffer) {
  return Effect.gen(function* () {
    const dictation = yield* DictationStateService
    const pipeline = yield* PipelineService
    const hud = yield* HudService
    const hotkey = yield* HotkeyService

    yield* dictation.markProcessing

    const pcm = new Float32Array(buffer)

    if (pcm.length < MIN_PCM_SAMPLES) {
      yield* hud.broadcast({ state: 'idle', level: 0, message: 'Recording too short' })
      return { ok: false, error: 'Recording too short' }
    }

    return yield* Effect.gen(function* () {
      yield* pipeline.processTranscription(pcm)
      return { ok: true }
    }).pipe(
      Effect.catch((err) =>
        Effect.gen(function* () {
          const message = err instanceof Error ? err.message : 'Transcription failed'
          yield* hud.broadcast({ state: 'idle', level: 0, message })
          yield* Effect.logError('[dictation]', message)
          return { ok: false, error: message }
        })
      )
    )
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const dictation = yield* DictationStateService
        const hotkey = yield* HotkeyService
        yield* dictation.markIdle
        yield* hotkey.resetRecordingState
      })
    )
  )
}

export function ensureDictationIdle(): void {
  runMain(
    Effect.gen(function* () {
      const dictation = yield* DictationStateService
      const hotkey = yield* HotkeyService
      const hud = yield* HudService
      const canStart = yield* dictation.canStartRecording
      if (canStart) return
      yield* dictation.markIdle
      yield* hotkey.resetRecordingState
      yield* hud.broadcast({ state: 'idle', level: 0 })
    })
  )
}
