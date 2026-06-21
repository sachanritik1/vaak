#!/usr/bin/env node
/** Install parakeet-coreml using prebuilt binary (skip broken install script). */
const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const addon = join(root, 'node_modules/parakeet-coreml/build/Release/coreml_asr.node')

if (process.platform !== 'darwin') {
  console.log('[parakeet] Skipping parakeet-coreml (macOS Apple Silicon only)')
  process.exit(0)
}

if (existsSync(addon)) {
  console.log('[parakeet] parakeet-coreml already installed')
  process.exit(0)
}

console.log('[parakeet] Installing parakeet-coreml (prebuilt CoreML addon)…')
const result = spawnSync(
  'npm',
  ['install', 'parakeet-coreml@2.2.0', '--ignore-scripts', '--no-save'],
  { cwd: root, stdio: 'inherit' }
)

if (result.status !== 0 || !existsSync(addon)) {
  console.warn('[parakeet] parakeet-coreml install failed — Parakeet CoreML models will be unavailable')
}
