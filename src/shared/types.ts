export type PermissionStatus = {
  microphone: boolean
  accessibility: boolean
  inputMonitoring: boolean
  automation: boolean
}

export type HotkeyMode = 'hold' | 'toggle'

export type HotkeyConfig = {
  mode: HotkeyMode
  /** uiohook keycode */
  keycode: number
  /** Display label e.g. "Right Option" */
  label: string
  /** globalShortcut accelerator for toggle fallback */
  accelerator: string
}

export type AiProvider = 'none' | 'ollama' | 'openai' | 'anthropic'

export type AiConfig = {
  enabled: boolean
  provider: AiProvider
  ollamaUrl: string
  ollamaModel: string
  openaiApiKey: string
  openaiModel: string
  anthropicApiKey: string
  anthropicModel: string
}

export type DictionaryEntry = {
  word: string
  replacement?: string
}

export type Snippet = {
  id: string
  trigger: string
  content: string
}

export type HistoryEntry = {
  id: string
  text: string
  rawText: string
  timestamp: number
  durationMs: number
}

export type SttEngineType = 'whisper' | 'parakeet-coreml' | 'parakeet-gguf' | 'sherpa-onnx'

export type ModelFamily = 'whisper' | 'parakeet' | 'moonshine' | 'sensevoice' | 'nemo'

export type SherpaModelKind = 'moonshine' | 'sense-voice' | 'nemo-ctc'

export type SherpaCatalogConfig = {
  kind: SherpaModelKind
  modelType: string
  tokens: string
  preprocessor?: string
  encoder?: string
  uncachedDecoder?: string
  cachedDecoder?: string
  model?: string
  senseVoiceLanguage?: string
  senseVoiceItn?: boolean
}

export type ModelCatalogFile = {
  filename: string
  url: string
}

export type SherpaManifest = SherpaCatalogConfig

export type InstalledModel = {
  id: string
  name: string
  filename: string
  path: string
  sizeBytes: number
  language: string
  source: 'catalog' | 'custom'
  engine: SttEngineType
  url?: string
  /** Present for sherpa-onnx bundle installs */
  sherpaManifest?: SherpaManifest
}

export type ModelCatalogEntry = {
  id: string
  name: string
  filename: string
  url: string
  sizeBytes: number
  language: string
  description: string
  engine: SttEngineType
  family: ModelFamily
  /** Multi-file download list (sherpa-onnx bundles) */
  files?: ModelCatalogFile[]
  sherpa?: SherpaCatalogConfig
}

export type DownloadProgress = {
  modelId: string
  downloaded: number
  total: number
  percent: number
}

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed'

export type ModelDownloadJob = DownloadProgress & {
  status: DownloadStatus
  error?: string
}

export type DownloadEnqueueResult = {
  accepted: boolean
  modelId: string
  reason?: 'installed' | 'already_active'
}

export type AppSettings = {
  activeModelId: string | null
  hotkey: HotkeyConfig
  ai: AiConfig
  dictionary: DictionaryEntry[]
  snippets: Snippet[]
  history: HistoryEntry[]
  installedModels: InstalledModel[]
  gpuEnabled: boolean
  autoStart: boolean
}

export type RecordingState = 'idle' | 'recording' | 'transcribing' | 'injecting'

export type HudState = {
  state: RecordingState
  level: number
  message?: string
}

export const IPC = {
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  GET_PERMISSIONS: 'permissions:get',
  REQUEST_MICROPHONE: 'permissions:request-microphone',
  OPEN_ACCESSIBILITY: 'permissions:open-accessibility',
  OPEN_INPUT_MONITORING: 'permissions:open-input-monitoring',
  GET_MODEL_CATALOG: 'models:catalog',
  GET_INSTALLED_MODELS: 'models:installed',
  DOWNLOAD_MODEL: 'models:download',
  DOWNLOAD_CUSTOM: 'models:download-custom',
  DELETE_MODEL: 'models:delete',
  SET_ACTIVE_MODEL: 'models:set-active',
  DOWNLOAD_PROGRESS: 'models:download-progress',
  DOWNLOAD_UPDATED: 'models:download-updated',
  GET_DOWNLOADS: 'models:downloads',
  HUD_STATE: 'hud:state',
  PROCESS_RECORDING: 'dictation:process',
  TEST_INJECTION: 'injection:test',
  AI_CLEANUP: 'ai:cleanup',
  ADD_HISTORY: 'history:add',
  CLEAR_HISTORY: 'history:clear',
  OPEN_SETTINGS: 'app:open-settings',
  QUIT: 'app:quit'
} as const

export const DEFAULT_HOTKEY: HotkeyConfig = {
  mode: 'hold',
  keycode: 3640, // UiohookKey.AltRight — Right Option (⌥)
  label: 'Right Option (⌥)',
  accelerator: 'Alt+Space'
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  provider: 'none',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-haiku-20241022'
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeModelId: null,
  hotkey: DEFAULT_HOTKEY,
  ai: DEFAULT_AI_CONFIG,
  dictionary: [],
  snippets: [],
  history: [],
  installedModels: [],
  gpuEnabled: true,
  autoStart: false
}
