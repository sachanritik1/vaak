import Store from 'electron-store'
import { AppSettings, DEFAULT_HOTKEY, DEFAULT_SETTINGS } from '../shared/types'

const schema = {
  activeModelId: { type: 'string' as const, nullable: true },
  hotkey: { type: 'object' as const },
  ai: { type: 'object' as const },
  dictionary: { type: 'array' as const },
  snippets: { type: 'array' as const },
  history: { type: 'array' as const },
  installedModels: { type: 'array' as const },
  gpuEnabled: { type: 'boolean' as const },
  autoStart: { type: 'boolean' as const }
}

export const appStore = new Store<AppSettings>({
  name: 'openwhisper',
  defaults: DEFAULT_SETTINGS,
  schema
})

/** Fix legacy installs that mapped Command keycodes to Option labels */
function migrateHotkey(settings: AppSettings): AppSettings {
  const { hotkey } = settings
  const wrongOptionMappings: Record<number, number> = {
    3675: 3640, // was labeled Option but is Left Command
    3676: 56 // was labeled Option but is Right Command
  }

  const correctedKeycode = wrongOptionMappings[hotkey.keycode]
  if (correctedKeycode && hotkey.label.toLowerCase().includes('option')) {
    const migrated = {
      ...settings,
      hotkey: {
        ...DEFAULT_HOTKEY,
        ...hotkey,
        keycode: correctedKeycode,
        label: correctedKeycode === 3640 ? 'Right Option (⌥)' : 'Left Option (⌥)'
      }
    }
    appStore.set('hotkey', migrated.hotkey)
    return migrated
  }

  return settings
}

export function getSettings(): AppSettings {
  const settings: AppSettings = {
    activeModelId: appStore.get('activeModelId'),
    hotkey: appStore.get('hotkey'),
    ai: appStore.get('ai'),
    dictionary: appStore.get('dictionary'),
    snippets: appStore.get('snippets'),
    history: appStore.get('history'),
    installedModels: appStore.get('installedModels'),
    gpuEnabled: appStore.get('gpuEnabled'),
    autoStart: appStore.get('autoStart')
  }
  return migrateHotkey(settings)
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(partial)) {
    appStore.set(key as keyof AppSettings, value as never)
  }
  return getSettings()
}

export function addHistoryEntry(entry: AppSettings['history'][0]): void {
  const history = appStore.get('history')
  const next = [entry, ...history].slice(0, 200)
  appStore.set('history', next)
}

export function clearHistory(): void {
  appStore.set('history', [])
}
