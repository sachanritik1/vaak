import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { HudApp } from './HudApp'

// Mock the audio recorder module so we don't try to actually use the mic.
const setLevelCallbackMock = vi.hoisted(() => vi.fn())
const isActiveMock = vi.hoisted(() => vi.fn(() => false))
const startMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const stopMock = vi.hoisted(() => vi.fn().mockResolvedValue(new Float32Array(0)))

vi.mock('../audio/recorder', () => ({
  audioRecorder: {
    setLevelCallback: setLevelCallbackMock,
    isActive: isActiveMock,
    start: startMock,
    stop: stopMock
  }
}))

beforeEach(() => {
  setLevelCallbackMock.mockReset()
  isActiveMock.mockReset().mockReturnValue(false)
  startMock.mockReset().mockResolvedValue(undefined)
  stopMock.mockReset().mockResolvedValue(new Float32Array(0))

  // Default: onHudState returns noop unsub; onDictationState returns noop unsub
  const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
  const onDictationState = window.vaak.onDictationState as ReturnType<typeof vi.fn>
  onHudState.mockReset().mockReturnValue(() => {})
  onDictationState.mockReset().mockReturnValue(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HudApp', () => {
  it('renders the "Vaak" idle label by default', () => {
    render(<HudApp />)
    expect(screen.getByText('Vaak')).toBeInTheDocument()
  })

  it('does NOT show the level meter in idle state', () => {
    const { container } = render(<HudApp />)
    expect(container.querySelector('.hud-meter')).toBeNull()
  })

  it('subscribes to onHudState and onDictationState on mount', () => {
    render(<HudApp />)
    expect(window.vaak.onHudState).toHaveBeenCalled()
    expect(window.vaak.onDictationState).toHaveBeenCalled()
  })

  it('registers a level callback on the audio recorder', () => {
    render(<HudApp />)
    expect(setLevelCallbackMock).toHaveBeenCalled()
  })

  it('unsubscribes both listeners on unmount', () => {
    const unsubHud = vi.fn()
    const unsubDict = vi.fn()
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    const onDictationState = window.vaak.onDictationState as ReturnType<typeof vi.fn>
    onHudState.mockReturnValue(unsubHud)
    onDictationState.mockReturnValue(unsubDict)
    const { unmount } = render(<HudApp />)
    unmount()
    expect(unsubHud).toHaveBeenCalled()
    expect(unsubDict).toHaveBeenCalled()
  })

  it('updates label to "Listening…" when state becomes "recording"', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    render(<HudApp />)
    act(() => {
      setState({ state: 'recording', level: 0 })
    })
    expect(screen.getByText('Listening…')).toBeInTheDocument()
  })

  it('updates label to "Transcribing…" when state becomes "transcribing"', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    render(<HudApp />)
    act(() => {
      setState({ state: 'transcribing', level: 0 })
    })
    expect(screen.getByText('Transcribing…')).toBeInTheDocument()
  })

  it('updates label to "Pasting…" when state becomes "injecting"', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    render(<HudApp />)
    act(() => {
      setState({ state: 'injecting', level: 0 })
    })
    expect(screen.getByText('Pasting…')).toBeInTheDocument()
  })

  it('uses the message override when set', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    render(<HudApp />)
    act(() => {
      setState({ state: 'recording', level: 0, message: 'Custom text' })
    })
    expect(screen.getByText('Custom text')).toBeInTheDocument()
  })

  it('shows the level meter when recording', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    const { container } = render(<HudApp />)
    act(() => {
      setState({ state: 'recording', level: 0 })
    })
    expect(container.querySelector('.hud-meter')).toBeInTheDocument()
  })

  it('applies the hud-card--active class when state is not idle', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    const { container } = render(<HudApp />)
    act(() => {
      setState({ state: 'recording', level: 0 })
    })
    expect(container.querySelector('.hud-card--active')).toBeInTheDocument()
  })

  it('level callback updates the meter width (only when recording)', () => {
    const onHudState = window.vaak.onHudState as ReturnType<typeof vi.fn>
    let setState: (s: any) => void = () => {}
    onHudState.mockImplementation((cb: any) => {
      setState = cb
      return () => {}
    })
    let levelCallback: (level: number) => void = () => {}
    setLevelCallbackMock.mockImplementation((cb: any) => {
      levelCallback = cb
    })
    const { container } = render(<HudApp />)
    // While idle, level changes should not change meter (it doesn't exist)
    act(() => {
      levelCallback(0.5)
    })
    // Start recording
    act(() => {
      setState({ state: 'recording', level: 0 })
    })
    act(() => {
      levelCallback(0.5)
    })
    // level 0.5 * 400 = 200 → capped at 100
    const fill = container.querySelector('.hud-meter-fill') as HTMLElement
    expect(fill?.style.width).toBe('100%')
  })

  it('onDictationState="recording" starts the audio recorder', async () => {
    isActiveMock.mockReturnValue(false)
    const onDictationState = window.vaak.onDictationState as ReturnType<typeof vi.fn>
    let setDictationState: (s: any) => void = () => {}
    onDictationState.mockImplementation((cb: any) => {
      setDictationState = cb
      return () => {}
    })
    render(<HudApp />)
    await act(async () => {
      await setDictationState('recording')
    })
    expect(startMock).toHaveBeenCalled()
  })

  it('onDictationState="recording" does NOT start if already active', async () => {
    isActiveMock.mockReturnValue(true)
    const onDictationState = window.vaak.onDictationState as ReturnType<typeof vi.fn>
    let setDictationState: (s: any) => void = () => {}
    onDictationState.mockImplementation((cb: any) => {
      setDictationState = cb
      return () => {}
    })
    render(<HudApp />)
    await act(async () => {
      await setDictationState('recording')
    })
    expect(startMock).not.toHaveBeenCalled()
  })

  it('onDictationState non-recording calls stop and processRecording', async () => {
    isActiveMock.mockReturnValue(true)
    stopMock.mockResolvedValue(new Float32Array([1, 2, 3]))
    const onDictationState = window.vaak.onDictationState as ReturnType<typeof vi.fn>
    let setDictationState: (s: any) => void = () => {}
    onDictationState.mockImplementation((cb: any) => {
      setDictationState = cb
      return () => {}
    })
    render(<HudApp />)
    await act(async () => {
      await setDictationState('idle')
    })
    expect(stopMock).toHaveBeenCalled()
    expect(window.vaak.processRecording).toHaveBeenCalled()
  })

  it('onDictationState="idle" with non-empty PCM calls processRecording with that PCM', async () => {
    isActiveMock.mockReturnValue(true)
    stopMock.mockResolvedValue(new Float32Array(100)) // 100 unique floats
    const onDictationState = window.vaak.onDictationState as ReturnType<typeof vi.fn>
    let setDictationState: (s: any) => void = () => {}
    onDictationState.mockImplementation((cb: any) => {
      setDictationState = cb
      return () => {}
    })
    render(<HudApp />)
    await act(async () => {
      await setDictationState('idle')
    })
    expect(window.vaak.processRecording).toHaveBeenCalled()
    // Find any call with non-empty ArrayBuffer
    const calls = (window.vaak.processRecording as ReturnType<typeof vi.fn>).mock.calls
    const nonEmptyCall = calls.find(
      (c) => c[0] instanceof ArrayBuffer && c[0].byteLength > 0
    )
    expect(nonEmptyCall).toBeDefined()
  })
})
