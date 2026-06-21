import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppSettings, type DownloadEnqueueResult, type HudState, type ModelDownloadJob, type PermissionStatus } from '../shared/types'

export type VaakApi = {
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getPermissions: () => Promise<PermissionStatus>
  requestMicrophone: () => Promise<boolean>
  openAccessibility: () => Promise<void>
  openInputMonitoring: () => Promise<void>
  getModelCatalog: () => Promise<unknown[]>
  getInstalledModels: () => Promise<unknown[]>
  downloadModel: (catalogId: string) => Promise<DownloadEnqueueResult>
  downloadCustomModel: (url: string, name?: string) => Promise<DownloadEnqueueResult>
  getDownloads: () => Promise<ModelDownloadJob[]>
  deleteModel: (modelId: string) => Promise<unknown[]>
  setActiveModel: (modelId: string | null) => Promise<AppSettings>
  testInjection: () => Promise<boolean>
  aiCleanup: (text: string) => Promise<string>
  clearHistory: () => Promise<AppSettings>
  processRecording: (pcm: ArrayBuffer | SharedArrayBuffer) => Promise<{ ok: boolean; error?: string }>
  onHudState: (cb: (state: HudState) => void) => () => void
  onDownloadProgress: (cb: (progress: unknown) => void) => () => void
  onDownloadsUpdated: (cb: (jobs: ModelDownloadJob[]) => void) => () => void
  onDictationState: (cb: (state: 'recording' | 'idle') => void) => () => void
}

const api: VaakApi = {
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  setSettings: (partial) => ipcRenderer.invoke(IPC.SET_SETTINGS, partial),
  getPermissions: () => ipcRenderer.invoke(IPC.GET_PERMISSIONS),
  requestMicrophone: () => ipcRenderer.invoke(IPC.REQUEST_MICROPHONE),
  openAccessibility: () => ipcRenderer.invoke(IPC.OPEN_ACCESSIBILITY),
  openInputMonitoring: () => ipcRenderer.invoke(IPC.OPEN_INPUT_MONITORING),
  getModelCatalog: () => ipcRenderer.invoke(IPC.GET_MODEL_CATALOG),
  getInstalledModels: () => ipcRenderer.invoke(IPC.GET_INSTALLED_MODELS),
  downloadModel: (id) => ipcRenderer.invoke(IPC.DOWNLOAD_MODEL, id),
  downloadCustomModel: (url, name) => ipcRenderer.invoke(IPC.DOWNLOAD_CUSTOM, url, name),
  getDownloads: () => ipcRenderer.invoke(IPC.GET_DOWNLOADS),
  deleteModel: (id) => ipcRenderer.invoke(IPC.DELETE_MODEL, id),
  setActiveModel: (id) => ipcRenderer.invoke(IPC.SET_ACTIVE_MODEL, id),
  testInjection: () => ipcRenderer.invoke(IPC.TEST_INJECTION),
  aiCleanup: (text) => ipcRenderer.invoke(IPC.AI_CLEANUP, text),
  clearHistory: () => ipcRenderer.invoke(IPC.CLEAR_HISTORY),
  processRecording: (pcm) => ipcRenderer.invoke(IPC.PROCESS_RECORDING, pcm),
  onHudState: (cb) => {
    const handler = (_: unknown, state: HudState) => cb(state)
    ipcRenderer.on(IPC.HUD_STATE, handler)
    return () => ipcRenderer.removeListener(IPC.HUD_STATE, handler)
  },
  onDownloadProgress: (cb) => {
    const handler = (_: unknown, progress: unknown) => cb(progress)
    ipcRenderer.on(IPC.DOWNLOAD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.DOWNLOAD_PROGRESS, handler)
  },
  onDownloadsUpdated: (cb) => {
    const handler = (_: unknown, jobs: ModelDownloadJob[]) => cb(jobs)
    ipcRenderer.on(IPC.DOWNLOAD_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC.DOWNLOAD_UPDATED, handler)
  },
  onDictationState: (cb) => {
    const handler = (_: unknown, state: 'recording' | 'idle') => cb(state)
    ipcRenderer.on('dictation:state', handler)
    return () => ipcRenderer.removeListener('dictation:state', handler)
  }
}

contextBridge.exposeInMainWorld('vaak', api)

declare global {
  interface Window {
    vaak: VaakApi
  }
}
