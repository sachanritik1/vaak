import { ipcMain } from 'electron'
import { IPC } from '../shared/types'
import { getSettings, updateSettings, clearHistory } from './store'
import {
  getPermissionStatus,
  requestMicrophoneAccess,
  openAccessibilitySettings,
  openInputMonitoringSettings
} from './permissions'
import { MODEL_CATALOG } from './models/catalog'
import {
  getInstalledModels,
  deleteModel,
  setActiveModel
} from './models/manager'
import {
  enqueueCatalogDownload,
  enqueueCustomDownload,
  getDownloadJobs
} from './models/download-queue'
import { testInjection } from './injection/macos'
import { cleanupText } from './ai/index'
import { reloadHotkey, resetHotkeyRecordingState } from './hotkey/manager'
import { processTranscription } from './pipeline'
import { broadcastHudState } from './windows/hud'
import {
  markDictationIdle,
  markDictationProcessing,
  canStartRecording
} from './dictation-state'

const MIN_PCM_SAMPLES = 1600 // ~100ms at 16kHz

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings())

  ipcMain.handle(IPC.SET_SETTINGS, (_e, partial) => {
    const settings = updateSettings(partial)
    reloadHotkey()
    return settings
  })

  ipcMain.handle(IPC.GET_PERMISSIONS, () => getPermissionStatus())

  ipcMain.handle(IPC.REQUEST_MICROPHONE, () => requestMicrophoneAccess())

  ipcMain.handle(IPC.OPEN_ACCESSIBILITY, () => {
    openAccessibilitySettings()
  })

  ipcMain.handle(IPC.OPEN_INPUT_MONITORING, () => {
    openInputMonitoringSettings()
  })

  ipcMain.handle(IPC.GET_MODEL_CATALOG, () => MODEL_CATALOG)

  ipcMain.handle(IPC.GET_INSTALLED_MODELS, () => getInstalledModels())

  ipcMain.handle(IPC.GET_DOWNLOADS, () => getDownloadJobs())

  ipcMain.handle(IPC.DOWNLOAD_MODEL, (_e, catalogId: string) =>
    enqueueCatalogDownload(catalogId)
  )

  ipcMain.handle(IPC.DOWNLOAD_CUSTOM, (_e, url: string, name?: string) =>
    enqueueCustomDownload(url, name)
  )

  ipcMain.handle(IPC.DELETE_MODEL, (_e, modelId: string) => {
    deleteModel(modelId)
    return getInstalledModels()
  })

  ipcMain.handle(IPC.SET_ACTIVE_MODEL, (_e, modelId: string | null) => {
    setActiveModel(modelId)
    return getSettings()
  })

  ipcMain.handle(IPC.TEST_INJECTION, () => testInjection())

  ipcMain.handle(IPC.AI_CLEANUP, (_e, text: string) => {
    const settings = getSettings()
    return cleanupText(text, settings.ai)
  })

  ipcMain.handle(IPC.CLEAR_HISTORY, () => {
    clearHistory()
    return getSettings()
  })

  ipcMain.handle(IPC.PROCESS_RECORDING, async (_e, buffer: ArrayBuffer) => {
    return handleProcessRecording(buffer)
  })
}

async function handleProcessRecording(buffer: ArrayBuffer): Promise<{ ok: boolean; error?: string }> {
  markDictationProcessing()

  try {
    const pcm = new Float32Array(buffer)

    if (pcm.length < MIN_PCM_SAMPLES) {
      broadcastHudState({ state: 'idle', level: 0, message: 'Recording too short' })
      return { ok: false, error: 'Recording too short' }
    }

    await processTranscription(pcm)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    broadcastHudState({ state: 'idle', level: 0, message })
    console.error('[dictation]', message)
    return { ok: false, error: message }
  } finally {
    markDictationIdle()
    resetHotkeyRecordingState()
  }
}

export function ensureDictationIdle(): void {
  if (canStartRecording()) return
  markDictationIdle()
  resetHotkeyRecordingState()
  broadcastHudState({ state: 'idle', level: 0 })
}
