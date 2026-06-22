// 应用名称
export const APP_NAME = 'PawKit'

// 应用版本
export const APP_VERSION = '0.0.1'

// 工具 ID
export const TOOL_IDS = {
  HOME: 'home',
  CLIPBOARD: 'clipboard',
  COLOR_PICKER: 'color-picker',
  SCREENSHOT: 'screenshot',
  GEOSPATIAL: 'geospatial',
  JSON_TOOL: 'json-tool',
  TIMESTAMP_TOOL: 'timestamp-tool',
  BASE64_TOOL: 'base64-tool',
  QRCODE: 'qrcode',
  MANAGEMENT: 'management',
  SETTINGS: 'settings'
} as const

// 工具 ID 类型
export type ToolId = (typeof TOOL_IDS)[keyof typeof TOOL_IDS]
