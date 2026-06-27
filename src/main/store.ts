import Store from 'electron-store'
import { Context, Effect, Layer, Schema } from 'effect'
import { AppSettings, DEFAULT_HOTKEY, DEFAULT_SETTINGS, type HistoryEntry } from '../shared/types'
import { AppSettingsSchema } from '../shared/schema'

/**
 * SettingsService wraps `electron-store`. Reads run the legacy hotkey
 * migration and validate through the Effect Schema mirror of `AppSettings`.
 */

const storeSchema = {
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

export interface SettingsService {
  readonly get: Effect.Effect<AppSettings, Schema.SchemaError>
  readonly update: (partial: Partial<AppSettings>) => Effect.Effect<AppSettings, Schema.SchemaError>
  readonly addHistory: (entry: HistoryEntry) => Effect.Effect<void>
  readonly clearHistory: Effect.Effect<void>
}

export const SettingsService = Context.Service<SettingsService>('@vaak/Settings')

/** Fix legacy installs that mapped Command keycodes to Option labels */
function migrateHotkey(settings: AppSettings, store: Store<AppSettings>): AppSettings {
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
    store.set('hotkey', migrated.hotkey)
    return migrated
  }

  return settings
}

export const SettingsLive = Layer.effect(SettingsService, Effect.gen(function* () {
  const store = new Store<AppSettings>({
    name: 'vaak',
    defaults: DEFAULT_SETTINGS,
    schema: storeSchema
  })

  const readRaw = (): AppSettings => ({
    activeModelId: store.get('activeModelId'),
    hotkey: store.get('hotkey'),
    ai: store.get('ai'),
    dictionary: store.get('dictionary'),
    snippets: store.get('snippets'),
    history: store.get('history'),
    installedModels: store.get('installedModels'),
    gpuEnabled: store.get('gpuEnabled'),
    autoStart: store.get('autoStart')
  })

  const get = Effect.gen(function* () {
    const raw = readRaw()
    const validated = yield* Schema.decodeUnknownEffect(AppSettingsSchema)(raw)
    return migrateHotkey(validated as AppSettings, store)
  })

  const update = Effect.fn('Settings.update')(function* (partial: Partial<AppSettings>) {
    for (const [key, value] of Object.entries(partial)) {
      store.set(key as keyof AppSettings, value as never)
    }
    return yield* get
  })

  const addHistory = Effect.fn('Settings.addHistory')(function* (entry: HistoryEntry) {
    const history = store.get('history')
    const next = [entry, ...history].slice(0, 200)
    store.set('history', next)
  })

  const clearHistory = Effect.sync(() => {
    store.set('history', [])
  })

  return { get, update, addHistory, clearHistory }
}))
