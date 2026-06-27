# Vaak — OpenWhisper

Open-source Wispr Flow alternative with local voice dictation (Electron + Effect v4).

## Architecture

- **Main process** (`src/main/**`) is built on [Effect v4](https://effect.website). A single
  `ManagedRuntime` is constructed once in `app.whenReady` from the composed `AppLayer`
  (`src/main/layers.ts`). IPC handlers (`src/main/ipc.ts`) and uiohook/globalShortcut
  callbacks (`src/main/hotkey/manager.ts`) are the imperative boundary: they build Effects
  against service tags and run them via `runMain` / `Effect.runSync` from `src/main/runtime.ts`.
- **Renderer** (`src/renderer/**`, React + Vite) and the **preload bridge**
  (`src/preload/index.ts`) are plain TS; the IPC contract lives in `src/shared/types.ts`.
- Each main subsystem is an `Effect.Service` + `Layer` with `Ref`-based state and tagged
  `Schema.TaggedErrorClass` errors (`src/main/errors.ts`). Pure helpers
  (`src/main/text/*`, `src/main/models/catalog.ts`) and native engine adapters
  (`src/main/stt/*-engine.ts`) stay imperative and are wrapped with `Effect.tryPromise`.

## Services

- Defined as `const Foo = Context.Service<Foo>('@vaak/Foo')` (functional form), built with
  `Layer.effect(Foo, Effect.gen(...))` or `Layer.succeed(Foo)(impl)`. Access via `yield* Foo`.
- Nullary methods are plain `Effect` values (`readonly x: Effect<A>`); parameterized methods
  are `Effect.fn('name')((args) => ...)` thunks. Call sites match: `yield* svc.x` (nullary)
  vs `yield* svc.x(args)`.
- Composed once into `AppLayer`; avoid scattering `Effect.provide` calls.

## Errors & Schema

- `Schema.TaggedErrorClass` with `_tag`. `cause` is a reserved key (maps to `Error.cause`),
  so wrapped underlying errors use an optional `error: Schema.optional(Schema.Defect())`
  field. Tagged errors are yieldable: `return yield* new MyError({...})` instead of `Effect.fail`.
- Validate external data (HTTP, persisted settings) with `effect/Schema`
  (`Schema.decodeUnknownEffect`) so errors are typed; wrap Promise-based APIs with
  `Effect.tryPromise({ try, catch })`. Schema mirrors of shared types live in
  `src/shared/schema.ts`; `src/shared/types.ts` remains the renderer/preload contract.

## v4 API notes

- No `Effect.catchAll`/`Effect.async`/`Effect.fork` — use `Effect.catch`, `Effect.tryPromise`,
  and `Effect.forkDetach`. Multiple literals use `Schema.Literals([...])`.
- Bridge imperative callbacks (uiohook, download streams) into the runtime with
  `Effect.runSync` / `Effect.runFork` at module scope, not lexically inside an `Effect.gen`
  (the Effect Language Service flags that — see `registerUiohookListeners` and
  `emitProgress` for the pattern).

<!-- effect-solutions:start -->
## Effect Best Practices

- Use `Effect.gen` (`yield*`) for sequential effects; name traced effectful functions with `Effect.fn("name")`.
- Define services with `Context.Service<Interface>("@app/Name")` and `Layer.effect` / `Layer.succeed`;
  compose once into a single app `Layer` and provide it at the entry point with `Effect.provide`
  (or build a `ManagedRuntime`). Avoid scattering `provide` calls.
- Model failures as `Schema.TaggedErrorClass` so callers recover with `Effect.catchTag` /
  `Effect.catchTags` / `Effect.catch`; reserve defects (`Effect.die`) for unrecoverable bugs.
- Validate external data (HTTP, persisted settings) with `effect/Schema` (`Schema.decodeUnknownEffect`)
  so errors are typed; wrap Promise-based APIs with `Effect.tryPromise({ try, catch })`.
- Add cross-cutting concerns with `.pipe(Effect.timeout, Effect.retry, Effect.tap, ...)`.
- Sketch leaf service contracts first, then implement; the type-checker guides the wiring.
<!-- effect-solutions:end -->

## Tooling

- Package manager: **npm**. Effect is installed from the `beta` tag (`effect@beta` → v4).
- `npm run typecheck` — `tsc --noEmit` with the Effect Language Service patch active.
- `npm run build` — `electron-vite build` (main + preload + renderer).
- `npm run prepare` — re-applies the Effect Language Service patch after install.
- Editor: `.vscode/settings.json` pins the workspace TypeScript so the Effect plugin loads.
- The Effect v4 source is cloned to `~/.local/share/effect-solutions/effect` for API
  reference; refresh with `git -C ~/.local/share/effect-solutions/effect pull --depth 1`.
