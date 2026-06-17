import { create } from 'zustand'
import { AppStartPage, AppTheme, ToolUsageRecord } from '../../../shared/types'
import { TOOL_IDS, ToolId } from '../../../shared/constants'
import { manageableToolIds, defaultFavoriteTools, resolveStartTool, updateToolUsage } from '../utils/tool-preferences'
import { trimQrCodeHistory } from '../utils/qrcode'

const defaultEnabledTools = manageableToolIds
const defaultToolOrder = [...manageableToolIds]
const nonUsageTools: ToolId[] = [TOOL_IDS.HOME, TOOL_IDS.MANAGEMENT, TOOL_IDS.SETTINGS]

function shouldRecordToolUsage(tool: ToolId): boolean {
  return !nonUsageTools.includes(tool)
}

function persistSetting(key: string, value: unknown): void {
  if (window.electronAPI?.setting?.set) {
    window.electronAPI.setting.set(key, value).catch(() => {})
  }
}

// 应用状态接口
interface AppState {
  // 当前激活的工具
  activeTool: ToolId
  // 当前主题
  theme: AppTheme
  // 启用的工具列表
  enabledTools: string[]
  // 工具排序
  toolOrder: string[]
  // 首页常用工具
  favoriteTools: string[]
  // 启动页策略
  startPage: AppStartPage
  // 最近工具使用
  toolUsage: ToolUsageRecord[]
  // 二维码历史保留数量
  qrcodeHistoryLimit: number
  // 设置激活的工具
  setActiveTool: (tool: ToolId) => void
  // 设置主题
  setTheme: (theme: AppTheme) => void
  // 设置启用的工具列表
  setEnabledTools: (tools: string[]) => void
  // 设置工具排序
  setToolOrder: (tools: string[]) => void
  // 设置首页常用工具
  setFavoriteTools: (tools: string[]) => void
  // 设置启动页
  setStartPage: (startPage: AppStartPage) => void
  // 设置二维码历史保留数量
  setQrcodeHistoryLimit: (limit: number) => void
  // 初始化设置
  initSettings: () => Promise<void>
  // 刷新设置
  refreshSettings: () => Promise<void>
}

// 创建应用状态存储
export const useAppStore = create<AppState>((set, get) => ({
  // 默认激活首页
  activeTool: TOOL_IDS.HOME,
  // 默认暗色主题
  theme: 'dark',
  // 默认启用的工具
  enabledTools: defaultEnabledTools,
  // 默认工具排序
  toolOrder: defaultToolOrder,
  // 默认首页常用工具
  favoriteTools: defaultFavoriteTools,
  // 默认启动首页
  startPage: TOOL_IDS.HOME,
  // 默认没有使用记录
  toolUsage: [],
  // 默认二维码历史保留数量
  qrcodeHistoryLimit: 50,
  // 设置激活的工具
  setActiveTool: (tool) => {
    set({ activeTool: tool })
    if (!shouldRecordToolUsage(tool)) return

    const nextUsage = updateToolUsage(get().toolUsage, tool)

    set({ toolUsage: nextUsage })
    persistSetting('app.toolUsage', nextUsage)
    persistSetting('app.lastActiveTool', tool)
  },
  // 设置主题（同时保存到本地存储）
  setTheme: (theme) => {
    set({ theme })
    persistSetting('app.theme', theme)
  },
  // 设置启用的工具列表（同时保存到本地存储）
  setEnabledTools: (tools) => {
    set({ enabledTools: tools })
    persistSetting('app.enabledTools', tools)
  },
  // 设置工具排序
  setToolOrder: (tools) => {
    set({ toolOrder: tools })
    persistSetting('management.toolOrder', tools)
  },
  // 设置首页常用工具
  setFavoriteTools: (tools) => {
    set({ favoriteTools: tools })
    persistSetting('management.favoriteTools', tools)
  },
  // 设置启动页
  setStartPage: (startPage) => {
    set({ startPage })
    persistSetting('app.startPage', startPage)
  },
  // 设置二维码历史保留数量
  setQrcodeHistoryLimit: (limit) => {
    const safeLimit = Math.max(0, Math.min(200, Math.round(limit)))
    set({ qrcodeHistoryLimit: safeLimit })
    persistSetting('privacy.qrcodeHistoryLimit', safeLimit)
    window.electronAPI?.setting?.get('qrcode.history').then((history) => {
      if (Array.isArray(history)) {
        persistSetting('qrcode.history', trimQrCodeHistory(history, safeLimit))
      }
    }).catch(() => {})
  },
  // 初始化设置（从本地存储读取）
  initSettings: async () => {
    await get().refreshSettings()
  },
  // 刷新设置
  refreshSettings: async () => {
    if (!window.electronAPI?.setting?.getAll) return

    try {
      const settings = await window.electronAPI.setting.getAll()
      const appSettings = settings.app ?? {}
      const managementSettings = settings.management ?? {}
      const privacySettings = settings.privacy ?? {}
      const enabledTools = appSettings.enabledTools ?? defaultEnabledTools
      const startPage = appSettings.startPage ?? TOOL_IDS.HOME
      const lastActiveTool = appSettings.lastActiveTool ?? TOOL_IDS.HOME
      set({
        theme: appSettings.theme ?? 'dark',
        enabledTools,
        toolOrder: managementSettings.toolOrder ?? defaultToolOrder,
        favoriteTools: managementSettings.favoriteTools ?? defaultFavoriteTools,
        startPage,
        toolUsage: appSettings.toolUsage ?? [],
        qrcodeHistoryLimit: privacySettings.qrcodeHistoryLimit ?? 50,
        activeTool: resolveStartTool(startPage, lastActiveTool, enabledTools)
      })
    } catch (error) {
      console.warn('刷新设置失败:', error)
    }
  }
}))
