import { ToolId } from './constants'
import { LucideIcon } from 'lucide-react'

// 工具元数据
export interface ToolMeta {
  id: ToolId
  name: string
  icon: LucideIcon
  description: string
}

// 应用主题
export type AppTheme = 'light' | 'dark'

// 剪贴板基础项
export interface ClipboardBaseItem {
  id: string
  type: 'text' | 'image' | 'file' | 'richText'
  content: string
  favorite: boolean
  createdAt: string
  updatedAt: string
  signature?: string
  formats?: string[]
}

// 文本剪贴板项
export interface ClipboardTextItem extends ClipboardBaseItem {
  type: 'text'
}

// 图片剪贴板项
export interface ClipboardImageItem extends ClipboardBaseItem {
  type: 'image'
  imagePath: string
  thumbnailDataUrl: string
  width: number
  height: number
  size: number
  originalSize?: number
  originalTooLarge?: boolean
}

// 文件剪贴板项
export interface ClipboardFileEntry {
  path: string
  name: string
  exists: boolean
}

// 文件剪贴板项
export interface ClipboardFileItem extends ClipboardBaseItem {
  type: 'file'
  files: ClipboardFileEntry[]
}

// 富文本剪贴板项
export interface ClipboardRichTextItem extends ClipboardBaseItem {
  type: 'richText'
  html?: string
  rtf?: string
}

// 剪贴板项
export type ClipboardItem =
  | ClipboardTextItem
  | ClipboardImageItem
  | ClipboardFileItem
  | ClipboardRichTextItem

// 剪贴板复制结果
export interface ClipboardCopyResult {
  success: boolean
  history: ClipboardItem[]
  fallback?: boolean
  message?: string
}

// 剪贴板存储结构
export interface ClipboardStoreSchema {
  clipboard: {
    history: ClipboardItem[]
  }
}

// 颜色 RGB
export interface RGB {
  r: number
  g: number
  b: number
}

// 颜色 HSL
export interface HSL {
  h: number
  s: number
  l: number
}

// 颜色记录
export interface ColorRecord {
  hex: string
  rgb: RGB
  hsl: HSL
  createdAt: string
  name?: string
  tags?: string[]
  source?: 'manual' | 'screen' | 'recent' | 'favorite'
}

// 管理配置
export interface ManagementSettings {
  toolOrder: string[]
  autoUpdate: boolean
  lastCheckUpdateTime: string | null
}

// 应用配置
export interface AppSettings {
  app: {
    theme: AppTheme
    shortcuts: Record<string, { accelerator: string; enabled: boolean }>
    windowBounds: { x: number; y: number; width: number; height: number } | null
    enabledTools: string[]
  }
  management: ManagementSettings
  clipboard: {
    history: ClipboardItem[]
  }
  color: {
    favorites: ColorRecord[]
    recent: ColorRecord[]
  }
}

// 窗口尺寸
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

// 截图结果
export interface ScreenshotResult {
  dataUrl: string
  width: number
  height: number
  createdAt: string
}

// 屏幕取色图片源
export interface ScreenColorPickerSource {
  displayId: string
  dataUrl: string
  bounds: WindowBounds
  scaleFactor: number
  width: number
  height: number
}

// 屏幕取色覆盖层数据
export interface ScreenColorPickerPayload {
  sources: ScreenColorPickerSource[]
  virtualBounds: WindowBounds
}

// 屏幕取色结果
export interface ScreenColorPickResult {
  hex: string
  rgb: RGB
  point: { x: number; y: number }
  displayId: string
  createdAt: string
}

// 屏幕取色状态
export type ScreenColorPickStatus =
  | 'picked'
  | 'cancelled'
  | 'no-source'
  | 'load-failed'
  | 'timeout'
  | 'busy'
  | 'error'

// 屏幕取色响应
export interface ScreenColorPickResponse {
  status: ScreenColorPickStatus
  message: string
  result?: ScreenColorPickResult
}

// 快捷键标识
export type ShortcutKey =
  | 'toggleWindow'
  | 'clipboard'
  | 'screenshot'
  | 'colorPicker'

// 快捷键注册状态
export type ShortcutRegisterStatus =
  | 'registered'
  | 'failed'
  | 'disabled'
  | 'conflict'
  | 'invalid'

// 快捷键状态项
export interface ShortcutStatusItem {
  key: ShortcutKey
  label: string
  accelerator: string
  enabled: boolean
  registered: boolean
  status: ShortcutRegisterStatus
  description: string
  errorMessage?: string
}

// 快捷键更新请求
export interface ShortcutUpdatePayload {
  key: ShortcutKey
  accelerator: string
  enabled: boolean
}

// 快捷键启用/禁用请求
export interface ShortcutSetEnabledPayload {
  key: ShortcutKey
  enabled: boolean
}

// Electron API 接口
export interface ElectronAPI {
  app: {
    showWindow: () => Promise<void>
    hideWindow: () => Promise<void>
    minimizeWindow: () => Promise<void>
    toggleMaximizeWindow: () => Promise<void>
    toggleWindow: () => Promise<void>
    quit: () => Promise<void>
  }
  setting: {
    get: <T = unknown>(key: string) => Promise<T | null>
    set: (key: string, value: unknown) => Promise<boolean>
    getAll: () => Promise<AppSettings>
    reset: () => Promise<boolean>
  }
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<ClipboardItem[]>
    getHistory: () => Promise<ClipboardItem[]>
    clearHistory: (keepFavorites?: boolean) => Promise<ClipboardItem[]>
    removeItem: (id: string) => Promise<ClipboardItem[]>
    toggleFavorite: (id: string) => Promise<ClipboardItem[]>
    copyItem: (id: string) => Promise<ClipboardCopyResult>
    onHistoryChanged: (callback: (history: ClipboardItem[]) => void) => () => void
  }
  screenshot: {
    captureFullScreen: () => Promise<ScreenshotResult>
    copyImageToClipboard: (dataUrl: string) => Promise<boolean>
    saveImage: (dataUrl: string) => Promise<{ success: boolean; path?: string }>
    pickScreenColor: () => Promise<ScreenColorPickResponse>
    colorPickerReady: () => void
    finishColorPick: (result: ScreenColorPickResult) => void
    cancelColorPick: () => void
    onColorPickerData: (callback: (payload: ScreenColorPickerPayload) => void) => () => void
  }
  shortcut: {
    getStatus: () => Promise<ShortcutStatusItem[]>
    update: (payload: ShortcutUpdatePayload) => Promise<ShortcutStatusItem[]>
    reset: () => Promise<ShortcutStatusItem[]>
    setEnabled: (payload: ShortcutSetEnabledPayload) => Promise<ShortcutStatusItem[]>
    onNavigate: (callback: (data: { page: string }) => void) => () => void
  }
}
