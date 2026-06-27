import type { AiConfig, AiProvider, AppSettings } from '../../../shared/types'

const PROVIDER_LABELS: Record<Exclude<AiProvider, 'none'>, string> = {
  ollama: 'Ollama',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter'
}

type Props = {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}

export function AiPanel({ settings, onUpdate }: Props) {
  const ai = settings.ai

  const updateAi = (partial: Partial<AiConfig>) => {
    onUpdate({ ai: { ...ai, ...partial } })
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">AI Cleanup</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Optionally clean up dictated text — remove filler words, fix grammar. Off by default; raw transcription is used when disabled.
      </p>

      <div className="card">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ai.enabled}
            onChange={(e) => updateAi({ enabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
          <div>
            <p className="text-white text-sm font-medium">Enable AI cleanup</p>
            <p className="text-xs text-slate-500">Applied after local transcription, before pasting</p>
          </div>
        </label>
      </div>

      {ai.enabled && (
        <>
          <div className="card">
            <h3 className="font-medium text-white mb-4">Provider</h3>
            <div className="flex flex-wrap gap-2">
              {(['ollama', 'openai', 'anthropic', 'openrouter'] as const).map((p) => (
                <button
                  key={p}
                  className={`btn ${ai.provider === p ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => updateAi({ provider: p })}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {ai.provider === 'ollama' && (
            <div className="card">
              <h3 className="font-medium text-white mb-4">Ollama (Local)</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Server URL</label>
                  <input
                    className="input"
                    value={ai.ollamaUrl}
                    onChange={(e) => updateAi({ ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Model</label>
                  <input
                    className="input"
                    value={ai.ollamaModel}
                    onChange={(e) => updateAi({ ollamaModel: e.target.value })}
                    placeholder="llama3.2"
                  />
                </div>
              </div>
            </div>
          )}

          {ai.provider === 'openai' && (
            <div className="card">
              <h3 className="font-medium text-white mb-4">OpenAI</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">API Key</label>
                  <input
                    className="input"
                    type="password"
                    value={ai.openaiApiKey}
                    onChange={(e) => updateAi({ openaiApiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Model</label>
                  <input
                    className="input"
                    value={ai.openaiModel}
                    onChange={(e) => updateAi({ openaiModel: e.target.value })}
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </div>
            </div>
          )}

          {ai.provider === 'anthropic' && (
            <div className="card">
              <h3 className="font-medium text-white mb-4">Anthropic</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">API Key</label>
                  <input
                    className="input"
                    type="password"
                    value={ai.anthropicApiKey}
                    onChange={(e) => updateAi({ anthropicApiKey: e.target.value })}
                    placeholder="sk-ant-..."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Model</label>
                  <input
                    className="input"
                    value={ai.anthropicModel}
                    onChange={(e) => updateAi({ anthropicModel: e.target.value })}
                    placeholder="claude-3-5-haiku-20241022"
                  />
                </div>
              </div>
            </div>
          )}

          {ai.provider === 'openrouter' && (
            <div className="card">
              <h3 className="font-medium text-white mb-4">OpenRouter</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">API Key</label>
                  <input
                    className="input"
                    type="password"
                    value={ai.openrouterApiKey}
                    onChange={(e) => updateAi({ openrouterApiKey: e.target.value })}
                    placeholder="sk-or-..."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Model</label>
                  <input
                    className="input"
                    value={ai.openrouterModel}
                    onChange={(e) => updateAi({ openrouterModel: e.target.value })}
                    placeholder="openai/gpt-4o-mini"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
