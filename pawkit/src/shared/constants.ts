// 应用名称
export const APP_NAME = 'PawKit'

// 应用版本
export const APP_VERSION = '0.0.1'

// 默认窗口尺寸
export const DEFAULT_WINDOW_WIDTH = 960
export const DEFAULT_WINDOW_HEIGHT = 680
export const MIN_WINDOW_WIDTH = 800
export const MIN_WINDOW_HEIGHT = 560

// 默认快捷键
export const DEFAULT_SHORTCUTS = {
  toggleWindow: 'Alt+Space',
  clipboard: 'Alt+V',
  screenshot: 'Alt+A',
  colorPicker: 'Alt+C'
} as const

// 工具 ID
export const TOOL_IDS = {
  HOME: 'home',
  CLIPBOARD: 'clipboard',
  COLOR_PICKER: 'color-picker',
  SCREENSHOT: 'screenshot',
  JSON_TOOL: 'json-tool',
  TIMESTAMP_TOOL: 'timestamp-tool',
  BASE64_TOOL: 'base64-tool',
  QRCODE: 'qrcode',
  MANAGEMENT: 'management',
  SETTINGS: 'settings'
} as const

// 工具 ID 类型
export type ToolId = (typeof TOOL_IDS)[keyof typeof TOOL_IDS]
