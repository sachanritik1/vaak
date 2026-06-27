import { Layer } from 'effect'
import { SettingsLive, SettingsService } from './store'
import { HudLive, HudService } from './windows/hud'
import { DictationStateLive, DictationStateService } from './dictation-state'
import { PermissionsLive, PermissionsService } from './permissions'
import { InjectionLive, InjectionService } from './injection/macos'
import { AiCleanupLive, AiCleanupService } from './ai/index'
import { SttLive, SttService } from './stt/index'
import { ModelsLive, ModelsService } from './models/manager'
import { DownloadQueueLive, DownloadQueueService } from './models/download-queue'
import { PipelineLive, PipelineService } from './pipeline'
import { HotkeyLive, HotkeyService } from './hotkey/manager'

export type AppEnv =
  | SettingsService
  | HudService
  | DictationStateService
  | PermissionsService
  | InjectionService
  | AiCleanupService
  | SttService
  | ModelsService
  | DownloadQueueService
  | PipelineService
  | HotkeyService

/**
 * Composed application layer. `Layer.provideMerge(that)` provides `that`'s
 * output to satisfy the accumulator's requirements and merges `that`'s output
 * in. Consumers are added first, providers last, so each provider's output
 * satisfies every upstream requirement for that service (Effect memoizes a
 * layer by reference, so a service is constructed once).
 */
export const AppLayer: Layer.Layer<AppEnv> = HotkeyLive.pipe(
  Layer.provideMerge(PipelineLive),
  Layer.provideMerge(DownloadQueueLive),
  Layer.provideMerge(ModelsLive),
  Layer.provideMerge(SttLive),
  Layer.provideMerge(AiCleanupLive),
  Layer.provideMerge(InjectionLive),
  Layer.provideMerge(PermissionsLive),
  Layer.provideMerge(DictationStateLive),
  Layer.provideMerge(HudLive),
  Layer.provideMerge(SettingsLive)
)
