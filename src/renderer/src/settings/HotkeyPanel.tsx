import type { AppSettings, HotkeyMode } from '../../../shared/types'
import { DEFAULT_HOTKEY } from '../../../shared/types'

type Props = {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}

/** uiohook keycodes — must match UiohookKey in uiohook-napi */
const HOTKEY_OPTIONS = [
  { keycode: 3640, label: 'Right Option (⌥)', accelerator: 'Alt+Space' },
  { keycode: 56, label: 'Left Option (⌥)', accelerator: 'Alt+Shift+Space' },
  { keycode: 3676, label: 'Right Command (⌘)', accelerator: 'Command+Shift+Space' },
  { keycode: 3675, label: 'Left Command (⌘)', accelerator: 'Command+Space' },
  { keycode: 3613, label: 'Right Control (⌃)', accelerator: 'Control+Space' },
  { keycode: 29, label: 'Left Control (⌃)', accelerator: 'Control+Shift+Space' }
]

export function HotkeyPanel({ settings, onUpdate }: Props) {
  const updateHotkey = (partial: Partial<typeof settings.hotkey>) => {
    onUpdate({ hotkey: { ...settings.hotkey, ...partial } })
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">Hotkey</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Configure how you trigger voice dictation system-wide. Press Escape while recording to cancel.
      </p>

      <div className="card">
        <h3 className="font-medium text-white mb-4">Activation Mode</h3>
        <div className="flex gap-3">
          {(['hold', 'toggle'] as HotkeyMode[]).map((mode) => (
            <button
              key={mode}
              className={`btn ${settings.hotkey.mode === mode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateHotkey({ mode })}
            >
              {mode === 'hold' ? 'Hold to Talk' : 'Toggle (Shortcut)'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {settings.hotkey.mode === 'hold'
            ? 'Hold the key while speaking, release to transcribe and paste.'
            : 'Press the hotkey once to start, press again to stop and paste.'}
        </p>
      </div>

      <div className="card">
        <h3 className="font-medium text-white mb-4">Hotkey</h3>
        <div className="grid grid-cols-2 gap-2">
          {HOTKEY_OPTIONS.map((opt) => (
            <button
              key={opt.keycode}
              className={`btn text-left justify-start ${
                settings.hotkey.keycode === opt.keycode ? 'btn-primary' : 'btn-secondary'
              }`}
              onClick={() =>
                updateHotkey({
                  keycode: opt.keycode,
                  label: opt.label,
                  accelerator: opt.accelerator
                })
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-secondary mt-4"
          onClick={() => onUpdate({ hotkey: DEFAULT_HOTKEY })}
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}
