import { clipboard } from 'electron'
import { execFile } from 'node:child_process'
import { Context, Effect, Layer, Ref } from 'effect'
import { InjectionError } from '../errors'

const VAAK_APP_NAMES = new Set(['Vaak', 'OpenWhisper', 'Electron'])

type ClipboardSnapshot = {
  text: string | null
  html: string | null
}

type InjectionState = {
  pasteTargetApp: string | null
  lastExternalApp: string | null
  pendingRestore: ClipboardSnapshot | null
}

export interface InjectionService {
  readonly capturePasteTarget: Effect.Effect<void>
  readonly clearPasteTarget: Effect.Effect<void>
  readonly injectText: (text: string) => Effect.Effect<void, InjectionError>
  readonly testInjection: Effect.Effect<boolean>
}

export const InjectionService = Context.Service<InjectionService>('@vaak/Injection')

const execFileEffect = (file: string, args: string[]): Effect.Effect<string, InjectionError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<string>((resolve, reject) => {
        execFile(file, args, (err, stdout) => {
          if (err) reject(err)
          else resolve(stdout)
        })
      }),
    catch: (cause) => new InjectionError({ message: `Failed to run ${file}`, error: cause })
  })

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

export const InjectionLive = Layer.effect(InjectionService, Effect.gen(function* () {
  const stateRef = yield* Ref.make<InjectionState>({
    pasteTargetApp: null,
    lastExternalApp: null,
    pendingRestore: null
  })

  const getFrontmostAppName = execFileEffect('osascript', [
    '-e',
    'tell application "System Events" to return name of first application process whose frontmost is true'
  ]).pipe(
    Effect.map((stdout) => stdout.trim() || null),
    Effect.catch(() => Effect.succeed<string | null>(null))
  )

  const capturePasteTarget = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.pendingRestore) {
      restoreClipboard(state.pendingRestore)
    }

    const front = yield* getFrontmostAppName
    if (front && !VAAK_APP_NAMES.has(front)) {
      yield* Ref.set(stateRef, {
        pasteTargetApp: front,
        lastExternalApp: front,
        pendingRestore: null
      })
    } else {
      yield* Ref.set(stateRef, {
        pasteTargetApp: state.lastExternalApp,
        lastExternalApp: state.lastExternalApp,
        pendingRestore: null
      })
    }
  })

  const clearPasteTarget = Ref.update(stateRef, (s) => ({ ...s, pasteTargetApp: null }))

  const activatePasteTarget = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const target = state.pasteTargetApp ?? state.lastExternalApp
    if (!target || VAAK_APP_NAMES.has(target)) return
    yield* execFileEffect('osascript', [
      '-e',
      `tell application "${target.replace(/"/g, '\\"')}" to activate`
    ]).pipe(
      Effect.andThen(() => Effect.sleep(120)),
      Effect.catch(() => Effect.void)
    )
  })

  const simulatePaste = execFileEffect('osascript', [
    '-e',
    'tell application "System Events" to keystroke "v" using command down'
  ])

  const injectText = Effect.fn('Injection.injectText')(function* (text: string) {
    if (!text.trim()) return

    const state = yield* Ref.get(stateRef)
    if (state.pendingRestore) {
      restoreClipboard(state.pendingRestore)
    }

    const snapshot = snapshotClipboard()
    clipboard.writeText(text)

    yield* Effect.gen(function* () {
      yield* activatePasteTarget
      yield* simulatePaste
      yield* Ref.update(stateRef, (s) => ({ ...s, pendingRestore: snapshot }))
    }).pipe(
      Effect.catch((err) =>
        Effect.gen(function* () {
          restoreClipboard(snapshot)
          return yield* err
        })
      )
    )
  })

  const testInjection = Effect.gen(function* () {
    yield* capturePasteTarget
    yield* injectText('Vaak test')
    return true
  }).pipe(Effect.catch(() => Effect.succeed(false)))

  return { capturePasteTarget, clearPasteTarget, injectText, testInjection }
}))
