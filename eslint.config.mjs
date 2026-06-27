// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

/** Common ignores for generated artifacts, dependencies, and config files. */
const ignore = {
  ignores: [
    'node_modules/**',
    'out/**',
    'release/**',
    'dist/**',
    'build/**',
    'resources/**',
    '.venv-native/**',
    'scripts/**',
    '*.config.js',
    '*.config.cjs',
    '*.config.mjs',
    '*.config.ts',
    'postcss.config.js',
    'tailwind.config.js',
    'electron.vite.config.ts',
    'vitest.config.ts',
    'vitest.setup.main.ts'
  ]
}

/**
 * Base config: recommended JS + TypeScript rules, applied to all TS/TSX files.
 * `__dirname` / `process` / `console` are Node globals available throughout this
 * project (Electron main, preload, and node-environment tests) — they don't need
 * to be redefined in the shared/typescript config.
 */
const base = [
  ignore,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Match the project style: 2-space indent, single quotes, no semicolons
      // (already enforced by Prettier, but ESLint flags the common offenders).
      semi: ['error', 'never'],
      quotes: ['error', 'single', { avoidEscape: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ]
    }
  }
]

/** Renderer-only overrides: React, hooks, and Vite refresh rules. */
const renderer = {
  files: ['src/renderer/**/*.{ts,tsx}'],
  plugins: {
    react: reactPlugin,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh
  },
  languageOptions: {
    globals: {
      ...globals.browser
    },
    parserOptions: {
      ecmaFeatures: { jsx: true }
    }
  },
  settings: {
    react: { version: 'detect' }
  },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactPlugin.configs['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    'react/prop-types': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true }
    ]
  }
}

export default [
  ...base,
  {
    ignores: ['**/*.test.ts', '**/*.test.tsx']
  },
  renderer
]
