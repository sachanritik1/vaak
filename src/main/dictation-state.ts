import { getHudWindow } from './windows/hud'

export type DictationPhase = 'idle' | 'recording' | 'processing'

let phase: DictationPhase = 'idle'

export function getDictationPhase(): DictationPhase {
  return phase
}

export function canStartRecording(): boolean {
  return phase === 'idle'
}

export function markDictationRecording(): void {
  phase = 'recording'
}

export function markDictationProcessing(): void {
  phase = 'processing'
}

export function markDictationIdle(): void {
  phase = 'idle'
}

export function sendToHud(channel: string, ...args: unknown[]): void {
  const hud = getHudWindow()
  if (hud && !hud.isDestroyed()) {
    hud.webContents.send(channel, ...args)
  }
}

export function notifyHudRecording(): void {
  sendToHud('dictation:state', 'recording')
}

export function notifyHudStop(): void {
  sendToHud('dictation:state', 'idle')
}
