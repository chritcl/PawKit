import { create } from 'zustand'
import type { AppStartPage, AppTheme, ToolUsageRecord } from '../../../shared/types'
import { DEFAULT_ENABLED_TOOL_IDS, DEFAULT_TOOL_ORDER, TOOL_IDS, type ToolId } from '../../../shared/constants'
import {
  defaultFavoriteTools,
  normalizeManageableTools,
  normalizeToolOrder,
  resolveStartTool,
  updateToolUsage
} from '../utils/tool-preferences'
import { trimQrCodeHistory } from '../utils/qrcode'

const defaultEnabledTools = [...DEFAULT_ENABLED_TOOL_IDS]
const defaultToolOrder = [...DEFAULT_TOOL_ORDER]
const nonUsageTools: ToolId[] = [TOOL_IDS.HOME, TOOL_IDS.MANAGEMENT, TOOL_IDS.SETTINGS]

function shouldRecordToolUsage(tool: ToolId): boolean {
  return !nonUsageTools.includes(tool)
}

function persistSetting(key: string, value: unknown): void {
  if (window.electronAPI?.setting?.set) {
    window.electronAPI.setting.set(key, value).catch(() => {})
  }
}

interface AppState {
  activeTool: ToolId
  theme: AppTheme
  enabledTools: ToolId[]
  toolOrder: ToolId[]
  favoriteTools: ToolId[]
  startPage: AppStartPage
  toolUsage: ToolUsageRecord[]
  qrcodeHistoryLimit: number
  setActiveTool: (tool: ToolId) => void
  setTheme: (theme: AppTheme) => void
  setEnabledTools: (tools: ToolId[]) => void
  setToolOrder: (tools: ToolId[]) => void
  setFavoriteTools: (tools: ToolId[]) => void
  setStartPage: (startPage: AppStartPage) => void
  setQrcodeHistoryLimit: (limit: number) => void
  initSettings: () => Promise<void>
  refreshSettings: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTool: TOOL_IDS.HOME,
  theme: 'dark',
  enabledTools: defaultEnabledTools,
  toolOrder: defaultToolOrder,
  favoriteTools: defaultFavoriteTools,
  startPage: TOOL_IDS.HOME,
  toolUsage: [],
  qrcodeHistoryLimit: 50,
  setActiveTool: (tool) => {
    set({ activeTool: tool })
    if (!shouldRecordToolUsage(tool)) return

    const nextUsage = updateToolUsage(get().toolUsage, tool)

    set({ toolUsage: nextUsage })
    persistSetting('app.toolUsage', nextUsage)
    persistSetting('app.lastActiveTool', tool)
  },
  setTheme: (theme) => {
    set({ theme })
    persistSetting('app.theme', theme)
  },
  setEnabledTools: (tools) => {
    set({ enabledTools: tools })
    persistSetting('app.enabledTools', tools)
  },
  setToolOrder: (tools) => {
    set({ toolOrder: tools })
    persistSetting('management.toolOrder', tools)
  },
  setFavoriteTools: (tools) => {
    set({ favoriteTools: tools })
    persistSetting('management.favoriteTools', tools)
  },
  setStartPage: (startPage) => {
    set({ startPage })
    persistSetting('app.startPage', startPage)
  },
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
  initSettings: async () => {
    await get().refreshSettings()
  },
  refreshSettings: async () => {
    if (!window.electronAPI?.setting?.getAll) return

    try {
      const settings = await window.electronAPI.setting.getAll()
      const appSettings = settings.app ?? {}
      const managementSettings = settings.management ?? {}
      const privacySettings = settings.privacy ?? {}
      const enabledTools = normalizeManageableTools(appSettings.enabledTools ?? defaultEnabledTools)
      const startPage = appSettings.startPage ?? TOOL_IDS.HOME
      const lastActiveTool = appSettings.lastActiveTool ?? TOOL_IDS.HOME
      set({
        theme: appSettings.theme ?? 'dark',
        enabledTools,
        toolOrder: normalizeToolOrder(managementSettings.toolOrder ?? defaultToolOrder),
        favoriteTools: normalizeManageableTools(managementSettings.favoriteTools ?? defaultFavoriteTools),
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
