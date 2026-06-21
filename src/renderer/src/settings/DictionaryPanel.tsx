import { useState } from 'react'
import type { AppSettings, DictionaryEntry } from '../../../shared/types'

type Props = {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}

export function DictionaryPanel({ settings, onUpdate }: Props) {
  const [word, setWord] = useState('')
  const [replacement, setReplacement] = useState('')

  const addEntry = () => {
    if (!word.trim()) return
    const entry: DictionaryEntry = {
      word: word.trim(),
      replacement: replacement.trim() || undefined
    }
    onUpdate({ dictionary: [...settings.dictionary, entry] })
    setWord('')
    setReplacement('')
  }

  const removeEntry = (index: number) => {
    const next = settings.dictionary.filter((_, i) => i !== index)
    onUpdate({ dictionary: next })
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-white mb-2">Personal Dictionary</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Teach OpenWhisper your names, jargon, and preferred spellings. Words are passed to Whisper as context hints; optional replacements are applied after transcription.
      </p>

      <div className="card">
        <h3 className="font-medium text-white mb-4">Add Word</h3>
        <div className="flex gap-3 mb-3">
          <input
            className="input flex-1"
            placeholder="Word or phrase (e.g. OpenWhisper)"
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
          <input
            className="input flex-1"
            placeholder="Replacement (optional)"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={addEntry} disabled={!word.trim()}>
          Add
        </button>
      </div>

      {settings.dictionary.length > 0 && (
        <div className="card">
          <h3 className="font-medium text-white mb-4">Your Dictionary</h3>
          {settings.dictionary.map((entry, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <span className="text-white text-sm">{entry.word}</span>
                {entry.replacement && (
                  <span className="text-slate-500 text-sm"> → {entry.replacement}</span>
                )}
              </div>
              <button className="btn btn-danger" onClick={() => removeEntry(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
