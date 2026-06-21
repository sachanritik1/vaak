import { useEffect, useState } from 'react'
import type {
  AppSettings,
  ModelDownloadJob,
  PermissionStatus
} from '../../../shared/types'
import { PermissionsPanel } from './PermissionsPanel'
import { ModelsPanel } from './ModelsPanel'
import { HotkeyPanel } from './HotkeyPanel'
import { AiPanel } from './AiPanel'
import { DictionaryPanel } from './DictionaryPanel'
import { SnippetsPanel } from './SnippetsPanel'
import { HistoryPanel } from './HistoryPanel'

type Tab = 'setup' | 'models' | 'hotkey' | 'ai' | 'dictionary' | 'snippets' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'models', label: 'Models' },
  { id: 'hotkey', label: 'Hotkey' },
  { id: 'ai', label: 'AI Cleanup' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'snippets', label: 'Snippets' },
  { id: 'history', label: 'History' }
]

export function SettingsApp() {
  const [tab, setTab] = useState<Tab>('setup')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null)
  const [downloads, setDownloads] = useState<ModelDownloadJob[]>([])

  const refresh = async () => {
    const [s, p] = await Promise.all([
      window.openwhisper.getSettings(),
      window.openwhisper.getPermissions()
    ])
    setSettings(s)
    setPermissions(p)
  }

  useEffect(() => {
    refresh()
    void window.openwhisper.getDownloads().then(setDownloads)

    const unsubProgress = window.openwhisper.onDownloadProgress((progress) => {
      const p = progress as ModelDownloadJob
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.modelId === p.modelId)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          downloaded: p.downloaded,
          total: p.total,
          percent: p.percent,
          status: next[idx].status === 'queued' ? 'downloading' : next[idx].status
        }
        return next
      })
    })

    const unsubUpdated = window.openwhisper.onDownloadsUpdated((jobs) => {
      setDownloads(jobs)
      if (jobs.some((j) => j.status === 'completed')) {
        void refresh()
      }
    })

    const interval = setInterval(refresh, 3000)
    return () => {
      clearInterval(interval)
      unsubProgress()
      unsubUpdated()
    }
  }, [])

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const s = await window.openwhisper.setSettings(partial)
    setSettings(s)
  }

  const activeDownloadCount = downloads.filter(
    (d) => d.status === 'queued' || d.status === 'downloading'
  ).length

  if (!settings || !permissions) {
    return (
      <div className="settings-shell flex items-center justify-center h-full">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="settings-shell flex h-full">
      <aside className="settings-sidebar">
        <div className="px-6 mb-8">
          <h1 className="text-lg font-semibold text-white">OpenWhisper</h1>
          <p className="text-xs text-slate-500 mt-1">Local voice dictation</p>
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`settings-nav-item ${tab === t.id ? 'settings-nav-item--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="flex items-center justify-between gap-2 w-full">
                <span>{t.label}</span>
                {t.id === 'models' && activeDownloadCount > 0 && (
                  <span className="badge badge-warning">{activeDownloadCount}</span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="settings-main">
        {tab === 'setup' && (
          <PermissionsPanel permissions={permissions} onRefresh={refresh} settings={settings} />
        )}
        {tab === 'models' && (
          <ModelsPanel
            settings={settings}
            onUpdate={updateSettings}
            downloads={downloads}
            onRefresh={refresh}
          />
        )}
        {tab === 'hotkey' && (
          <HotkeyPanel settings={settings} onUpdate={updateSettings} />
        )}
        {tab === 'ai' && (
          <AiPanel settings={settings} onUpdate={updateSettings} />
        )}
        {tab === 'dictionary' && (
          <DictionaryPanel settings={settings} onUpdate={updateSettings} />
        )}
        {tab === 'snippets' && (
          <SnippetsPanel settings={settings} onUpdate={updateSettings} />
        )}
        {tab === 'history' && (
          <HistoryPanel settings={settings} onUpdate={updateSettings} />
        )}
      </main>
    </div>
  )
}
