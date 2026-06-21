# Vaak

Open-source, macOS-first voice dictation app — a local alternative to [Wispr Flow](https://wisprflow.ai/). Hold a hotkey, speak, and get polished text pasted into any app using open-weight Whisper models running entirely on your machine.

**Vaak** (वाक्) means *speech* or *voice* in Sanskrit.

## Features

- **System-wide dictation** — Hold-to-talk hotkey works in every app
- **Local STT** — whisper.cpp via [smart-whisper](https://www.npmjs.com/package/smart-whisper), with Metal GPU acceleration on Apple Silicon
- **Model manager** — Download curated Whisper models from HuggingFace or add custom URLs
- **Optional AI cleanup** — Pluggable providers: Ollama (local), OpenAI, or Anthropic (off by default)
- **Personal dictionary** — Whisper prompt biasing + post-transcription replacements
- **Snippet library** — Voice triggers that expand to full text
- **Transcription history** — Stored locally, never sent to the cloud (unless AI cleanup is enabled)

## Download

Pre-built macOS installers are on the [Releases](../../releases/latest) page.

| Platform | File |
|----------|------|
| Apple Silicon (M1/M2/M3/M4) | `Vaak-x.x.x-arm64.dmg` |
| Intel Mac | `Vaak-x.x.x-x64.dmg` |

Open the DMG, drag Vaak to Applications, then grant permissions on first launch (see below). Unsigned builds may require **Right-click → Open** the first time.

## Requirements

- macOS 12+ (Apple Silicon or Intel)
- Node.js 20+
- Microphone, Accessibility, and Input Monitoring permissions

## Quick Start

```bash
# Install dependencies (rebuilds native modules for Electron)
npm install

# Development
npm run dev

# Build for production
npm run build
npm run dist
```

On first launch:
1. Grant **Microphone**, **Accessibility**, and **Input Monitoring** permissions in the Setup tab
2. Download a Whisper model in the **Models** tab (start with `Whisper Base` or `Large v3 Turbo Q5`)
3. Hold **Right Option (⌥)** anywhere to dictate

## Architecture

```
Hotkey (uiohook) → Audio capture (16kHz PCM) → whisper.cpp → [optional AI cleanup] → clipboard paste
```

- **Main process**: STT engine, model downloads, hotkey listener, text injection
- **HUD window**: Frameless overlay showing recording state (non-focusable, won't steal paste target)
- **Settings window**: Models, permissions, hotkey, AI, dictionary, snippets, history

## Model Sources

### Whisper
Curated models from [ggerganov/whisper.cpp on HuggingFace](https://huggingface.co/ggerganov/whisper.cpp). Stored in `~/Library/Application Support/Vaak/models/`.

### NVIDIA Parakeet
- **Parakeet TDT v3 (CoreML)** — runs on Apple Neural Engine via [parakeet-coreml](https://www.npmjs.com/package/parakeet-coreml). Best choice on Apple Silicon. Auto-downloads ~1.5 GB to `~/.cache/parakeet-coreml/`.
- **Parakeet GGUF** — runs via [parakeet.cpp](https://github.com/mudler/parakeet.cpp) (binary auto-downloads on first use). Models from [mudler/parakeet-cpp-gguf](https://huggingface.co/mudler/parakeet-cpp-gguf).

## Hotkey

Default: **Hold Right Option (⌥)** to record, release to transcribe and paste.

Configure in Settings → Hotkey. Toggle mode uses `Alt+Space` as a global shortcut fallback.

## AI Cleanup (Optional)

When enabled, dictated text is sent to your chosen provider for grammar/filler cleanup before pasting. Providers:

| Provider | Config |
|----------|--------|
| Ollama | `http://localhost:11434` + model name |
| OpenAI | API key + model (e.g. `gpt-4o-mini`) |
| Anthropic | API key + model (e.g. `claude-3-5-haiku-20241022`) |

Raw transcription is always used when AI cleanup is disabled.

## Permissions

| Permission | Why |
|------------|-----|
| Microphone | Capture voice |
| Accessibility | Paste into focused app |
| Input Monitoring | Global hold-to-talk hotkey |
| Automation (Apple Events) | Simulate Cmd+V paste |

## Building a Release

### Local build

```bash
npm run dist
```

Output: `release/Vaak-x.x.x-arm64.dmg` (and `-x64.dmg` when both arches are built).

Native modules (`smart-whisper`, `uiohook-napi`) are unpacked from ASAR and rebuilt for Electron's ABI via `electron-builder install-app-deps` during `postinstall`.

### GitHub Releases (CI)

Pushing a version tag triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds Apple Silicon and Intel DMGs and uploads them to GitHub Releases.

```bash
# Bump version in package.json, commit, then tag
npm version patch   # or minor / major
git push origin main --follow-tags
```

The tag must match `package.json` version (e.g. tag `v0.1.0` for version `0.1.0`).

### Code signing (optional)

By default, CI produces **unsigned** DMGs (Gatekeeper will warn on first open). To sign and notarize in CI, add these repository secrets:

| Secret | Purpose |
|--------|---------|
| `CSC_LINK` | Base64-encoded `.p12` Developer ID certificate |
| `CSC_KEY_PASSWORD` | Password for the `.p12` |
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID |

For local signed builds:

```bash
export CSC_LINK=...
export CSC_KEY_PASSWORD=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=...
npm run dist
```

## Project Structure

```
src/
  main/           # Electron main process
    stt/          # whisper.cpp engine
    models/       # HuggingFace catalog + downloader
    hotkey/       # uiohook hold-to-talk
    injection/    # macOS clipboard paste
    ai/           # Optional cleanup providers
  preload/        # contextBridge IPC API
  renderer/       # React UI (HUD + Settings)
  shared/         # Shared TypeScript types
```

## License

MIT — see [LICENSE](LICENSE).

## Roadmap

- [ ] Windows / Linux support
- [ ] Voice Activity Detection (auto-stop)
- [ ] `@kutalia/whisper-node-addon` as alternative STT engine
- [ ] iCloud sync for dictionary/snippets
