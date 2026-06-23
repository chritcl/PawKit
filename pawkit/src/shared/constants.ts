export const APP_NAME = 'PawKit'

export const APP_VERSION = '0.0.1'

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

export type ToolId = (typeof TOOL_IDS)[keyof typeof TOOL_IDS]

export const ALWAYS_VISIBLE_TOOL_IDS = [
  TOOL_IDS.HOME,
  TOOL_IDS.MANAGEMENT,
  TOOL_IDS.SETTINGS
] as const satisfies readonly ToolId[]

export const MANAGEABLE_TOOL_IDS = [
  TOOL_IDS.CLIPBOARD,
  TOOL_IDS.COLOR_PICKER,
  TOOL_IDS.JSON_TOOL,
  TOOL_IDS.TIMESTAMP_TOOL,
  TOOL_IDS.SCREENSHOT,
  TOOL_IDS.BASE64_TOOL,
  TOOL_IDS.QRCODE,
  TOOL_IDS.GEOSPATIAL
] as const satisfies readonly ToolId[]

export const DEFAULT_ENABLED_TOOL_IDS = [...MANAGEABLE_TOOL_IDS]

export const DEFAULT_TOOL_ORDER = [...MANAGEABLE_TOOL_IDS]

export const DEFAULT_FAVORITE_TOOL_IDS = [
  TOOL_IDS.CLIPBOARD,
  TOOL_IDS.JSON_TOOL,
  TOOL_IDS.SCREENSHOT
] as const satisfies readonly ToolId[]

const toolIdSet = new Set<string>(Object.values(TOOL_IDS))

export function isToolId(value: string): value is ToolId {
  return toolIdSet.has(value)
}
