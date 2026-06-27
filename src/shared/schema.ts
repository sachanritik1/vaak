import { Schema } from 'effect'
import type {
  AppSettings,
  AiConfig,
  DictionaryEntry,
  HistoryEntry,
  HotkeyConfig,
  InstalledModel,
  ModelCatalogEntry,
  ModelCatalogFile,
  SherpaCatalogConfig,
  Snippet
} from './types'

/**
 * Effect Schema mirrors of the plain shared types in `types.ts`. The plain
 * types remain the contract used by the renderer/preload; these schemas give
 * the main process runtime validation + typed decoding for persisted settings
 * and HTTP/JSON responses.
 *
 * The schema `Type` for each is structurally identical to the corresponding
 * plain type, so decoded values flow back into the rest of the app unchanged.
 */

const HotkeyModeSchema = Schema.Literals(['hold', 'toggle'])
const AiProviderSchema = Schema.Literals(['none', 'ollama', 'openai', 'anthropic', 'openrouter'])
const SttEngineTypeSchema = Schema.Literals(['whisper', 'parakeet-coreml', 'parakeet-gguf', 'sherpa-onnx'])
const ModelFamilySchema = Schema.Literals(['whisper', 'parakeet', 'moonshine', 'sensevoice', 'nemo'])
const SherpaModelKindSchema = Schema.Literals(['moonshine', 'sense-voice', 'nemo-ctc'])

export const HotkeyConfigSchema = Schema.Struct({
  mode: HotkeyModeSchema,
  keycode: Schema.Number,
  label: Schema.String,
  accelerator: Schema.String
})

export const AiConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  provider: AiProviderSchema,
  ollamaUrl: Schema.String,
  ollamaModel: Schema.String,
  openaiApiKey: Schema.String,
  openaiModel: Schema.String,
  anthropicApiKey: Schema.String,
  anthropicModel: Schema.String,
  openrouterApiKey: Schema.String,
  openrouterModel: Schema.String
})

export const DictionaryEntrySchema = Schema.Struct({
  word: Schema.String,
  replacement: Schema.optional(Schema.String)
})

export const SnippetSchema = Schema.Struct({
  id: Schema.String,
  trigger: Schema.String,
  content: Schema.String
})

export const HistoryEntrySchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  rawText: Schema.String,
  timestamp: Schema.Number,
  durationMs: Schema.Number
})

export const SherpaCatalogConfigSchema = Schema.Struct({
  kind: SherpaModelKindSchema,
  modelType: Schema.String,
  tokens: Schema.String,
  preprocessor: Schema.optional(Schema.String),
  encoder: Schema.optional(Schema.String),
  uncachedDecoder: Schema.optional(Schema.String),
  cachedDecoder: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  senseVoiceLanguage: Schema.optional(Schema.String),
  senseVoiceItn: Schema.optional(Schema.Boolean)
})

export const InstalledModelSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  filename: Schema.String,
  path: Schema.String,
  sizeBytes: Schema.Number,
  language: Schema.String,
  source: Schema.Literals(['catalog', 'custom']),
  engine: SttEngineTypeSchema,
  url: Schema.optional(Schema.String),
  sherpaManifest: Schema.optional(SherpaCatalogConfigSchema)
})

export const ModelCatalogFileSchema = Schema.Struct({
  filename: Schema.String,
  url: Schema.String
})

export const ModelCatalogEntrySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  filename: Schema.String,
  url: Schema.String,
  sizeBytes: Schema.Number,
  language: Schema.String,
  description: Schema.String,
  engine: SttEngineTypeSchema,
  family: ModelFamilySchema,
  files: Schema.optional(Schema.Array(ModelCatalogFileSchema)),
  sherpa: Schema.optional(SherpaCatalogConfigSchema)
})

export const AppSettingsSchema = Schema.Struct({
  activeModelId: Schema.NullOr(Schema.String),
  hotkey: HotkeyConfigSchema,
  ai: AiConfigSchema,
  dictionary: Schema.Array(DictionaryEntrySchema),
  snippets: Schema.Array(SnippetSchema),
  history: Schema.Array(HistoryEntrySchema),
  installedModels: Schema.Array(InstalledModelSchema),
  gpuEnabled: Schema.Boolean,
  autoStart: Schema.Boolean
})

export type AppSettingsEncoded = typeof AppSettingsSchema.Type

export type AiConfigEncoded = AiConfig
export type HotkeyConfigEncoded = HotkeyConfig
export type DictionaryEntryEncoded = DictionaryEntry
export type SnippetEncoded = Snippet
export type HistoryEntryEncoded = HistoryEntry
export type InstalledModelEncoded = InstalledModel
export type ModelCatalogEntryEncoded = ModelCatalogEntry
export type ModelCatalogFileEncoded = ModelCatalogFile
export type SherpaCatalogConfigEncoded = SherpaCatalogConfig
