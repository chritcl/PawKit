import { create } from 'zustand'
import { ClipboardItem } from '../../../shared/types'

// 历史记录变化监听器的取消函数
let unsubscribeHistoryChanged: (() => void) | null = null

// 校验返回值是否为有效数组
function isValidList(value: unknown): value is ClipboardItem[] {
  return Array.isArray(value)
}

// 剪贴板状态接口
interface ClipboardState {
  // 历史记录列表
  list: ClipboardItem[]
  // 搜索关键词
  keyword: string
  // 加载状态
  loading: boolean
  // 是否已初始化
  initialized: boolean
  // 设置列表
  setList: (list: ClipboardItem[]) => void
  // 设置搜索关键词
  setKeyword: (keyword: string) => void
  // 获取过滤后的列表
  getFilteredList: () => ClipboardItem[]
  // 删除单条记录
  removeItem: (id: string) => void
  // 清空列表
  clearList: (keepFavorites?: boolean) => void
  // 切换收藏状态
  toggleFavorite: (id: string) => void
  // 写入剪贴板
  writeText: (text: string) => void
  // 初始化（获取历史 + 监听变化）
  init: () => () => void
  // 销毁（取消监听）
  destroy: () => void
}

// 创建剪贴板状态存储
export const useClipboardStore = create<ClipboardState>((set, get) => ({
  // 默认空列表
  list: [],
  // 默认空搜索
  keyword: '',
  // 默认加载中
  loading: true,
  // 默认未初始化
  initialized: false,

  // 设置列表
  setList: (list) => set({ list, loading: false }),

  // 设置搜索关键词
  setKeyword: (keyword) => set({ keyword }),

  // 获取过滤后的列表
  getFilteredList: () => {
    const { list, keyword } = get()
    const value = keyword.trim().toLowerCase()

    if (!value) return list

    return list.filter((item) => {
      return item.content.toLowerCase().includes(value)
    })
  },

  // 删除单条记录
  removeItem: (id) => {
    window.electronAPI?.clipboard?.removeItem(id).then((newList) => {
      if (isValidList(newList)) {
        set({ list: newList })
      }
    }).catch((err) => {
      console.error('删除剪贴板记录失败:', err)
    })
  },

  // 清空列表
  clearList: (keepFavorites = true) => {
    window.electronAPI?.clipboard?.clearHistory(keepFavorites).then((newList) => {
      if (isValidList(newList)) {
        set({ list: newList })
      }
    }).catch((err) => {
      console.error('清空剪贴板历史失败:', err)
    })
  },

  // 切换收藏状态
  toggleFavorite: (id) => {
    window.electronAPI?.clipboard?.toggleFavorite(id).then((newList) => {
      if (isValidList(newList)) {
        set({ list: newList })
      }
    }).catch((err) => {
      console.error('切换收藏状态失败:', err)
    })
  },

  // 写入剪贴板
  writeText: (text) => {
    window.electronAPI?.clipboard?.writeText(text).then((newList) => {
      if (isValidList(newList)) {
        set({ list: newList })
      }
    }).catch((err) => {
      console.error('写入剪贴板失败:', err)
    })
  },

  // 初始化（防止重复注册监听）
  init: () => {
    if (get().initialized) return () => {}

    const api = window.electronAPI?.clipboard
    if (!api) {
      console.error('electronAPI.clipboard 不可用，preload 可能未正确加载')
      set({ loading: false, initialized: false })
      return () => {}
    }

    let active = true

    // 标记 getHistory 是否已完成（防止通知在初始加载前覆盖列表）
    let historyLoaded = false

    // 监听历史记录变化（先注册，但延迟生效）
    const removeListener = api.onHistoryChanged((history) => {
      if (!active) return
      if (!historyLoaded) return
      if (isValidList(history)) {
        set({ list: history, loading: false })
      }
    })

    unsubscribeHistoryChanged = removeListener

    // 获取历史记录
    api.getHistory().then((history) => {
      if (!active) return
      if (isValidList(history)) {
        set({ list: history, loading: false })
      } else {
        set({ loading: false })
      }
      historyLoaded = true
    }).catch((err) => {
      if (!active) return
      console.error('获取剪贴板历史失败:', err)
      set({ loading: false })
      historyLoaded = true
    })

    set({ initialized: true, loading: true })

    return () => {
      active = false
      removeListener()
      if (unsubscribeHistoryChanged === removeListener) {
        unsubscribeHistoryChanged = null
      }
      set({ initialized: false })
    }
  },

  // 销毁（取消监听，重置状态）
  destroy: () => {
    unsubscribeHistoryChanged?.()
    unsubscribeHistoryChanged = null
    set({ initialized: false })
  }
}))
