import { clipboard } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const VAAK_APP_NAMES = new Set(['Vaak', 'OpenWhisper', 'Electron'])

type ClipboardSnapshot = {
  text: string | null
  html: string | null
}

let pasteTargetApp: string | null = null
let lastExternalApp: string | null = null
let pendingRestore: ClipboardSnapshot | null = null

function snapshotClipboard(): ClipboardSnapshot {
  return {
    text: clipboard.readText() || null,
    html: clipboard.readHTML() || null
  }
}

function restoreClipboard(snapshot: ClipboardSnapshot): void {
  if (snapshot.html) {
    clipboard.write({ text: snapshot.text ?? '', html: snapshot.html })
  } else if (snapshot.text !== null) {
    clipboard.writeText(snapshot.text)
  } else {
    clipboard.clear()
  }
}

async function getFrontmostAppName(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'tell application "System Events" to return name of first application process whose frontmost is true'
    ])
    const name = stdout.trim()
    return name || null
  } catch {
    return null
  }
}

/** Call when recording starts — remembers which app should receive the paste. */
export async function capturePasteTarget(): Promise<void> {
  if (pendingRestore) {
    restoreClipboard(pendingRestore)
    pendingRestore = null
  }

  const front = await getFrontmostAppName()
  if (front && !VAAK_APP_NAMES.has(front)) {
    pasteTargetApp = front
    lastExternalApp = front
  } else {
    pasteTargetApp = lastExternalApp
  }
}

export function clearPasteTarget(): void {
  pasteTargetApp = null
}

async function activatePasteTarget(): Promise<void> {
  const target = pasteTargetApp ?? lastExternalApp
  if (!target || VAAK_APP_NAMES.has(target)) return

  try {
    await execFileAsync('osascript', [
      '-e',
      `tell application "${target.replace(/"/g, '\\"')}" to activate`
    ])
    await delay(120)
  } catch (err) {
    console.warn('[injection] Failed to activate target app:', target, err)
  }
}

async function simulatePaste(): Promise<void> {
  await execFileAsync('osascript', [
    '-e',
    'tell application "System Events" to keystroke "v" using command down'
  ])
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function injectText(text: string): Promise<void> {
  if (!text.trim()) return

  if (pendingRestore) {
    restoreClipboard(pendingRestore)
    pendingRestore = null
  }

  const snapshot = snapshotClipboard()
  clipboard.writeText(text)

  try {
    await activatePasteTarget()
    await simulatePaste()
    // Keep transcription on clipboard until the next dictation so manual Cmd+V still works
    pendingRestore = snapshot
  } catch (err) {
    restoreClipboard(snapshot)
    throw err
  }
}

export async function testInjection(): Promise<boolean> {
  try {
    await capturePasteTarget()
    await injectText('Vaak test')
    return true
  } catch {
    return false
  }
}
