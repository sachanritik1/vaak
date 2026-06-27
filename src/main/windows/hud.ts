import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { Context, Effect, Layer } from 'effect'
import { IPC, type HudState } from '../../shared/types'

/**
 * The HUD window itself is an Electron resource created imperatively at
 * startup (see `createHudWindow`). The `HudService` wraps the side-effectful
 * interactions with that window as Effects.
 */

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

export interface HudService {
  readonly show: Effect.Effect<void>
  readonly hide: Effect.Effect<void>
  readonly broadcast: (state: HudState) => Effect.Effect<void>
  readonly notifyRecording: Effect.Effect<void>
  readonly notifyStop: Effect.Effect<void>
}

export const HudService = Context.Service<HudService>('@vaak/Hud')

const showEffect = Effect.sync(() => {
  if (hudWindow) hudWindow.showInactive()
})

const hideEffect = Effect.sync(() => {
  if (hudWindow) hudWindow.hide()
})

export const HudLive = Layer.succeed(HudService)({
  show: showEffect,
  hide: hideEffect,
  broadcast: (state) =>
    Effect.sync(() => {
      if (hudWindow && !hudWindow.isDestroyed()) {
        hudWindow.webContents.send(IPC.HUD_STATE, state)
      }
    }).pipe(
      Effect.andThen(
        Effect.sync(() => {
          if (state.state === 'recording') {
            if (hudWindow) hudWindow.showInactive()
          } else if (state.state === 'idle') {
            setTimeout(() => {
              if (hudWindow) hudWindow.hide()
            }, 800)
          }
        })
      )
    ),
  notifyRecording: Effect.sync(() => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.webContents.send('dictation:state', 'recording')
    }
  }),
  notifyStop: Effect.sync(() => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.webContents.send('dictation:state', 'idle')
    }
  })
})
