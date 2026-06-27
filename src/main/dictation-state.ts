import { Context, Effect, Layer, Ref } from 'effect'

export type DictationPhase = 'idle' | 'recording' | 'processing'

export interface DictationStateService {
  readonly getPhase: Effect.Effect<DictationPhase>
  readonly canStartRecording: Effect.Effect<boolean>
  readonly markRecording: Effect.Effect<void>
  readonly markProcessing: Effect.Effect<void>
  readonly markIdle: Effect.Effect<void>
}

export const DictationStateService = Context.Service<DictationStateService>(
  '@vaak/DictationState'
)

export const DictationStateLive = Layer.effect(DictationStateService, Effect.gen(function* () {
  const phaseRef = yield* Ref.make<DictationPhase>('idle')

  return {
    getPhase: Ref.get(phaseRef),
    canStartRecording: Ref.get(phaseRef).pipe(Effect.map((p) => p === 'idle')),
    markRecording: Ref.set(phaseRef, 'recording'),
    markProcessing: Ref.set(phaseRef, 'processing'),
    markIdle: Ref.set(phaseRef, 'idle')
  }
}))
