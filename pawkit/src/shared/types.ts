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

// 应用启动页策略
export type AppStartPage = 'home' | 'last' | ToolId

// 工具使用记录
export interface ToolUsageRecord {
  toolId: ToolId
  count: number
  lastUsedAt: string
}

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

// 剪贴板删除结果
export interface ClipboardRemoveResult {
  success: boolean
  history: ClipboardItem[]
  undoToken?: string
  message: string
}

// 剪贴板安全动作结果
export interface ClipboardActionResult {
  success: boolean
  message: string
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
  alpha?: number
  createdAt: string
  updatedAt?: string
  name?: string
  tags?: string[]
  source?: 'manual' | 'screen' | 'recent' | 'favorite'
}

// 管理配置
export interface ManagementSettings {
  toolOrder: string[]
  favoriteTools: string[]
  autoUpdate: boolean
  lastCheckUpdateTime: string | null
}

// 二维码模板类型
export type QrCodeTemplateType = 'text' | 'url' | 'wifi' | 'vcard'

// 二维码纠错级别
export type QrCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

// 二维码最近动作
export type QrCodeLastAction = 'copied' | 'saved' | 'edited'

// 二维码样式配置
export interface QrCodeStyleSettings {
  size: number
  margin: number
  darkColor: string
  lightColor: string
  errorCorrectionLevel: QrCodeErrorCorrectionLevel
  preset?: string
}

// 二维码历史项
export interface QrCodeHistoryItem {
  id: string
  template: QrCodeTemplateType
  title: string
  payload: string
  fields: Record<string, string>
  style: QrCodeStyleSettings
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastAction?: QrCodeLastAction
}

// 应用配置
export interface AppSettings {
  app: {
    theme: AppTheme
    shortcuts: Record<string, { accelerator: string; enabled: boolean }>
    windowBounds: { x: number; y: number; width: number; height: number } | null
    enabledTools: string[]
    startPage: AppStartPage
    lastActiveTool: ToolId
    toolUsage: ToolUsageRecord[]
  }
  management: ManagementSettings
  clipboard: {
    history: ClipboardItem[]
  }
  color: {
    favorites: ColorRecord[]
    recent: ColorRecord[]
  }
  qrcode: {
    history: QrCodeHistoryItem[]
  }
  screenshot: {
    preferences: ScreenshotPreferences
  }
  privacy: {
    qrcodeHistoryLimit: number
  }
}

// 窗口尺寸
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

// 截图默认设置
export interface ScreenshotPreferences {
  annotationColor: string
  strokeWidth: number
}

// 截图会话启动状态
export type ScreenCaptureStartStatus =
  | 'started'
  | 'busy'
  | 'no-source'
  | 'error'

// 截图会话启动响应
export interface ScreenCaptureStartResponse {
  status: ScreenCaptureStartStatus
  message: string
  sessionId?: string
}

// 单个显示器的截图覆盖层数据
export interface ScreenCaptureDisplayPayload {
  sessionId: string
  displayId: string
  dataUrl: string
  bounds: WindowBounds
  scaleFactor: number
  width: number
  height: number
  preferences: ScreenshotPreferences
}

// 截图覆盖层会话状态
export interface ScreenCaptureSessionState {
  sessionId: string
  displayId: string
  status: 'idle' | 'active' | 'locked' | 'closed'
  activeDisplayId: string | null
}

// 截图输出动作
export interface ScreenCaptureActionRequest {
  action: 'copy' | 'complete' | 'save'
  dataUrl: string
  width: number
  height: number
  displayId: string
}

// 截图输出动作响应
export interface ScreenCaptureActionResponse {
  status: 'copied' | 'saved' | 'cancelled' | 'error'
  message: string
  path?: string
}

// 图片保存状态
export type ImageSaveStatus = 'saved' | 'cancelled' | 'error'

// 图片保存结果
export interface ImageSaveResult {
  success: boolean
  status: ImageSaveStatus
  path?: string
  message?: string
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
    exportConfig: () => Promise<{ success: boolean; path?: string; message: string }>
  }
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<ClipboardItem[]>
    getHistory: () => Promise<ClipboardItem[]>
    clearHistory: (keepFavorites?: boolean) => Promise<ClipboardItem[]>
    removeItem: (id: string) => Promise<ClipboardRemoveResult>
    restoreItem: (undoToken: string) => Promise<ClipboardRemoveResult>
    toggleFavorite: (id: string) => Promise<ClipboardItem[]>
    copyItem: (id: string) => Promise<ClipboardCopyResult>
    copyItemText: (id: string) => Promise<ClipboardCopyResult>
    openLink: (id: string) => Promise<ClipboardActionResult>
    showFile: (id: string, path: string) => Promise<ClipboardActionResult>
    saveImage: (id: string) => Promise<ImageSaveResult>
    getImageData: (id: string) => Promise<string | null>
    onHistoryChanged: (callback: (history: ClipboardItem[]) => void) => () => void
  }
  screenshot: {
    copyImageToClipboard: (dataUrl: string) => Promise<boolean>
    saveImage: (dataUrl: string) => Promise<ImageSaveResult>
    pickScreenColor: () => Promise<ScreenColorPickResponse>
    colorPickerReady: () => void
    finishColorPick: (result: ScreenColorPickResult) => void
    cancelColorPick: () => void
    onColorPickerData: (callback: (payload: ScreenColorPickerPayload) => void) => () => void
  }
  screenCapture: {
    start: () => Promise<ScreenCaptureStartResponse>
    overlayReady: () => void
    claim: () => void
    performAction: (request: ScreenCaptureActionRequest) => Promise<ScreenCaptureActionResponse>
    cancel: () => void
    onPayload: (callback: (payload: ScreenCaptureDisplayPayload) => void) => () => void
    onSessionState: (callback: (state: ScreenCaptureSessionState) => void) => () => void
  }
  shortcut: {
    getStatus: () => Promise<ShortcutStatusItem[]>
    update: (payload: ShortcutUpdatePayload) => Promise<ShortcutStatusItem[]>
    reset: () => Promise<ShortcutStatusItem[]>
    setEnabled: (payload: ShortcutSetEnabledPayload) => Promise<ShortcutStatusItem[]>
    onNavigate: (callback: (data: { page: string }) => void) => () => void
  }
}
