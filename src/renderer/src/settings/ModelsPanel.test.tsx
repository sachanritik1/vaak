import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModelsPanel } from './ModelsPanel'
import { makeSettings, makeInstalledModel } from '../test/fixtures'
import { WHISPER_CATALOG, PARAKEET_CATALOG, MOONSHINE_CATALOG } from '../../../main/models/catalog'
import type { AppSettings, ModelDownloadJob } from '@shared/types'

const renderPanel = (
  settings: AppSettings = makeSettings(),
  downloads: ModelDownloadJob[] = [],
  onUpdate: (partial: Partial<AppSettings>) => Promise<void> = vi.fn().mockResolvedValue(undefined),
  onRefresh: () => Promise<void> = vi.fn().mockResolvedValue(undefined)
) => {
  vi.mocked(window.vaak.getModelCatalog).mockResolvedValue([
    ...WHISPER_CATALOG,
    ...PARAKEET_CATALOG,
    ...MOONSHINE_CATALOG
  ])
  // The component uses settings.installedModels via props to render the
  // "Installed Models" section, but it ALSO fetches its own via
  // getInstalledModels in a useEffect. The local state wins after mount,
  // so we seed the local state to match the prop.
  vi.mocked(window.vaak.getInstalledModels).mockResolvedValue(settings.installedModels)
  const utils = render(
    <ModelsPanel
      settings={settings}
      onUpdate={onUpdate}
      downloads={downloads}
      onRefresh={onRefresh}
    />
  )
  return { ...utils, settings, onUpdate, onRefresh }
}

beforeEach(() => {
  const getModelCatalog = window.vaak.getModelCatalog as ReturnType<typeof vi.fn>
  const getInstalledModels = window.vaak.getInstalledModels as ReturnType<typeof vi.fn>
  const downloadModel = window.vaak.downloadModel as ReturnType<typeof vi.fn>
  const downloadCustomModel = window.vaak.downloadCustomModel as ReturnType<typeof vi.fn>
  const deleteModel = window.vaak.deleteModel as ReturnType<typeof vi.fn>
  const setActiveModel = window.vaak.setActiveModel as ReturnType<typeof vi.fn>
  const getSettings = window.vaak.getSettings as ReturnType<typeof vi.fn>
  getModelCatalog.mockReset().mockResolvedValue([])
  getInstalledModels.mockReset().mockResolvedValue([])
  downloadModel.mockReset().mockResolvedValue({ accepted: true, modelId: 'x' })
  downloadCustomModel.mockReset().mockResolvedValue({ accepted: true, modelId: 'custom' })
  deleteModel.mockReset().mockResolvedValue(undefined)
  setActiveModel.mockReset().mockResolvedValue(undefined)
  getSettings.mockReset()
})

describe('ModelsPanel', () => {
  it('renders the title and a description', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Models', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(/Download open-weight speech models/)).toBeInTheDocument()
  })

  it('renders the custom model URL form', () => {
    renderPanel()
    expect(screen.getByPlaceholderText(/huggingface.co/)).toBeInTheDocument()
  })

  it('disables the custom download button when URL is empty', () => {
    renderPanel()
    const btn = screen.getByRole('button', { name: /Download Custom Model/ })
    expect(btn).toBeDisabled()
  })

  it('enables the custom download button when URL is non-empty', async () => {
    renderPanel()
    await userEvent.setup().type(screen.getByPlaceholderText(/huggingface.co/), 'https://example.com/x.bin')
    expect(screen.getByRole('button', { name: /Download Custom Model/ })).toBeEnabled()
  })

  it('renders Installed Models section when settings has installed models', async () => {
    const installed = [makeInstalledModel({ id: 'whisper-tiny' })]
    renderPanel(makeSettings({ installedModels: installed }))
    expect(await screen.findByText('Installed Models')).toBeInTheDocument()
    // The Installed section lists Whisper Tiny AND the catalog also lists it
    expect(screen.getAllByText('Whisper Tiny').length).toBeGreaterThanOrEqual(2)
  })

  it('does NOT render Installed Models when empty', () => {
    renderPanel(makeSettings({ installedModels: [] }))
    expect(screen.queryByText('Installed Models')).not.toBeInTheDocument()
  })

  it('Set Active button calls setActiveModel and onUpdate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const installed = [
      makeInstalledModel({ id: 'whisper-tiny' }),
      makeInstalledModel({ id: 'whisper-base' })
    ]
    const setActiveModel = window.vaak.setActiveModel as ReturnType<typeof vi.fn>
    const getSettings = window.vaak.getSettings as ReturnType<typeof vi.fn>
    setActiveModel.mockResolvedValue(undefined)
    getSettings.mockResolvedValue(
      makeSettings({ installedModels: installed, activeModelId: 'whisper-tiny' })
    )
    renderPanel(makeSettings({ installedModels: installed }), [], onUpdate)
    await screen.findByText('Installed Models')
    // Click Set Active on the second one (base)
    const setActiveBtns = screen.getAllByRole('button', { name: 'Set Active' })
    await userEvent.setup().click(setActiveBtns[1])
    expect(setActiveModel).toHaveBeenCalledWith('whisper-base')
    expect(onUpdate).toHaveBeenCalledWith({ activeModelId: 'whisper-base' })
  })

  it('Delete button calls deleteModel + refresh + getSettings + onUpdate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const installed = [makeInstalledModel({ id: 'whisper-tiny' })]
    const deleteModel = window.vaak.deleteModel as ReturnType<typeof vi.fn>
    const getSettings = window.vaak.getSettings as ReturnType<typeof vi.fn>
    deleteModel.mockResolvedValue(undefined)
    getSettings.mockResolvedValue(
      makeSettings({ installedModels: [], activeModelId: null })
    )
    renderPanel(makeSettings({ installedModels: installed }), [], onUpdate, onRefresh)
    await screen.findByText('Installed Models')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteModel).toHaveBeenCalledWith('whisper-tiny')
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows the in-progress banner when there are active downloads', () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'a', status: 'downloading', downloaded: 50, total: 100, percent: 50 }
    ]
    renderPanel(makeSettings(), downloads)
    expect(screen.getByText(/1 download in progress/)).toBeInTheDocument()
  })

  it('shows the plural form for multiple downloads', () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'a', status: 'downloading', downloaded: 50, total: 100, percent: 50 },
      { modelId: 'b', status: 'queued', downloaded: 0, total: 0, percent: 0 }
    ]
    renderPanel(makeSettings(), downloads)
    expect(screen.getByText(/2 downloads in progress/)).toBeInTheDocument()
  })

  it('hides the in-progress banner when no active downloads', () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'a', status: 'completed', downloaded: 100, total: 100, percent: 100 }
    ]
    renderPanel(makeSettings(), downloads)
    expect(screen.queryByText(/downloads? in progress/)).not.toBeInTheDocument()
  })

  it('renders the GPU toggle only when active model is whisper', () => {
    renderPanel(makeSettings({ activeModelId: 'whisper-tiny' }))
    expect(screen.getByText(/Use GPU acceleration/)).toBeInTheDocument()
  })

  it('hides the GPU toggle when active model is non-whisper', async () => {
    const installed = [makeInstalledModel({ id: 'moonshine', engine: 'sherpa-onnx' })]
    renderPanel(makeSettings({ activeModelId: 'moonshine', installedModels: installed }))
    await screen.findByText('Installed Models')
    expect(screen.queryByText(/Use GPU acceleration/)).not.toBeInTheDocument()
  })

  it('shows the GPU toggle when no model is active (defaults to enabling Whisper)', () => {
    renderPanel(makeSettings({ activeModelId: null }))
    // The toggle is shown by default (showGpuToggle = !activeModel || engine === 'whisper')
    // so the user can set their preference before downloading a model
    expect(screen.getByText(/Use GPU acceleration/)).toBeInTheDocument()
  })

  it('Download button on a catalog model calls window.vaak.downloadModel', async () => {
    const downloadModel = window.vaak.downloadModel as ReturnType<typeof vi.fn>
    downloadModel.mockResolvedValue({ accepted: true, modelId: 'tiny' })
    renderPanel()
    await waitFor(() => screen.getByText('Whisper Tiny'))
    const downloadBtns = screen.getAllByRole('button', { name: 'Download' })
    await userEvent.setup().click(downloadBtns[0])
    expect(downloadModel).toHaveBeenCalled()
  })

  it('shows "Installed" badge on a catalog model that is already installed', async () => {
    const installed = [makeInstalledModel({ id: 'tiny' })]
    vi.mocked(window.vaak.getInstalledModels).mockResolvedValue(installed)
    renderPanel(makeSettings({ installedModels: installed }))
    await screen.findByText('Installed Models')
    // The catalog shows both Whisper Tiny (installed) and others
    expect(screen.getAllByText('Installed').length).toBeGreaterThan(0)
  })

  it('shows "Queued…" for a queued download', async () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'tiny', status: 'queued', downloaded: 0, total: 0, percent: 0 }
    ]
    renderPanel(makeSettings(), downloads)
    await screen.findByText('Queued…')
  })

  it('shows "Downloading…" for an active download', async () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'tiny', status: 'downloading', downloaded: 50, total: 100, percent: 50 }
    ]
    renderPanel(makeSettings(), downloads)
    await screen.findByText('Downloading…')
  })

  it('shows "Retry" for a failed download', async () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'tiny', status: 'failed', downloaded: 50, total: 100, percent: 50, error: 'network' }
    ]
    renderPanel(makeSettings(), downloads)
    await screen.findByText('Retry')
  })

  it('shows the failure error message in the row', async () => {
    const downloads: ModelDownloadJob[] = [
      { modelId: 'tiny', status: 'failed', downloaded: 50, total: 100, percent: 50, error: 'network down' }
    ]
    renderPanel(makeSettings(), downloads)
    await screen.findByText('network down')
  })

  it('handleEnqueueResult shows error when model is already installed', async () => {
    const downloadModel = window.vaak.downloadModel as ReturnType<typeof vi.fn>
    downloadModel.mockResolvedValue({
      accepted: false,
      modelId: 'tiny',
      reason: 'installed'
    })
    renderPanel()
    await waitFor(() => screen.getByText('Whisper Tiny'))
    const downloadBtns = screen.getAllByRole('button', { name: 'Download' })
    await userEvent.setup().click(downloadBtns[0])
    await waitFor(() => {
      expect(screen.getByText(/already installed/)).toBeInTheDocument()
    })
  })

  it('handleEnqueueResult shows error when model is already active', async () => {
    const downloadModel = window.vaak.downloadModel as ReturnType<typeof vi.fn>
    downloadModel.mockResolvedValue({
      accepted: false,
      modelId: 'tiny',
      reason: 'already_active'
    })
    renderPanel()
    await waitFor(() => screen.getByText('Whisper Tiny'))
    const downloadBtns = screen.getAllByRole('button', { name: 'Download' })
    await userEvent.setup().click(downloadBtns[0])
    await waitFor(() => {
      expect(screen.getByText(/already downloading/)).toBeInTheDocument()
    })
  })

  it('custom download button calls window.vaak.downloadCustomModel', async () => {
    const downloadCustomModel = window.vaak.downloadCustomModel as ReturnType<typeof vi.fn>
    downloadCustomModel.mockResolvedValue({ accepted: true, modelId: 'custom-x' })
    renderPanel()
    await userEvent.setup().type(screen.getByPlaceholderText(/huggingface.co/), 'https://example.com/x.bin')
    await userEvent.setup().click(screen.getByRole('button', { name: /Download Custom Model/ }))
    expect(downloadCustomModel).toHaveBeenCalledWith('https://example.com/x.bin', undefined)
  })

  it('custom download passes display name when provided', async () => {
    const downloadCustomModel = window.vaak.downloadCustomModel as ReturnType<typeof vi.fn>
    downloadCustomModel.mockResolvedValue({ accepted: true, modelId: 'custom-x' })
    renderPanel()
    await userEvent.setup().type(screen.getByPlaceholderText(/huggingface.co/), 'https://example.com/x.bin')
    await userEvent.setup().type(screen.getByPlaceholderText('My custom model'), 'My Display Name')
    await userEvent.setup().click(screen.getByRole('button', { name: /Download Custom Model/ }))
    expect(downloadCustomModel).toHaveBeenCalledWith(
      'https://example.com/x.bin',
      'My Display Name'
    )
  })
})
