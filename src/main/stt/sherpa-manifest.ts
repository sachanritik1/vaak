import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SherpaCatalogConfig, SherpaManifest } from '../../shared/types'

export const SHERPA_MANIFEST = 'sherpa.json'

export function writeSherpaManifest(modelDir: string, config: SherpaCatalogConfig): void {
  const manifest: SherpaManifest = { ...config }
  writeFileSync(join(modelDir, SHERPA_MANIFEST), JSON.stringify(manifest, null, 2))
}

export function readSherpaManifest(modelDir: string): SherpaManifest {
  const path = join(modelDir, SHERPA_MANIFEST)
  if (!existsSync(path)) {
    throw new Error(`Missing ${SHERPA_MANIFEST} in sherpa model directory.`)
  }
  return JSON.parse(readFileSync(path, 'utf8')) as SherpaManifest
}
