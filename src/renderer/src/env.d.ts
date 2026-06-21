/// <reference types="vite/client" />

import type { OpenWhisperApi } from '../../preload/index'

declare global {
  interface Window {
    openwhisper: OpenWhisperApi
  }
}

export {}
