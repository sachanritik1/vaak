import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

vi.mock('*.css', () => ({}))

// Default noop stubs for window.vaak. Each test can override specific methods
// via `vi.mocked(window.vaak.method).mockReturnValue(...)` or assign new fns.
const buildVaak = () => ({
  getSettings: vi.fn().mockResolvedValue(undefined),
  setSettings: vi.fn().mockResolvedValue(undefined),
  getPermissions: vi.fn().mockResolvedValue({
    microphone: true,
    accessibility: true,
    inputMonitoring: true,
    automation: true
  }),
  requestMicrophone: vi.fn().mockResolvedValue(true),
  openAccessibility: vi.fn().mockResolvedValue(undefined),
  openInputMonitoring: vi.fn().mockResolvedValue(undefined),
  getModelCatalog: vi.fn().mockResolvedValue([]),
  getInstalledModels: vi.fn().mockResolvedValue([]),
  downloadModel: vi.fn().mockResolvedValue({ accepted: true, modelId: 'x' }),
  downloadCustomModel: vi.fn().mockResolvedValue({ accepted: true, modelId: 'x' }),
  getDownloads: vi.fn().mockResolvedValue([]),
  deleteModel: vi.fn().mockResolvedValue(undefined),
  setActiveModel: vi.fn().mockResolvedValue(undefined),
  testInjection: vi.fn().mockResolvedValue(true),
  aiCleanup: vi.fn().mockResolvedValue(''),
  clearHistory: vi.fn().mockResolvedValue(undefined),
  processRecording: vi.fn().mockResolvedValue({ ok: true }),
  onHudState: vi.fn(() => () => {}),
  onDownloadProgress: vi.fn(() => () => {}),
  onDownloadsUpdated: vi.fn(() => () => {}),
  onDictationState: vi.fn(() => () => {})
})

if (typeof window !== 'undefined' && !('vaak' in window)) {
  Object.defineProperty(window, 'vaak', {
    configurable: true,
    writable: true,
    value: buildVaak()
  })
} else if (typeof window !== 'undefined') {
  // Reset all mocks before each test
  beforeEach(() => {
    const vaak = (window as any).vaak
    for (const key of Object.keys(vaak)) {
      if (typeof vaak[key] === 'function' && '_isMockFunction' in vaak[key]) {
        vaak[key].mockReset()
        vaak[key].mockResolvedValue(undefined)
      }
    }
  })
}
