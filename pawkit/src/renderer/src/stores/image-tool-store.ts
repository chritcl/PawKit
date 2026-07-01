import { create } from 'zustand'
import type { ImageToolResultRef, ImageToolSourceRef } from '../../../shared/types'

interface ImageToolState {
  sources: ImageToolSourceRef[]
  selectedSourceId: string | null
  latestResult: ImageToolResultRef | null
  addSources: (sources: ImageToolSourceRef[]) => void
  selectSource: (sourceId: string | null) => void
  removeSource: (sourceId: string) => void
  setLatestResult: (result: ImageToolResultRef | null) => void
}

// 图片处理工作台状态
export const useImageToolStore = create<ImageToolState>((set, get) => ({
  sources: [],
  selectedSourceId: null,
  latestResult: null,
  addSources: (sources) => {
    if (sources.length === 0) return
    const current = get().sources
    const next = [
      ...sources,
      ...current.filter((item) => !sources.some((source) => source.id === item.id))
    ]
    set({
      sources: next,
      selectedSourceId: sources[0].id,
      latestResult: null
    })
  },
  selectSource: (sourceId) => set({ selectedSourceId: sourceId, latestResult: null }),
  removeSource: (sourceId) => {
    const next = get().sources.filter((item) => item.id !== sourceId)
    const selected = get().selectedSourceId === sourceId ? next[0]?.id ?? null : get().selectedSourceId
    set({ sources: next, selectedSourceId: selected, latestResult: null })
  },
  setLatestResult: (result) => set({ latestResult: result })
}))

