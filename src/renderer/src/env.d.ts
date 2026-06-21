/// <reference types="vite/client" />

import type { VaakApi } from '../../preload/index'

declare global {
  interface Window {
    vaak: VaakApi
  }
}

export {}
