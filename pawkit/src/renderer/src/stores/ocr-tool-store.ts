import { create } from 'zustand'
import type { OcrMode, OcrRecognizeResult, OcrSourceRef } from '../../../shared/types'

interface OcrToolState {
  sources: OcrSourceRef[]
  selectedSourceId: string | null
  latestResult: OcrRecognizeResult | null
  requestedMode: OcrMode
  addSources: (sources: OcrSourceRef[], mode?: OcrMode) => void
  selectSource: (sourceId: string | null) => void
  removeSource: (sourceId: string) => void
  setLatestResult: (result: OcrRecognizeResult | null) => void
  setRequestedMode: (mode: OcrMode) => void
}

// OCR 工具工作台状态
export const useOcrToolStore = create<OcrToolState>((set, get) => ({
  sources: [],
  selectedSourceId: null,
  latestResult: null,
  requestedMode: 'auto',
  addSources: (sources, mode = 'auto') => {
    if (sources.length === 0) return
    const current = get().sources
    const next = [
      ...sources,
      ...current.filter((item) => !sources.some((source) => source.id === item.id))
    ]
    set({
      sources: next,
      selectedSourceId: sources[0].id,
      latestResult: null,
      requestedMode: mode
    })
  },
  selectSource: (sourceId) => set({ selectedSourceId: sourceId, latestResult: null }),
  removeSource: (sourceId) => {
    const next = get().sources.filter((item) => item.id !== sourceId)
    const selected = get().selectedSourceId === sourceId ? next[0]?.id ?? null : get().selectedSourceId
    set({ sources: next, selectedSourceId: selected, latestResult: null })
  },
  setLatestResult: (result) => set({ latestResult: result }),
  setRequestedMode: (mode) => set({ requestedMode: mode })
}))
