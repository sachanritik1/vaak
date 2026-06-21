import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

const LEGACY_APP_NAMES = ['OpenWhisper', 'openwhisper']

/** One-time copy of settings/models from the old OpenWhisper app data folder. */
export function migrateFromOpenWhisper(): void {
  const newUserData = app.getPath('userData')
  const appData = app.getPath('appData')

  for (const legacyName of LEGACY_APP_NAMES) {
    const legacyUserData = join(appData, legacyName)
    if (!existsSync(legacyUserData) || legacyUserData === newUserData) continue

    copyIfMissing(join(legacyUserData, 'openwhisper.json'), join(newUserData, 'vaak.json'))
    copyIfMissing(join(legacyUserData, 'config.json'), join(newUserData, 'vaak.json'))
    copyDirIfMissing(join(legacyUserData, 'models'), join(newUserData, 'models'))
    copyDirIfMissing(join(legacyUserData, 'bin'), join(newUserData, 'bin'))
  }
}

function copyIfMissing(from: string, to: string): void {
  if (!existsSync(from) || existsSync(to)) return
  mkdirSync(join(to, '..'), { recursive: true })
  cpSync(from, to)
}

function copyDirIfMissing(from: string, to: string): void {
  if (!existsSync(from)) return
  if (existsSync(to) && readdirSync(to).length > 0) return
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })
}
