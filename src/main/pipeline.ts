import { applyDictionary, buildWhisperPrompt } from './text/dictionary'
import { sanitizeTranscription } from './text/sanitize'
import { expandSnippets } from './text/snippets'
import { cleanupText } from './ai/index'
import { getSettings, addHistoryEntry } from './store'
import { loadModelForTranscription, transcribeWithActiveEngine } from './stt/index'
import { getActiveModel } from './models/manager'
import { injectText } from './injection/macos'
import { broadcastHudState } from './windows/hud'
import { randomUUID } from 'node:crypto'

let recordingStartTime = 0

export async function processTranscription(pcm: Float32Array): Promise<string> {
  const settings = getSettings()
  const model = getActiveModel()

  broadcastHudState({ state: 'transcribing', level: 0, message: 'Transcribing…' })

  if (!model) {
    throw new Error('No active model selected. Download and select a model in Settings.')
  }

  await loadModelForTranscription(model)

  const prompt = buildWhisperPrompt(settings.dictionary)
  let rawText = await transcribeWithActiveEngine(pcm, {
    language: 'auto',
    prompt: model.engine === 'whisper' ? prompt : undefined,
    gpu: settings.gpuEnabled
  })

  rawText = sanitizeTranscription(rawText)
  if (!rawText) {
    broadcastHudState({ state: 'idle', level: 0, message: 'No speech detected' })
    return ''
  }

  let text = applyDictionary(rawText, settings.dictionary)
  text = await cleanupText(text, settings.ai)
  text = expandSnippets(text, settings.snippets)

  broadcastHudState({ state: 'injecting', level: 0, message: 'Pasting…' })
  await injectText(text)

  const durationMs = recordingStartTime > 0 ? Date.now() - recordingStartTime : 0
  addHistoryEntry({
    id: randomUUID(),
    text,
    rawText,
    timestamp: Date.now(),
    durationMs
  })

  broadcastHudState({ state: 'idle', level: 0 })
  return text
}

export function markRecordingStart(): void {
  recordingStartTime = Date.now()
}

export function markRecordingStop(): void {
  // kept for future timing metrics
}
