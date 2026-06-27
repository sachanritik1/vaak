import { Schema } from 'effect'

/**
 * Tagged errors for the dictation pipeline. Replaces the previous
 * `throw new Error(...)` sites across the main process so callers can
 * recover via `Effect.catchTag` / `Effect.catchTags`.
 *
 * Note: `cause` is a reserved key in `Schema.TaggedErrorClass` (it maps to
 * the native `Error.cause` option), so wrapped underlying errors use the
 * field name `error` (a `Schema.Defect`).
 */

export class NoActiveModelError extends Schema.TaggedErrorClass<NoActiveModelError>()(
  'NoActiveModelError',
  {
    message: Schema.String
  }
) {}

export class UnknownEngineError extends Schema.TaggedErrorClass<UnknownEngineError>()(
  'UnknownEngineError',
  {
    engine: Schema.String
  }
) {}

export class NoSttEngineLoadedError extends Schema.TaggedErrorClass<NoSttEngineLoadedError>()(
  'NoSttEngineLoadedError',
  {
    message: Schema.String
  }
) {}

export class TranscriptionError extends Schema.TaggedErrorClass<TranscriptionError>()(
  'TranscriptionError',
  {
    message: Schema.String,
    error: Schema.optional(Schema.Defect())
  }
) {}

export class RecordingTooShortError extends Schema.TaggedErrorClass<RecordingTooShortError>()(
  'RecordingTooShortError',
  {
    message: Schema.String
  }
) {}

export class DownloadError extends Schema.TaggedErrorClass<DownloadError>()(
  'DownloadError',
  {
    message: Schema.String,
    modelId: Schema.String,
    error: Schema.optional(Schema.Defect())
  }
) {}

export class UnknownModelError extends Schema.TaggedErrorClass<UnknownModelError>()(
  'UnknownModelError',
  {
    modelId: Schema.String
  }
) {}

export class InjectionError extends Schema.TaggedErrorClass<InjectionError>()(
  'InjectionError',
  {
    message: Schema.String,
    error: Schema.optional(Schema.Defect())
  }
) {}

export class AiCleanupError extends Schema.TaggedErrorClass<AiCleanupError>()(
  'AiCleanupError',
  {
    provider: Schema.String,
    error: Schema.optional(Schema.Defect())
  }
) {}

export class PermissionsError extends Schema.TaggedErrorClass<PermissionsError>()(
  'PermissionsError',
  {
    message: Schema.String,
    error: Schema.optional(Schema.Defect())
  }
) {}

export class HotkeyError extends Schema.TaggedErrorClass<HotkeyError>()(
  'HotkeyError',
  {
    message: Schema.String,
    error: Schema.optional(Schema.Defect())
  }
) {}

/** Union of all pipeline-level errors, useful for typed `Effect.catch`. */
export type PipelineError =
  | NoActiveModelError
  | UnknownEngineError
  | NoSttEngineLoadedError
  | TranscriptionError
  | RecordingTooShortError
  | InjectionError
  | AiCleanupError
