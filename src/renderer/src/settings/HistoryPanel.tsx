import type { AppSettings } from '../../../shared/types'

type Props = {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function HistoryPanel({ settings, onUpdate }: Props) {
  const handleClear = async () => {
    await window.openwhisper.clearHistory()
    const s = await window.openwhisper.getSettings()
    await onUpdate({ history: s.history })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-1">History</h2>
          <p className="text-slate-400 text-sm">Recent dictations stored locally on your device.</p>
        </div>
        {settings.history.length > 0 && (
          <button className="btn btn-danger" onClick={handleClear}>
            Clear History
          </button>
        )}
      </div>

      {settings.history.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No dictations yet. Hold your hotkey to start!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {settings.history.map((entry) => (
            <div key={entry.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{formatTime(entry.timestamp)}</span>
                <span className="text-xs text-slate-600">{formatDuration(entry.durationMs)}</span>
              </div>
              <p className="text-white text-sm">{entry.text}</p>
              {entry.rawText !== entry.text && (
                <p className="text-xs text-slate-600 mt-2 line-through">{entry.rawText}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
