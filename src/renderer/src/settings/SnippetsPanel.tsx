import { useState } from 'react'
import type { AppSettings, Snippet } from '../../../shared/types'

type Props = {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}

export function SnippetsPanel({ settings, onUpdate }: Props) {
  const [trigger, setTrigger] = useState('')
  const [content, setContent] = useState('')

  const addSnippet = () => {
    if (!trigger.trim() || !content.trim()) return
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      trigger: trigger.trim(),
      content: content.trim()
    }
    onUpdate({ snippets: [...settings.snippets, snippet] })
    setTrigger('')
    setContent('')
  }

  const removeSnippet = (id: string) => {
    onUpdate({ snippets: settings.snippets.filter((s) => s.id !== id) })
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">Snippets</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Speak a trigger phrase to expand it into full formatted text — great for email signatures, scheduling links, and FAQs.
      </p>

      <div className="card">
        <h3 className="font-medium text-white mb-4">Add Snippet</h3>
        <div className="space-y-3 mb-3">
          <input
            className="input"
            placeholder='Trigger phrase (e.g. "calendar link")'
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
          />
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="Full text to insert"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={addSnippet} disabled={!trigger.trim() || !content.trim()}>
          Add Snippet
        </button>
      </div>

      {settings.snippets.length > 0 && (
        <div className="card">
          <h3 className="font-medium text-white mb-4">Your Snippets</h3>
          {settings.snippets.map((snippet) => (
            <div key={snippet.id} className="py-3 border-b border-white/5 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-indigo-400 text-sm font-medium">"{snippet.trigger}"</p>
                  <p className="text-slate-400 text-sm mt-1 whitespace-pre-wrap">{snippet.content}</p>
                </div>
                <button className="btn btn-danger flex-shrink-0" onClick={() => removeSnippet(snippet.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
