#!/usr/bin/env node
/**
 * Local fallback when electron-builder install-app-deps fails (e.g. Python 3.12+ without distutils).
 * CI uses actions/setup-python@v6 with Python 3.11 — this script is not run in CI postinstall.
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
  const result = spawnSync('npx', ['electron-builder', 'install-app-deps'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, npm_config_python: python, PYTHON: python }
  })
  if (result.status !== 0) {
    console.error('[rebuild] Native rebuild failed')
    process.exit(1)
  }
}

rebuild()
