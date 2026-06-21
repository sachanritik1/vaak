import { useEffect, useState } from 'react'
import type {
  AppSettings,
  DownloadEnqueueResult,
  InstalledModel,
  ModelCatalogEntry,
  ModelDownloadJob
} from '../../../shared/types'

type Props = {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
  downloads: ModelDownloadJob[]
  onRefresh: () => Promise<void>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function engineBadge(engine: ModelCatalogEntry['engine'], family?: ModelCatalogEntry['family']): string {
  switch (engine) {
    case 'parakeet-coreml':
      return 'CoreML'
    case 'parakeet-gguf':
      return 'GGUF'
    case 'sherpa-onnx':
      if (family === 'moonshine') return 'Moonshine'
      if (family === 'sensevoice') return 'SenseVoice'
      if (family === 'nemo') return 'NeMo'
      return 'ONNX'
    default:
      return 'Whisper'
  }
}

function getDownloadJob(downloads: ModelDownloadJob[], modelId: string): ModelDownloadJob | undefined {
  return downloads.find((d) => d.modelId === modelId)
}

function downloadLabel(job: ModelDownloadJob | undefined): string | null {
  if (!job) return null
  if (job.status === 'queued') return 'Queued…'
  if (job.status === 'downloading') return 'Downloading…'
  if (job.status === 'failed') return 'Retry'
  return null
}

function CatalogSection({
  title,
  description,
  models,
  installed,
  downloads,
  onDownload
}: {
  title: string
  description: string
  models: ModelCatalogEntry[]
  installed: InstalledModel[]
  downloads: ModelDownloadJob[]
  onDownload: (id: string) => void
}) {
  const isInstalled = (id: string) => installed.some((m) => m.id === id)

  if (models.length === 0) return null

  return (
    <div className="mb-8">
      <h3 className="font-medium text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4">{description}</p>
      <div className="space-y-3">
        {models.map((model) => {
          const job = getDownloadJob(downloads, model.id)
          const active = job?.status === 'queued' || job?.status === 'downloading'
          const failed = job?.status === 'failed'

          return (
            <div key={model.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium">{model.name}</p>
                    <span className="badge badge-muted">{engineBadge(model.engine, model.family)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{model.description}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {formatBytes(model.sizeBytes)} · {model.language}
                  </p>
                  {failed && job.error && (
                    <p className="text-xs text-red-400 mt-1">{job.error}</p>
                  )}
                </div>
                <div>
                  {isInstalled(model.id) ? (
                    <span className="badge badge-success">Installed</span>
                  ) : (
                    <button
                      className={`btn ${failed ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={active}
                      onClick={() => onDownload(model.id)}
                    >
                      {downloadLabel(job) ?? 'Download'}
                    </button>
                  )}
                </div>
              </div>
              {job && (active || failed) && (
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${failed ? 'bg-red-500' : ''}`}
                    style={{ width: `${failed ? 100 : job.percent}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ModelsPanel({ settings, onUpdate, downloads, onRefresh }: Props) {
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([])
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [customUrl, setCustomUrl] = useState('')
  const [customName, setCustomName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const whisperModels = catalog.filter((m) => m.family === 'whisper')
  const parakeetModels = catalog.filter((m) => m.family === 'parakeet')
  const moonshineModels = catalog.filter((m) => m.family === 'moonshine')
  const sensevoiceModels = catalog.filter((m) => m.family === 'sensevoice')
  const nemoModels = catalog.filter((m) => m.family === 'nemo')

  const activeModel = installed.find((m) => m.id === settings.activeModelId)
  const showGpuToggle = !activeModel || activeModel.engine === 'whisper'

  const customJob = downloads.find((d) => d.modelId.startsWith('custom-'))
  const customActive =
    customJob?.status === 'queued' || customJob?.status === 'downloading'

  const refreshLocal = async () => {
    const [c, i] = await Promise.all([
      window.openwhisper.getModelCatalog() as Promise<ModelCatalogEntry[]>,
      window.openwhisper.getInstalledModels() as Promise<InstalledModel[]>
    ])
    setCatalog(c)
    setInstalled(i)
  }

  useEffect(() => {
    void refreshLocal()
  }, [])

  useEffect(() => {
    if (downloads.some((d) => d.status === 'completed')) {
      void refreshLocal()
      void onRefresh()
    }
  }, [downloads, onRefresh])

  const handleEnqueueResult = (result: DownloadEnqueueResult) => {
    if (result.accepted) return
    if (result.reason === 'installed') {
      setError('That model is already installed.')
    } else if (result.reason === 'already_active') {
      setError('That model is already downloading or queued.')
    }
  }

  const handleDownload = (id: string) => {
    setError(null)
    void window.openwhisper.downloadModel(id).then(handleEnqueueResult)
  }

  const handleCustomDownload = () => {
    if (!customUrl.trim()) return
    setError(null)
    void window.openwhisper
      .downloadCustomModel(customUrl, customName || undefined)
      .then((result) => {
        handleEnqueueResult(result as DownloadEnqueueResult)
        if (result.accepted) {
          setCustomUrl('')
          setCustomName('')
        }
      })
  }

  const handleSetActive = async (id: string) => {
    await window.openwhisper.setActiveModel(id)
    await onUpdate({ activeModelId: id })
  }

  const handleDelete = async (id: string) => {
    await window.openwhisper.deleteModel(id)
    await refreshLocal()
    await onRefresh()
    const s = await window.openwhisper.getSettings()
    await onUpdate({ activeModelId: s.activeModelId })
  }

  const activeCount = downloads.filter(
    (d) => d.status === 'queued' || d.status === 'downloading'
  ).length

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">Models</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Download open-weight speech models. Whisper, Parakeet, Moonshine, SenseVoice, and NeMo all
        run locally on your machine.
      </p>

      {activeCount > 0 && (
        <div className="card border-indigo-500/30 bg-indigo-500/5 mb-4">
          <p className="text-indigo-200 text-sm">
            {activeCount} download{activeCount === 1 ? '' : 's'} in progress — you can switch tabs
            or queue up to 3 at once.
          </p>
        </div>
      )}

      {error && (
        <div className="card border-red-500/30 bg-red-500/5 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {installed.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-medium text-white mb-4">Installed Models</h3>
          {installed.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
            >
              <div>
                <p className="text-white text-sm font-medium">{model.name}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(model.sizeBytes)} · {model.language} ·{' '}
                  {engineBadge(
                    model.engine ?? 'whisper',
                    catalog.find((c) => c.id === model.id)?.family
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {settings.activeModelId === model.id ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <button className="btn btn-secondary" onClick={() => handleSetActive(model.id)}>
                    Set Active
                  </button>
                )}
                <button className="btn btn-danger" onClick={() => handleDelete(model.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-6">
        <h3 className="font-medium text-white mb-1">Add Custom Model</h3>
        <p className="text-xs text-slate-500 mb-4">
          Paste a HuggingFace URL or direct link to a Whisper (.bin), Parakeet (.gguf), or ONNX
          model file.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="custom-model-url" className="block text-xs font-medium text-slate-400 mb-1.5">
              Model URL
            </label>
            <input
              id="custom-model-url"
              type="url"
              className="input"
              placeholder="https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-tiny-en-int8/resolve/main/encode.int8.onnx"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="custom-model-name" className="block text-xs font-medium text-slate-400 mb-1.5">
              Display name <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input
              id="custom-model-name"
              type="text"
              className="input max-w-md"
              placeholder="My custom model"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary mt-4"
          disabled={!customUrl.trim() || customActive}
          onClick={handleCustomDownload}
        >
          {downloadLabel(customJob) ?? 'Download Custom Model'}
        </button>

        {customJob && (customActive || customJob.status === 'failed') && (
          <div className="progress-bar mt-3">
            <div
              className={`progress-bar-fill ${customJob.status === 'failed' ? 'bg-red-500' : ''}`}
              style={{ width: `${customJob.status === 'failed' ? 100 : customJob.percent}%` }}
            />
          </div>
        )}
      </div>

      <CatalogSection
        title="Moonshine"
        description="Useful Sensors Moonshine models via sherpa-onnx. Extremely fast English ASR — great for low-latency dictation."
        models={moonshineModels}
        installed={installed}
        downloads={downloads}
        onDownload={handleDownload}
      />

      <CatalogSection
        title="SenseVoice"
        description="Alibaba FunASR SenseVoice — multilingual ASR for Chinese, English, Japanese, Korean, and Cantonese."
        models={sensevoiceModels}
        installed={installed}
        downloads={downloads}
        onDownload={handleDownload}
      />

      <CatalogSection
        title="NVIDIA NeMo"
        description="NeMo CTC conformer models via sherpa-onnx. Strong English accuracy from NVIDIA's speech stack."
        models={nemoModels}
        installed={installed}
        downloads={downloads}
        onDownload={handleDownload}
      />

      <CatalogSection
        title="NVIDIA Parakeet"
        description="High-speed ASR from NVIDIA. CoreML uses Apple Neural Engine; GGUF models run via parakeet.cpp (auto-downloaded on first use)."
        models={parakeetModels}
        installed={installed}
        downloads={downloads}
        onDownload={handleDownload}
      />

      <CatalogSection
        title="OpenAI Whisper"
        description="Classic open-weight models via whisper.cpp. Works on Intel and Apple Silicon."
        models={whisperModels}
        installed={installed}
        downloads={downloads}
        onDownload={handleDownload}
      />

      {showGpuToggle && (
        <div className="card mt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.gpuEnabled}
              onChange={(e) => onUpdate({ gpuEnabled: e.target.checked })}
              className="w-4 h-4 accent-indigo-500"
            />
            <div>
              <p className="text-white text-sm font-medium">Use GPU acceleration (Metal)</p>
              <p className="text-xs text-slate-500">Applies to Whisper models only</p>
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
