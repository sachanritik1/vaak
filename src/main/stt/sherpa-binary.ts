import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { isEngineLogLine } from '../text/sanitize'
import { readSherpaManifest } from './sherpa-manifest'
import type { SherpaManifest } from '../../shared/types'

const execFileAsync = promisify(execFile)

const SHERPA_VERSION = 'v1.13.3'

function binDir(): string {
  const dir = join(app.getPath('userData'), 'bin')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function releaseAsset(): string {
  if (process.platform !== 'darwin') {
    throw new Error('Sherpa-ONNX models require macOS.')
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `sherpa-onnx-${SHERPA_VERSION}-osx-${arch}-static-no-tts.tar.bz2`
}

function releaseUrl(): string {
  return `https://github.com/k2-fsa/sherpa-onnx/releases/download/${SHERPA_VERSION}/${releaseAsset()}`
}

function findFileRecursive(dir: string, filename: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, filename)
      if (found) return found
    } else if (entry.name === filename) {
      return full
    }
  }
  return null
}

async function extractSherpaOffline(tarPath: string, destPath: string): Promise<void> {
  const extractDir = mkdtempSync(join(tmpdir(), 'sherpa-extract-'))
  try {
    await execFileAsync('tar', ['-xjf', tarPath, '-C', extractDir])
    const cli = findFileRecursive(extractDir, 'sherpa-onnx-offline')
    if (!cli) throw new Error('sherpa-onnx-offline not found in downloaded archive')
    copyFileSync(cli, destPath)
    chmodSync(destPath, 0o755)
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

export async function ensureSherpaOffline(): Promise<string> {
  const cliPath = join(binDir(), 'sherpa-onnx-offline')
  if (existsSync(cliPath)) return cliPath

  const tmpTar = join(tmpdir(), `sherpa-${randomUUID()}.tar.bz2`)
  const response = await fetch(releaseUrl())
  if (!response.ok) {
    throw new Error(`Failed to download sherpa-onnx: ${response.status}`)
  }

  writeFileSync(tmpTar, Buffer.from(await response.arrayBuffer()))
  try {
    await extractSherpaOffline(tmpTar, cliPath)
    try {
      await execFileAsync('xattr', ['-dr', 'com.apple.quarantine', cliPath])
    } catch {
      // optional
    }
  } finally {
    rmSync(tmpTar, { force: true })
  }

  return cliPath
}

function buildSherpaArgs(modelDir: string, manifest: SherpaManifest): string[] {
  const args = ['--num-threads=2', `--model-type=${manifest.modelType}`, `--tokens=${join(modelDir, manifest.tokens)}`]

  if (manifest.kind === 'moonshine') {
    if (manifest.preprocessor) {
      args.push(`--moonshine-preprocessor=${join(modelDir, manifest.preprocessor)}`)
    }
    if (manifest.encoder) {
      args.push(`--moonshine-encoder=${join(modelDir, manifest.encoder)}`)
    }
    if (manifest.uncachedDecoder) {
      args.push(`--moonshine-uncached-decoder=${join(modelDir, manifest.uncachedDecoder)}`)
    }
    if (manifest.cachedDecoder) {
      args.push(`--moonshine-cached-decoder=${join(modelDir, manifest.cachedDecoder)}`)
    }
  } else if (manifest.kind === 'sense-voice') {
    if (!manifest.model) throw new Error('SenseVoice model file missing from manifest.')
    args.push(`--sense-voice-model=${join(modelDir, manifest.model)}`)
    args.push(`--sense-voice-language=${manifest.senseVoiceLanguage ?? 'auto'}`)
    args.push(`--sense-voice-use-itn=${manifest.senseVoiceItn ? 'true' : 'false'}`)
  } else if (manifest.kind === 'nemo-ctc') {
    if (!manifest.model) throw new Error('NeMo model file missing from manifest.')
    args.push(`--nemo-ctc-model=${join(modelDir, manifest.model)}`)
  }

  return args
}

function parseSherpaOutput(stdout: string): string {
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (!lines[i].startsWith('{')) continue
    try {
      const parsed = JSON.parse(lines[i]) as { text?: string }
      if (typeof parsed.text === 'string') return parsed.text.trim()
    } catch {
      // try next
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (lines[i].startsWith('{') || lines[i].endsWith('.wav')) continue
    if (lines[i] === '----') continue
    return lines[i]
  }

  return ''
}

export async function transcribeWithSherpa(modelDir: string, wavPath: string): Promise<string> {
  await ensureSherpaOffline()
  const cliPath = join(binDir(), 'sherpa-onnx-offline')
  const manifest = readSherpaManifest(modelDir)
  const args = [...buildSherpaArgs(modelDir, manifest), wavPath]

  const { stdout, stderr } = await execFileAsync(cliPath, args, {
    maxBuffer: 10 * 1024 * 1024
  })

  if (stderr?.trim()) {
    console.debug('[sherpa-onnx stderr]', stderr.trim())
  }

  return parseSherpaOutput(stdout.trim())
}
