import { create } from 'zustand'
import { AppTheme } from '../../../shared/types'
import { TOOL_IDS, ToolId } from '../../../shared/constants'

// 应用状态接口
interface AppState {
  // 当前激活的工具
  activeTool: ToolId
  // 当前主题
  theme: AppTheme
  // 启用的工具列表
  enabledTools: string[]
  // 设置激活的工具
  setActiveTool: (tool: ToolId) => void
  // 设置主题
  setTheme: (theme: AppTheme) => void
  // 设置启用的工具列表
  setEnabledTools: (tools: string[]) => void
  // 初始化设置
  initSettings: () => Promise<void>
}

// 创建应用状态存储
export const useAppStore = create<AppState>((set) => ({
  // 默认激活首页
  activeTool: TOOL_IDS.HOME,
  // 默认暗色主题
  theme: 'dark',
  // 默认启用的工具
  enabledTools: [TOOL_IDS.CLIPBOARD, TOOL_IDS.COLOR_PICKER, TOOL_IDS.JSON_TOOL, TOOL_IDS.TIMESTAMP_TOOL, TOOL_IDS.SCREENSHOT, TOOL_IDS.BASE64_TOOL, TOOL_IDS.QRCODE],
  // 设置激活的工具
  setActiveTool: (tool) => set({ activeTool: tool }),
  // 设置主题（同时保存到本地存储）
  setTheme: (theme) => {
    set({ theme })
    if (window.electronAPI?.setting?.set) {
      window.electronAPI.setting.set('app.theme', theme).catch(() => {})
    }
  },
  // 设置启用的工具列表（同时保存到本地存储）
  setEnabledTools: (tools) => {
    set({ enabledTools: tools })
    if (window.electronAPI?.setting?.set) {
      window.electronAPI.setting.set('app.enabledTools', tools).catch(() => {})
    }
  },
  // 初始化设置（从本地存储读取）
  initSettings: async () => {
    if (!window.electronAPI?.setting?.get) {
      return
    }

    try {
      const theme = await window.electronAPI.setting.get<AppTheme>('app.theme')
      const enabledTools = await window.electronAPI.setting.get<string[]>('app.enabledTools')

      if (theme) {
        set({ theme })
      }
      if (enabledTools) {
        set({ enabledTools })
      }
    } catch {
      // 忽略初始化错误
    }
  }
}))
