import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
          setupFiles: ['./vitest.setup.main.ts'],
          server: { deps: { inline: [/effect/, /@effect/] } }
        }
      },
      {
        resolve: {
          alias: {
            '@renderer': resolve(__dirname, 'src/renderer/src'),
            '@shared': resolve(__dirname, 'src/shared')
          }
        },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/renderer/src/test/setup.ts'],
          globals: true,
          css: false
        }
      }
    ]
  }
})
