import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('*.css', () => ({}))

const noop = () => {}
const unsubscribe = () => unsubscribe

if (typeof window !== 'undefined' && !('vaak' in window)) {
  Object.defineProperty(window, 'vaak', {
    configurable: true,
    writable: true,
    value: {
      getSettings: noop,
      setSettings: noop,
      getPermissions: noop,
      requestMicrophone: noop,
      openAccessibility: noop,
      openInputMonitoring: noop,
      getModelCatalog: noop,
      getInstalledModels: noop,
      downloadModel: noop,
      downloadCustomModel: noop,
      getDownloads: noop,
      deleteModel: noop,
      setActiveModel: noop,
      testInjection: noop,
      aiCleanup: noop,
      clearHistory: noop,
      processRecording: noop,
      onHudState: noop,
      onDownloadProgress: noop,
      onDownloadsUpdated: noop,
      onDictationState: noop
    }
  })
}
