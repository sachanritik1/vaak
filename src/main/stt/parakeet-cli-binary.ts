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

const execFileAsync = promisify(execFile)

const PARAKEET_VERSION = 'v0.3.2'

function binDir(): string {
  const dir = join(app.getPath('userData'), 'bin')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function releaseAsset(): string {
  if (process.platform !== 'darwin') {
    throw new Error('Parakeet GGUF requires macOS (parakeet.cpp binary).')
  }
  return process.arch === 'arm64'
    ? 'parakeet-v0.3.2-bin-macos-metal-arm64.tar.gz'
    : 'parakeet-v0.3.2-bin-macos-cpu-x64.tar.gz'
}

function releaseUrl(): string {
  return `https://github.com/mudler/parakeet.cpp/releases/download/${PARAKEET_VERSION}/${releaseAsset()}`
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

async function extractParakeetCli(tarGzPath: string, destPath: string): Promise<void> {
  const extractDir = mkdtempSync(join(tmpdir(), 'parakeet-extract-'))
  try {
    await execFileAsync('tar', ['-xzf', tarGzPath, '-C', extractDir])
    const cli = findFileRecursive(extractDir, 'parakeet-cli')
    if (!cli) throw new Error('parakeet-cli not found in downloaded archive')
    copyFileSync(cli, destPath)
    chmodSync(destPath, 0o755)
  } finally {
    rmSync(extractDir, { recursive: true, force: true })
  }
}

export async function ensureParakeetCli(): Promise<string> {
  const cliPath = join(binDir(), 'parakeet-cli')
  if (existsSync(cliPath)) return cliPath

  const tmpTar = join(tmpdir(), `parakeet-${randomUUID()}.tar.gz`)
  const response = await fetch(releaseUrl())
  if (!response.ok) {
    throw new Error(`Failed to download parakeet.cpp: ${response.status}`)
  }

  writeFileSync(tmpTar, Buffer.from(await response.arrayBuffer()))
  try {
    await extractParakeetCli(tmpTar, cliPath)
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

export async function transcribeWithParakeetCli(
  modelPath: string,
  wavPath: string
): Promise<string> {
  await ensureParakeetCli()
  const cliPath = join(binDir(), 'parakeet-cli')
  const { stdout, stderr } = await execFileAsync(
    cliPath,
    ['transcribe', '--model', modelPath, '--input', wavPath, '--json'],
    { maxBuffer: 10 * 1024 * 1024 }
  )

  if (stderr?.trim()) {
    console.debug('[parakeet-cli stderr]', stderr.trim())
  }

  const combined = stdout.trim()
  if (!combined) return ''

  // parakeet-cli may log to stdout before the JSON line — never use stderr for text
  const lines = combined.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (!lines[i].startsWith('{')) continue
    try {
      const parsed = JSON.parse(lines[i]) as { text?: string }
      if (parsed.text?.trim()) return parsed.text.trim()
    } catch {
      // try next line
    }
  }

  // Plain-text fallback (no JSON line found)
  const lastLine =
    [...lines].reverse().find((l) => !isEngineLogLine(l) && !l.startsWith('{')) ?? ''
  if (lastLine.startsWith('{')) return ''
  return lastLine
}
