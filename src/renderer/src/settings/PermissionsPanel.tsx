import type { AppSettings, PermissionStatus } from '../../../shared/types'

type Props = {
  permissions: PermissionStatus
  settings: AppSettings
  onRefresh: () => void
}

export function PermissionsPanel({ permissions, settings, onRefresh }: Props) {
  const allGranted =
    permissions.microphone &&
    permissions.accessibility &&
    permissions.inputMonitoring

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">Setup</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Grant permissions to enable system-wide voice dictation. Hold{' '}
        <strong className="text-slate-300">{settings.hotkey.label}</strong> to dictate anywhere.
      </p>

      <div className="card">
        <div className="permission-row">
          <div>
            <p className="font-medium text-white">Microphone</p>
            <p className="text-xs text-slate-500 mt-1">Required to capture your voice</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${permissions.microphone ? 'badge-success' : 'badge-warning'}`}>
              {permissions.microphone ? 'Granted' : 'Required'}
            </span>
            {!permissions.microphone && (
              <button className="btn btn-primary" onClick={() => window.openwhisper.requestMicrophone().then(onRefresh)}>
                Grant
              </button>
            )}
          </div>
        </div>

        <div className="permission-row">
          <div>
            <p className="font-medium text-white">Accessibility</p>
            <p className="text-xs text-slate-500 mt-1">Required to paste text into other apps</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${permissions.accessibility ? 'badge-success' : 'badge-warning'}`}>
              {permissions.accessibility ? 'Granted' : 'Required'}
            </span>
            {!permissions.accessibility && (
              <button className="btn btn-secondary" onClick={() => window.openwhisper.openAccessibility()}>
                Open Settings
              </button>
            )}
          </div>
        </div>

        <div className="permission-row">
          <div>
            <p className="font-medium text-white">Input Monitoring</p>
            <p className="text-xs text-slate-500 mt-1">Required for global hold-to-talk hotkey</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${permissions.inputMonitoring ? 'badge-success' : 'badge-warning'}`}>
              {permissions.inputMonitoring ? 'Granted' : 'Required'}
            </span>
            {!permissions.inputMonitoring && (
              <button className="btn btn-secondary" onClick={() => window.openwhisper.openInputMonitoring()}>
                Open Settings
              </button>
            )}
          </div>
        </div>

        <div className="permission-row">
          <div>
            <p className="font-medium text-white">Automation (Apple Events)</p>
            <p className="text-xs text-slate-500 mt-1">Required for Cmd+V paste injection</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${permissions.automation ? 'badge-success' : 'badge-warning'}`}>
              {permissions.automation ? 'Granted' : 'May be required'}
            </span>
            <button className="btn btn-secondary" onClick={() => window.openwhisper.testInjection()}>
              Test Paste
            </button>
          </div>
        </div>
      </div>

      {allGranted && settings.activeModelId && (
        <div className="card border-green-500/20 bg-green-500/5">
          <p className="text-green-400 font-medium">Ready to dictate!</p>
          <p className="text-sm text-slate-400 mt-1">
            Hold <strong>{settings.hotkey.label}</strong> anywhere to start dictating.
          </p>
        </div>
      )}

      {!settings.activeModelId && (
        <div className="card border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 font-medium">Download a model</p>
          <p className="text-sm text-slate-400 mt-1">
            Go to the Models tab and download a Whisper model to get started.
          </p>
        </div>
      )}
    </div>
  )
}
