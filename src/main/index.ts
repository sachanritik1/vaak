import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { createHudWindow } from './windows/hud'
import { openSettingsWindow } from './windows/settings'
import { registerIpcHandlers, ensureDictationIdle } from './ipc'
import { initHotkeyManager, stopHotkeyManager } from './hotkey/manager'
import { markDictationIdle } from './dictation-state'

let tray: Tray | null = null

function createTrayIcon(): Electron.NativeImage {
  const trayCandidates = [
    join(__dirname, '../../resources/tray-icon@2x.png'),
    join(__dirname, '../../resources/tray-icon.png'),
    join(process.resourcesPath, 'resources/tray-icon@2x.png'),
    join(process.resourcesPath, 'resources/tray-icon.png')
  ]

  for (const p of trayCandidates) {
    const img = nativeImage.createFromPath(p)
    if (!img.isEmpty()) {
      if (process.platform === 'darwin') {
        const sized = img.resize({ width: 18, height: 18 })
        sized.setTemplateImage(true)
        return sized
      }
      return img.resize({ width: 18, height: 18 })
    }
  }

  const fallback = nativeImage.createFromNamedImage('NSMicrophone')
  if (process.platform === 'darwin') {
    fallback.setTemplateImage(true)
  }
  return fallback
}

export function createTray(): void {
  const icon = createTrayIcon()

  tray = new Tray(icon)
  tray.setToolTip('OpenWhisper')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => openSettingsWindow()
    },
    {
      label: 'Hold Right Option (⌥) to dictate',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit OpenWhisper',
      click: () => app.quit()
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => openSettingsWindow())
}

export function setupApp(): void {
  app.setName('OpenWhisper')

  app.whenReady().then(() => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide()
    }

    registerIpcHandlers()
    createHudWindow()
    createTray()

    // Reset any stale state from a previous crash
    markDictationIdle()
    ensureDictationIdle()

    initHotkeyManager({
      onStart: () => {
        // HUD audio capture is driven by notifyHudRecording()
      },
      onStop: () => {
        // HUD submits PCM via PROCESS_RECORDING IPC
      }
    })

    openSettingsWindow()
  })

  app.on('window-all-closed', () => {
    // Keep running in tray
  })

  app.on('before-quit', () => {
    stopHotkeyManager()
  })

  app.on('activate', () => {
    openSettingsWindow()
  })
}

setupApp()
