import type { ModelCatalogEntry } from '../../shared/types'

const HF_PARAKEET_GGUF =
  'https://huggingface.co/mudler/parakeet-cpp-gguf/resolve/main'

export const WHISPER_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'tiny',
    name: 'Whisper Tiny',
    filename: 'ggml-tiny.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    sizeBytes: 75_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Fastest, lowest accuracy. Good for testing (~75 MB).'
  },
  {
    id: 'tiny.en',
    name: 'Whisper Tiny (English)',
    filename: 'ggml-tiny.en.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    sizeBytes: 75_000_000,
    language: 'english',
    engine: 'whisper',
    family: 'whisper',
    description: 'English-only tiny model (~75 MB).'
  },
  {
    id: 'base',
    name: 'Whisper Base',
    filename: 'ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    sizeBytes: 142_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Balanced speed and accuracy (~142 MB).'
  },
  {
    id: 'base.en',
    name: 'Whisper Base (English)',
    filename: 'ggml-base.en.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    sizeBytes: 142_000_000,
    language: 'english',
    engine: 'whisper',
    family: 'whisper',
    description: 'English-only base model (~142 MB).'
  },
  {
    id: 'small',
    name: 'Whisper Small',
    filename: 'ggml-small.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    sizeBytes: 466_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Good accuracy for daily use (~466 MB).'
  },
  {
    id: 'small.en',
    name: 'Whisper Small (English)',
    filename: 'ggml-small.en.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    sizeBytes: 466_000_000,
    language: 'english',
    engine: 'whisper',
    family: 'whisper',
    description: 'English-only small model (~466 MB).'
  },
  {
    id: 'small-q8_0',
    name: 'Whisper Small (Q8)',
    filename: 'ggml-small-q8_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q8_0.bin',
    sizeBytes: 264_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Q8 quantized small — better accuracy than base at ~252 MB.'
  },
  {
    id: 'medium',
    name: 'Whisper Medium',
    filename: 'ggml-medium.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    sizeBytes: 1_500_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'High accuracy, slower (~1.5 GB).'
  },
  {
    id: 'medium.en',
    name: 'Whisper Medium (English)',
    filename: 'ggml-medium.en.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
    sizeBytes: 1_534_000_000,
    language: 'english',
    engine: 'whisper',
    family: 'whisper',
    description: 'English-only medium — strong accuracy for dictation (~1.5 GB).'
  },
  {
    id: 'medium-q5_0',
    name: 'Whisper Medium (Q5)',
    filename: 'ggml-medium-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin',
    sizeBytes: 539_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Quantized medium — near-full accuracy at ~514 MB. Great daily driver.'
  },
  {
    id: 'medium.en-q5_0',
    name: 'Whisper Medium English (Q5)',
    filename: 'ggml-medium.en-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin',
    sizeBytes: 539_000_000,
    language: 'english',
    engine: 'whisper',
    family: 'whisper',
    description: 'English-only medium, Q5 quantized (~514 MB). Recommended for English dictation.'
  },
  {
    id: 'large-v3',
    name: 'Whisper Large v3',
    filename: 'ggml-large-v3.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    sizeBytes: 3_100_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Best accuracy, requires significant RAM (~3.1 GB).'
  },
  {
    id: 'large-v3-q5_0',
    name: 'Whisper Large v3 (Q5)',
    filename: 'ggml-large-v3-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin',
    sizeBytes: 1_081_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Large v3 quality in ~1 GB — best accuracy per gigabyte for Whisper.'
  },
  {
    id: 'large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    filename: 'ggml-large-v3-turbo.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    sizeBytes: 1_600_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Large v3 quality at lower cost (~1.6 GB).'
  },
  {
    id: 'large-v3-turbo-q5_0',
    name: 'Whisper Large v3 Turbo (Q5)',
    filename: 'ggml-large-v3-turbo-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
    sizeBytes: 574_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Quantized turbo model, good balance (~574 MB).'
  },
  {
    id: 'large-v3-turbo-q8_0',
    name: 'Whisper Large v3 Turbo (Q8)',
    filename: 'ggml-large-v3-turbo-q8_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin',
    sizeBytes: 874_000_000,
    language: 'multilingual',
    engine: 'whisper',
    family: 'whisper',
    description: 'Highest-quality turbo quant — near full turbo accuracy at ~834 MB.'
  }
]

/** NVIDIA Parakeet models — GGUF from [mudler/parakeet-cpp-gguf](https://huggingface.co/mudler/parakeet-cpp-gguf) */
export const PARAKEET_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'parakeet-tdt-v3-coreml',
    name: 'Parakeet TDT v3 (CoreML / ANE)',
    filename: 'coreml-bundle',
    url: '',
    sizeBytes: 1_500_000_000,
    language: 'multilingual (25 languages)',
    engine: 'parakeet-coreml',
    family: 'parakeet',
    description:
      'NVIDIA Parakeet 0.6B v3 on Apple Neural Engine. Fastest on Apple Silicon — recommended for Mac.'
  },
  {
    id: 'parakeet-tdt-v3-f16',
    name: 'Parakeet TDT v3 (GGUF F16)',
    filename: 'tdt-0.6b-v3-f16.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v3-f16.gguf`,
    sizeBytes: 1_200_000_000,
    language: 'multilingual (25 languages)',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Multilingual Parakeet v3, full precision GGUF via parakeet.cpp (~1.2 GB).'
  },
  {
    id: 'parakeet-tdt-v3-q8',
    name: 'Parakeet TDT v3 (GGUF Q8)',
    filename: 'tdt-0.6b-v3-q8_0.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v3-q8_0.gguf`,
    sizeBytes: 650_000_000,
    language: 'multilingual (25 languages)',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Multilingual Parakeet v3, Q8 quantized — good accuracy/size balance (~650 MB).'
  },
  {
    id: 'parakeet-tdt-v3-q5_k',
    name: 'Parakeet TDT v3 (GGUF Q5)',
    filename: 'tdt-0.6b-v3-q5_k.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v3-q5_k.gguf`,
    sizeBytes: 742_000_000,
    language: 'multilingual (25 languages)',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Multilingual v3, Q5 — lighter than Q8 with strong accuracy (~707 MB).'
  },
  {
    id: 'parakeet-tdt-v3-q4_k',
    name: 'Parakeet TDT v3 (GGUF Q4)',
    filename: 'tdt-0.6b-v3-q4_k.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v3-q4_k.gguf`,
    sizeBytes: 675_000_000,
    language: 'multilingual (25 languages)',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Smallest practical v3 quant — fast multilingual dictation (~644 MB).'
  },
  {
    id: 'parakeet-nemotron-streaming-q8',
    name: 'Nemotron 3.5 Streaming ASR (Q8)',
    filename: 'nemotron-3.5-asr-streaming-0.6b-q8_0.gguf',
    url: `${HF_PARAKEET_GGUF}/nemotron-3.5-asr-streaming-0.6b-q8_0.gguf`,
    sizeBytes: 984_000_000,
    language: 'multilingual',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description:
      'NVIDIA Nemotron 3.5 streaming model — optimized for low-latency, responsive transcription (~938 MB).'
  },
  {
    id: 'parakeet-tdt-v2-f16',
    name: 'Parakeet TDT v2 (GGUF F16)',
    filename: 'tdt-0.6b-v2-f16.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v2-f16.gguf`,
    sizeBytes: 1_200_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'English-only Parakeet v2 with punctuation and timestamps (~1.2 GB).'
  },
  {
    id: 'parakeet-tdt-v2-q8',
    name: 'Parakeet TDT v2 (GGUF Q8)',
    filename: 'tdt-0.6b-v2-q8_0.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v2-q8_0.gguf`,
    sizeBytes: 650_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'English-only Parakeet v2, Q8 quantized (~650 MB).'
  },
  {
    id: 'parakeet-tdt-v2-q5_k',
    name: 'Parakeet TDT v2 (GGUF Q5)',
    filename: 'tdt-0.6b-v2-q5_k.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-0.6b-v2-q5_k.gguf`,
    sizeBytes: 705_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'English v2, Q5 quantized — compact and fast (~672 MB).'
  },
  {
    id: 'parakeet-ctc-110m-f16',
    name: 'Parakeet CTC 110M (GGUF F16)',
    filename: 'tdt_ctc-110m-f16.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt_ctc-110m-f16.gguf`,
    sizeBytes: 220_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Smallest Parakeet model — fast English transcription (~220 MB).'
  },
  {
    id: 'parakeet-ctc-110m-q8',
    name: 'Parakeet CTC 110M (GGUF Q8)',
    filename: 'tdt_ctc-110m-q8_0.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt_ctc-110m-q8_0.gguf`,
    sizeBytes: 178_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Ultra-light English model — fastest Parakeet option (~170 MB).'
  },
  {
    id: 'parakeet-tdt-1.1b-f16',
    name: 'Parakeet TDT 1.1B (GGUF F16)',
    filename: 'tdt-1.1b-f16.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-1.1b-f16.gguf`,
    sizeBytes: 2_200_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Larger English Parakeet for highest accuracy (~2.2 GB).'
  },
  {
    id: 'parakeet-tdt-1.1b-q8',
    name: 'Parakeet TDT 1.1B (GGUF Q8)',
    filename: 'tdt-1.1b-q8_0.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt-1.1b-q8_0.gguf`,
    sizeBytes: 1_555_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Top-tier English accuracy at half the F16 size (~1.45 GB).'
  },
  {
    id: 'parakeet-tdt-ctc-1.1b-q8',
    name: 'Parakeet TDT-CTC 1.1B (GGUF Q8)',
    filename: 'tdt_ctc-1.1b-q8_0.gguf',
    url: `${HF_PARAKEET_GGUF}/tdt_ctc-1.1b-q8_0.gguf`,
    sizeBytes: 1_559_000_000,
    language: 'english',
    engine: 'parakeet-gguf',
    family: 'parakeet',
    description: 'Hybrid TDT+CTC 1.1B — excellent English accuracy with punctuation (~1.45 GB).'
  }
]

const HF_MOONSHINE_TINY =
  'https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-tiny-en-int8/resolve/main'
const HF_MOONSHINE_BASE =
  'https://huggingface.co/csukuangfj/sherpa-onnx-moonshine-base-en-int8/resolve/main'
const HF_SENSE_INT8 =
  'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09/resolve/main'
const HF_NEMO_MEDIUM =
  'https://huggingface.co/csukuangfj/sherpa-onnx-nemo-ctc-en-conformer-medium/resolve/main'

function moonshineFiles(baseUrl: string) {
  return [
    { filename: 'preprocess.onnx', url: `${baseUrl}/preprocess.onnx` },
    { filename: 'encode.int8.onnx', url: `${baseUrl}/encode.int8.onnx` },
    { filename: 'uncached_decode.int8.onnx', url: `${baseUrl}/uncached_decode.int8.onnx` },
    { filename: 'cached_decode.int8.onnx', url: `${baseUrl}/cached_decode.int8.onnx` },
    { filename: 'tokens.txt', url: `${baseUrl}/tokens.txt` }
  ]
}

const MOONSHINE_SHERPA = {
  kind: 'moonshine' as const,
  modelType: 'moonshine',
  tokens: 'tokens.txt',
  preprocessor: 'preprocess.onnx',
  encoder: 'encode.int8.onnx',
  uncachedDecoder: 'uncached_decode.int8.onnx',
  cachedDecoder: 'cached_decode.int8.onnx'
}

/** Useful Sensors Moonshine via sherpa-onnx — ultra-fast English ASR */
export const MOONSHINE_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'moonshine-tiny-en',
    name: 'Moonshine Tiny (English)',
    filename: 'moonshine-tiny-en',
    url: '',
    sizeBytes: 124_000_000,
    language: 'english',
    engine: 'sherpa-onnx',
    family: 'moonshine',
    description:
      'Useful Sensors Moonshine — designed for edge devices, ~5× faster than Whisper base on CPU (~124 MB).',
    files: moonshineFiles(HF_MOONSHINE_TINY),
    sherpa: MOONSHINE_SHERPA
  },
  {
    id: 'moonshine-base-en',
    name: 'Moonshine Base (English)',
    filename: 'moonshine-base-en',
    url: '',
    sizeBytes: 287_000_000,
    language: 'english',
    engine: 'sherpa-onnx',
    family: 'moonshine',
    description: 'Higher-accuracy Moonshine base model — still much faster than Whisper small (~287 MB).',
    files: moonshineFiles(HF_MOONSHINE_BASE),
    sherpa: MOONSHINE_SHERPA
  }
]

/** Alibaba FunASR SenseVoice — multilingual with emotion/event tags stripped at output */
export const SENSEVOICE_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'sensevoice-multilingual-int8',
    name: 'SenseVoice Small (Multilingual)',
    filename: 'sensevoice-multilingual-int8',
    url: '',
    sizeBytes: 237_000_000,
    language: 'zh · en · ja · ko · yue',
    engine: 'sherpa-onnx',
    family: 'sensevoice',
    description:
      'Alibaba SenseVoice — strong multilingual ASR for Chinese, English, Japanese, Korean, and Cantonese (~226 MB).',
    files: [
      { filename: 'model.int8.onnx', url: `${HF_SENSE_INT8}/model.int8.onnx` },
      { filename: 'tokens.txt', url: `${HF_SENSE_INT8}/tokens.txt` }
    ],
    sherpa: {
      kind: 'sense-voice',
      modelType: 'sense_voice',
      tokens: 'tokens.txt',
      model: 'model.int8.onnx',
      senseVoiceLanguage: 'auto',
      senseVoiceItn: true
    }
  }
]

/** NVIDIA NeMo CTC models via sherpa-onnx */
export const NEMO_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'nemo-conformer-medium-en',
    name: 'NeMo Conformer Medium (English)',
    filename: 'nemo-conformer-medium-en',
    url: '',
    sizeBytes: 68_000_000,
    language: 'english',
    engine: 'sherpa-onnx',
    family: 'nemo',
    description: 'NVIDIA NeMo CTC conformer-medium — accurate English dictation (~64 MB int8).',
    files: [
      { filename: 'model.int8.onnx', url: `${HF_NEMO_MEDIUM}/model.int8.onnx` },
      { filename: 'tokens.txt', url: `${HF_NEMO_MEDIUM}/tokens.txt` }
    ],
    sherpa: {
      kind: 'nemo-ctc',
      modelType: 'nemo_ctc',
      tokens: 'tokens.txt',
      model: 'model.int8.onnx'
    }
  }
]

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  ...WHISPER_CATALOG,
  ...PARAKEET_CATALOG,
  ...MOONSHINE_CATALOG,
  ...SENSEVOICE_CATALOG,
  ...NEMO_CATALOG
]

export function findCatalogEntry(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.id === id)
}

export function resolveHuggingFaceUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('huggingface.co') && !trimmed.includes('/resolve/')) {
      const match = trimmed.match(/huggingface\.co\/([^/]+\/[^/]+)(?:\/tree\/main\/(.+))?/)
      if (match) {
        const [, repo, file] = match
        const filename = file || trimmed.split('/').pop() || 'model.bin'
        return `https://huggingface.co/${repo}/resolve/main/${filename}`
      }
    }
    return trimmed
  }
  return trimmed
}

export function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/')
    return decodeURIComponent(parts[parts.length - 1] || 'custom-model.bin')
  } catch {
    return 'custom-model.bin'
  }
}

export function inferEngineFromFilename(filename: string): ModelCatalogEntry['engine'] {
  if (filename.endsWith('.gguf') && !filename.startsWith('ggml-')) {
    return 'parakeet-gguf'
  }
  if (filename.endsWith('.onnx')) {
    return 'sherpa-onnx'
  }
  return 'whisper'
}
