import type { InstalledModel, SttEngineType } from '../../shared/types'
import type { TranscribeOptions } from './engine'
import { getSttEngine as getWhisperEngine } from './smart-whisper-engine'
import { getParakeetCoremlEngine } from './parakeet-coreml-engine'
import { getParakeetGgufEngine } from './parakeet-gguf-engine'
import { getSherpaOnnxEngine } from './sherpa-onnx-engine'

let activeEngineType: SttEngineType | null = null
let activeModelId: string | null = null

async function unloadAll(): Promise<void> {
  await getWhisperEngine().unload()
  await getParakeetCoremlEngine().unload()
  await getParakeetGgufEngine().unload()
  await getSherpaOnnxEngine().unload()
  activeEngineType = null
  activeModelId = null
}

export async function loadModelForTranscription(model: InstalledModel): Promise<void> {
  const engineType = model.engine ?? 'whisper'

  if (engineType === activeEngineType && activeModelId === model.id) {
    if (engineType === 'whisper') {
      await getWhisperEngine().load(model.path)
      return
    }
    if (engineType === 'parakeet-coreml') {
      await getParakeetCoremlEngine().load(model.path)
      return
    }
    if (engineType === 'parakeet-gguf') {
      await getParakeetGgufEngine().load(model.path)
      return
    }
    if (engineType === 'sherpa-onnx') {
      await getSherpaOnnxEngine().load(model.path)
      return
    }
  }

  await unloadAll()

  if (engineType === 'whisper') {
    await getWhisperEngine().load(model.path)
    activeEngineType = 'whisper'
    activeModelId = model.id
    return
  }

  if (engineType === 'parakeet-coreml') {
    await getParakeetCoremlEngine().load(model.path)
    activeEngineType = 'parakeet-coreml'
    activeModelId = model.id
    return
  }

  if (engineType === 'parakeet-gguf') {
    await getParakeetGgufEngine().load(model.path)
    activeEngineType = 'parakeet-gguf'
    activeModelId = model.id
    return
  }

  if (engineType === 'sherpa-onnx') {
    await getSherpaOnnxEngine().load(model.path)
    activeEngineType = 'sherpa-onnx'
    activeModelId = model.id
    return
  }

  throw new Error(`Unknown STT engine: ${engineType}`)
}

export async function transcribeWithActiveEngine(
  pcm: Float32Array,
  options: TranscribeOptions = {}
): Promise<string> {
  if (activeEngineType === 'parakeet-coreml') {
    return getParakeetCoremlEngine().transcribe(pcm, options)
  }
  if (activeEngineType === 'parakeet-gguf') {
    return getParakeetGgufEngine().transcribe(pcm, options)
  }
  if (activeEngineType === 'sherpa-onnx') {
    return getSherpaOnnxEngine().transcribe(pcm, options)
  }
  if (activeEngineType === 'whisper') {
    return getWhisperEngine().transcribe(pcm, options)
  }
  throw new Error('No STT engine loaded. Select and download a model first.')
}

export async function unloadSttEngines(): Promise<void> {
  await unloadAll()
}
