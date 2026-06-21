#!/usr/bin/env node
/**
 * Rebuild native Electron addons (smart-whisper, uiohook-napi).
 * Uses a Python venv with setuptools when system Python lacks distutils.
 */
const { execSync, spawnSync } = require('node:child_process')
const { existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const venvDir = join(root, '.venv-native')

function ensureVenvPython() {
  const py = join(venvDir, 'bin', 'python')
  if (!existsSync(py)) {
    console.log('[rebuild] Creating Python venv for node-gyp…')
    mkdirSync(venvDir, { recursive: true })
    execSync(`python3 -m venv "${venvDir}"`, { stdio: 'inherit' })
    execSync(`"${py}" -m pip install setuptools`, { stdio: 'inherit' })
  }
  return py
}

function rebuild() {
  const python = ensureVenvPython()
  console.log('[rebuild] Rebuilding native modules for Electron…')
  const result = spawnSync(
    'npx',
    ['electron-rebuild', '-f', '-w', 'smart-whisper,uiohook-napi'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, npm_config_python: python, PYTHON: python }
    }
  )
  if (result.status !== 0) {
    console.warn('[rebuild] Native rebuild failed — run manually after fixing node-gyp deps')
    process.exit(0)
  }
}

rebuild()
