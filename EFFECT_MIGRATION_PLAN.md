# Effect v4 Migration Plan (Vaak / OpenWhisper)

## Scope & ground rules

- Full migration of the **main process** (`src/main/**`) to Effect v4. Renderer (`src/renderer/**`, React) and the preload bridge ([src/preload/index.ts](src/preload/index.ts)) stay as-is; the IPC contract in [src/shared/types.ts](src/shared/types.ts) is preserved.
- Package manager: **npm** (only `package-lock.json` present). Core `effect` only (Schema lives in `effect/Schema`; no `@effect/schema`, no `@effect/platform`).
- Effect versioning: `npm view effect dist-tags` shows `latest: 3.21.4`, `beta: 4.0.0-beta.90`. v4 lives on the `beta` tag, so we install `effect@beta` to match the `effect-smol` v4 source reference and the "Effect v4" goal.
- Confirm before: installing packages, editing `tsconfig.json`, creating agent files. Each will be a discrete step.

## Phase 0 - Effect tooling (follows the setup guide)

- Install `effect-solutions` CLI, run `effect-solutions list`, then read `effect-solutions show project-setup` and `effect-solutions show tsconfig` before touching config.
- Add deps: `npm add effect@beta` (v4 is on the `beta` dist-tag).
- Effect Language Service: `npm add -D @effect/language-service`, add the plugin to `tsconfig.json` `compilerOptions.plugins`, add a `prepare`/patch script per the guide, and add `.vscode/settings.json` to use the workspace TS + plugin.
- Apply recommended `tsconfig` compiler options from `effect-solutions show tsconfig` (keep `strict`, add `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess` if recommended) - reconciled with the existing Electron/Vite settings in [tsconfig.json](tsconfig.json).
- Keep existing `typecheck` script (`tsc --noEmit` already present at [package.json](package.json) line 14).
- Clone v4 source reference: `git clone --depth 1 https://github.com/Effect-TS/effect-smol.git ~/.local/share/effect-solutions/effect` (pull if it exists).

## Phase 1 - Effect foundations

- `src/main/runtime.ts`: build a single `ManagedRuntime` from the composed `AppLayer`; created once in `app.whenReady`. Export a `runMain`/`runPromise` helper that IPC handlers and uiohook/globalShortcut callbacks call at the imperative boundary.
- `src/main/errors.ts`: `Data.TaggedError` types replacing thrown `Error`s, e.g. `NoActiveModelError`, `TranscriptionError`, `DownloadError`, `InjectionError`, `AiCleanupError`, `UnknownEngineError`, `RecordingTooShortError`.
- Schema: add `effect/Schema` definitions for `AppSettings` and its nested types in [src/shared/types.ts](src/shared/types.ts) (or a new `src/shared/schema.ts`), used by the settings service for decode/validate and for parsing AI/HTTP JSON responses. Keep existing exported TS types via `Schema.Schema.Type` to avoid breaking the renderer.

## Phase 2 - Services & layers (one per subsystem)

Convert each module to an `Effect.Service` with a `Layer`, replacing module-level mutable state with `Ref`/`SubscriptionRef` and `async`/`throw` with `Effect`:

- `SettingsService` from [src/main/store.ts](src/main/store.ts): wraps `electron-store`, `get/update/addHistory/clearHistory`, runs `migrateHotkey` on read.
- `HudService` from [src/main/windows/hud.ts](src/main/windows/hud.ts) + `broadcastHudState`; `DictationStateService` from [src/main/dictation-state.ts](src/main/dictation-state.ts) (`phase` becomes a `Ref`).
- `PermissionsService` from [src/main/permissions.ts](src/main/permissions.ts): wrap `systemPreferences` + `execSync` calls in `Effect.tryPromise`/`Effect.sync`; `inputMonitoringGranted` becomes a `Ref`.
- `InjectionService` from [src/main/injection/macos.ts](src/main/injection/macos.ts): clipboard snapshot/restore + `osascript` via `execFile` wrapped in Effect; `pasteTargetApp`/`pendingRestore` become `Ref`s; `delay` -> `Effect.sleep`.
- `AiCleanupService` from [src/main/ai/*](src/main/ai/index.ts): `cleanupText` as an Effect; `fetch` calls in [openai.ts](src/main/ai/openai.ts)/[ollama.ts](src/main/ai/ollama.ts)/[anthropic.ts](src/main/ai/anthropic.ts) via `Effect.tryPromise` with Schema-decoded responses; failure falls back to raw text via `Effect.orElseSucceed`.
- `SttService` from [src/main/stt/index.ts](src/main/stt/index.ts): `activeEngineType`/`activeModelId` become `Ref`s; `loadModelForTranscription`/`transcribe`/`unloadAll` as Effects; engine adapters ([smart-whisper-engine.ts](src/main/stt/smart-whisper-engine.ts), parakeet, sherpa) wrapped behind the existing `SttEngine` interface ([engine.ts](src/main/stt/engine.ts)) but invoked via `Effect.tryPromise`.
- `ModelsService` from [src/main/models/manager.ts](src/main/models/manager.ts): downloads/register/delete/setActive as Effects; `downloadFile` streaming via `Effect.async`/`Stream` with progress callbacks preserved.
- `DownloadQueueService` from [src/main/models/download-queue.ts](src/main/models/download-queue.ts): replace the manual `MAX_CONCURRENT=3` + `pending[]` + `activeCount` with an Effect `Semaphore` (or `Queue` + fibers); jobs map stays in a `Ref`; broadcasts via `HudService`/`BrowserWindow`.
- `HotkeyService` from [src/main/hotkey/manager.ts](src/main/hotkey/manager.ts): `isRecording`/`hotkeyHeld`/timers become `Ref`s + `Fiber`/`Effect.sleep` for `MAX_RECORDING_MS`; uiohook/globalShortcut listeners stay imperative but dispatch into the runtime; depends on `DictationStateService`, `InjectionService`, `HudService`, `PipelineService`.
- `PipelineService` from [src/main/pipeline.ts](src/main/pipeline.ts): `processTranscription` as an `Effect` pipeline composing Stt -> dictionary -> sanitize -> Ai -> snippets -> injection -> history; pure text helpers in [src/main/text/*](src/main/text/dictionary.ts) stay pure (just imported).
- `AppLayer`: merge all service layers in `src/main/layers.ts`.

## Phase 3 - Boundary wiring

- Rewrite [src/main/ipc.ts](src/main/ipc.ts): each `ipcMain.handle` calls `runtime.runPromise(effect)`; `handleProcessRecording` becomes an Effect using `markDictationProcessing`/`processTranscription` with `Effect.ensuring` for the `finally` cleanup (idle + reset hotkey).
- Rewrite [src/main/index.ts](src/main/index.ts) `setupApp`: build the runtime in `app.whenReady`, run init effects (register IPC, create HUD, tray, hotkey init, ensure idle); dispose the runtime in `before-quit` alongside `stopHotkeyManager`.

## Phase 4 - Validation & docs

- `npm run typecheck` (with Effect Language Service active) until clean; `npm run build` (electron-vite) to confirm the bundle.
- Agent files: create `CLAUDE.md` with the Effect Best Practices block between `<!-- effect-solutions:start -->`/`<!-- effect-solutions:end -->`, and symlink `AGENTS.md` -> `CLAUDE.md` (neither exists today).
- Final summary: package manager, steps done/skipped, files created/modified, errors hit + resolutions.

## Risks / decisions to confirm at execution time

- Effect "v4": `effect@latest` resolves to `3.21.4`; v4 is `4.0.0-beta.90` on the `beta` tag. We install `effect@beta` to align with the v4 source reference. Patterns are nearly identical to 3.x.
- Electron native deps (`uiohook-napi`, `smart-whisper`, `parakeet-coreml`) keep their imperative event/callback edges; only the surrounding logic and state move into Effect.
- No runtime behavior changes intended; IPC channels and settings shape stay identical so the renderer is unaffected.
