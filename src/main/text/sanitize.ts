/** Lines emitted by whisper.cpp / ggml / parakeet / sherpa native runtimes — not speech. */
const ENGINE_LOG_LINE =
  /^(?:ggml(?:_[\w]+)?|whisper(?:_[\w]+)?|llama(?:_[\w]+)?|parakeet(?:_[\w]+)?|sherpa(?:_[\w-]+)?|metal(?:_[\w]+)?|coreml(?:_[\w]+)?|cuda(?:_[\w]+)?|openvino(?:_[\w]+)?|OfflineRecognizerConfig|Creating recognizer|recognizer created|Started|Done!|Real time factor|num threads:|decoding method:|Elapsed seconds:|libc\+\+abi:)\b/i

const ENGINE_LOG_PHRASE =
  /\b(?:deallocat(?:e|ing)|allocat(?:e|ing)|initializ(?:e|ing)|loading model|loaded model|backend|system_info|whisper_init|whisper_free|metal_init|metal_free)\b/i

/** Clean up raw STT output before injection. */
export function sanitizeTranscription(raw: string): string {
  let text = extractTextField(raw).trim()
  if (!text) return ''

  text = stripEngineLogLines(text)

  // Bracketed / parenthetical non-speech markers
  text = text.replace(
    /\[(?:inaudible|unclear|music|silence|blank[_ ]audio|noise|laughter|applause|foreign language)\]/gi,
    ''
  )
  text = text.replace(/\((?:inaudible|unclear|silence|music)\)/gi, '')
  text = text.replace(/\*+(?:inaudible|unclear|silence)\*+/gi, '')

  // Strip leaked JSON fragments
  text = text.replace(/^\s*\{.*?"text"\s*:\s*"/, '')
  text = text.replace(/"[^"]*"\s*,\s*"words".*$/s, '')
  text = text.replace(/"\s*,\s*"tokens".*$/s, '')

  text = stripEngineLogLines(text)

  // Common silence hallucinations (Whisper/Parakeet on quiet input)
  const normalized = text.toLowerCase().replace(/[.!?,]/g, '').trim()
  const hallucinations = new Set([
    'thank you',
    'thank you for watching',
    'thanks for watching',
    'subscribe',
    'you',
    'the',
    'subtitle by',
    'inaudible',
    'silence',
    'blank audio',
    'music',
    'applause',
    'ggml metal free deallocating',
    'ggml_metal_free deallocating'
  ])
  if (hallucinations.has(normalized)) return ''

  return text.replace(/\s{2,}/g, ' ').trim()
}

export function isEngineLogLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (ENGINE_LOG_LINE.test(t)) return true
  if (t.includes('OfflineRecognizerConfig(')) return true
  if (t.includes('/parse-options.cc:')) return true
  if (/^Real time factor \(RTF\):/i.test(t)) return true
  if (/^Elapsed seconds:/i.test(t)) return true
  if (t.endsWith('.wav') && !t.includes(' ')) return true
  if (t === '----') return true
  if (ENGINE_LOG_PHRASE.test(t) && /^[\w._-]+:\s/.test(t)) return true
  // `ggml_metal_free: deallocating` and similar `identifier: message` logs
  if (/^[\w._-]+:\s/.test(t) && ENGINE_LOG_PHRASE.test(t)) return true
  return false
}

function stripEngineLogLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isEngineLogLine(line))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractTextField(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // Pure JSON object
  if (trimmed.startsWith('{')) {
    const parsed = tryParseJson(trimmed)
    if (parsed?.text) return String(parsed.text)
  }

  // JSON line buried in log output (parakeet-cli)
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isEngineLogLine(lines[i])) continue
    if (!lines[i].startsWith('{')) continue
    const parsed = tryParseJson(lines[i])
    if (parsed?.text) return String(parsed.text)
  }

  // Speech-only lines when JSON is absent
  const speechLines = lines.filter((l) => !isEngineLogLine(l) && !l.startsWith('{'))
  if (speechLines.length > 0) {
    return speechLines.join(' ')
  }

  // Embedded JSON substring
  const match = trimmed.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (match) {
    try {
      return JSON.parse(`"${match[1]}"`) as string
    } catch {
      return match[1]
    }
  }

  return stripEngineLogLines(trimmed)
}

function tryParseJson(input: string): { text?: string } | null {
  try {
    return JSON.parse(input) as { text?: string }
  } catch {
    return null
  }
}
