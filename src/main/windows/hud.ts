import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { IPC, type HudState } from '../../shared/types'

let hudWindow: BrowserWindow | null = null

export function createHudWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.workArea

  hudWindow = new BrowserWindow({
    width: 260,
    height: 80,
    x: Math.round(x + width / 2 - 130),
    y: y + 12,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    hiddenInMissionControl: true,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  hudWindow.setAlwaysOnTop(true, 'floating')

  if (process.env.ELECTRON_RENDERER_URL) {
    hudWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/hud.html`)
  } else {
    hudWindow.loadFile(join(__dirname, '../renderer/hud.html'))
  }

  hudWindow.on('closed', () => {
    hudWindow = null
  })

  return hudWindow
}

export function getHudWindow(): BrowserWindow | null {
  return hudWindow
}

export function showHud(): void {
  if (!hudWindow) return
  hudWindow.showInactive()
}

export function hideHud(): void {
  if (!hudWindow) return
  hudWindow.hide()
}

export function broadcastHudState(state: HudState): void {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.webContents.send(IPC.HUD_STATE, state)
  }
  if (state.state === 'recording') {
    showHud()
  } else if (state.state === 'idle') {
    setTimeout(() => hideHud(), 800)
  }
}
