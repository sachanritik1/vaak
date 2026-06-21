import { useEffect, useRef, useState } from 'react'
import type { HudState } from '../../../shared/types'
import { audioRecorder } from '../audio/recorder'

export function HudApp() {
  const [state, setState] = useState<HudState>({ state: 'idle', level: 0 })
  const processingRef = useRef(false)

  useEffect(() => {
    const unsubHud = window.vaak.onHudState(setState)

    const unsubDictation = window.vaak.onDictationState(async (dictationState) => {
      if (dictationState === 'recording') {
        if (audioRecorder.isActive()) return
        try {
          await audioRecorder.start()
        } catch (err) {
          console.error('Failed to start recording:', err)
        }
        return
      }

      // Always stop the mic when recording ends — even if a prior clip is still processing
      let pcm: Float32Array
      try {
        pcm = audioRecorder.isActive() ? await audioRecorder.stop() : new Float32Array(0)
      } catch (err) {
        console.error('Failed to stop recording:', err)
        return
      }

      if (processingRef.current || pcm.length === 0) {
        if (pcm.length === 0) {
          // Reset main-process dictation state when nothing was captured
          await window.vaak.processRecording(new ArrayBuffer(0))
        }
        return
      }

      processingRef.current = true
      try {
        const buffer = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength)
        await window.vaak.processRecording(buffer)
      } catch (err) {
        console.error('Failed to process recording:', err)
      } finally {
        processingRef.current = false
      }
    })

    return () => {
      unsubHud()
      unsubDictation()
    }
  }, [])

  useEffect(() => {
    audioRecorder.setLevelCallback((level) => {
      setState((prev) => (prev.state === 'recording' ? { ...prev, level } : prev))
    })
  }, [])

  const levelPercent = Math.min(100, Math.round(state.level * 400))
  const isActive = state.state !== 'idle'

  return (
    <div className="hud-shell">
      <div className={`hud-card ${isActive ? 'hud-card--active' : ''}`}>
        <div className="hud-indicator">
          <span className={`hud-dot ${state.state === 'recording' ? 'hud-dot--recording' : ''}`} />
          <span className="hud-label">
            {state.message ||
              (state.state === 'recording'
                ? 'Listening…'
                : state.state === 'transcribing'
                  ? 'Transcribing…'
                  : state.state === 'injecting'
                    ? 'Pasting…'
                    : 'Vaak')}
          </span>
        </div>
        {state.state === 'recording' && (
          <div className="hud-meter">
            <div className="hud-meter-fill" style={{ width: `${levelPercent}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
