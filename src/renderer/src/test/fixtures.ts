import { DEFAULT_AI_CONFIG, DEFAULT_HOTKEY, DEFAULT_SETTINGS, type AppSettings, type DictionaryEntry, type Snippet, type HistoryEntry, type InstalledModel } from '@shared/types'

/** Build an AppSettings fixture with overrides applied on top of DEFAULT_SETTINGS. */
export const makeSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
  hotkey: { ...DEFAULT_SETTINGS.hotkey, ...(overrides.hotkey ?? {}) },
  ai: { ...DEFAULT_AI_CONFIG, ...(overrides.ai ?? {}) }
})

/** Build a dictionary entry with sensible defaults. */
export const makeDictionaryEntry = (overrides: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
  word: 'k8s',
  ...overrides
})

/** Build a snippet with sensible defaults. */
export const makeSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: overrides.id ?? crypto.randomUUID(),
  trigger: 'my trigger',
  content: 'my content',
  ...overrides
})

/** Build a history entry. */
export const makeHistoryEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: overrides.id ?? crypto.randomUUID(),
  text: 'dictated text',
  rawText: 'raw dictated text',
  timestamp: Date.now(),
  durationMs: 1000,
  ...overrides
})

/** Build an InstalledModel. */
export const makeInstalledModel = (overrides: Partial<InstalledModel> = {}): InstalledModel => ({
  id: 'whisper-tiny',
  name: 'Whisper Tiny',
  filename: 'ggml-tiny.bin',
  path: '/models/ggml-tiny.bin',
  sizeBytes: 75_000_000,
  language: 'multilingual',
  source: 'catalog',
  engine: 'whisper',
  ...overrides
})

export { DEFAULT_HOTKEY, DEFAULT_AI_CONFIG, DEFAULT_SETTINGS }
