import Store from 'electron-store'
import { AppSettings, AppTheme, WindowBounds } from '../shared/types'
import { TOOL_IDS } from '../shared/constants'

// 允许的设置 key 白名单
const ALLOWED_KEYS = [
  'app.theme',
  'app.shortcuts',
  'app.windowBounds',
  'app.enabledTools',
  'management.toolOrder',
  'management.autoUpdate',
  'management.lastCheckUpdateTime',
  'clipboard.history',
  'color.favorites',
  'color.recent'
] as const

type AllowedKey = (typeof ALLOWED_KEYS)[number]

// 默认配置
const defaultSettings: AppSettings = {
  app: {
    theme: 'dark',
    shortcuts: {
      toggleWindow: { accelerator: 'Alt+Space', enabled: true },
      clipboard: { accelerator: 'Alt+V', enabled: true },
      screenshot: { accelerator: 'Alt+A', enabled: true },
      colorPicker: { accelerator: 'Alt+C', enabled: true }
    },
    windowBounds: null,
    enabledTools: [
      TOOL_IDS.CLIPBOARD,
      TOOL_IDS.COLOR_PICKER,
      TOOL_IDS.JSON_TOOL,
      TOOL_IDS.TIMESTAMP_TOOL,
      TOOL_IDS.SCREENSHOT,
      TOOL_IDS.BASE64_TOOL,
      TOOL_IDS.QRCODE
    ]
  },
  management: {
    toolOrder: [TOOL_IDS.CLIPBOARD, TOOL_IDS.COLOR_PICKER, TOOL_IDS.JSON_TOOL, TOOL_IDS.TIMESTAMP_TOOL],
    autoUpdate: false,
    lastCheckUpdateTime: null
  },
  clipboard: {
    history: []
  },
  color: {
    favorites: [],
    recent: []
  }
}

// 创建 store 单例
const store = new Store<AppSettings>({
  defaults: defaultSettings
})

const settingsStore = store as unknown as {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}

// 校验 key 是否在白名单中
function isAllowedKey(key: string): key is AllowedKey {
  return (ALLOWED_KEYS as readonly string[]).includes(key)
}

// 获取配置值
export function getSetting<T = unknown>(key: string): T | null {
  if (!isAllowedKey(key)) {
    console.warn(`尝试读取非白名单设置: ${key}`)
    return null
  }
  return (settingsStore.get(key) as T) ?? null
}

// 设置配置值（带白名单校验）
export function setSetting(key: string, value: unknown): boolean {
  if (!isAllowedKey(key)) {
    console.warn(`尝试写入非白名单设置: ${key}`)
    return false
  }

  // 基本值校验
  if (value === undefined) {
    console.warn(`尝试写入 undefined 值: ${key}`)
    return false
  }

  settingsStore.set(key, value)
  return true
}

// 获取所有配置
export function getAllSettings(): AppSettings {
  return store.store
}

// 重置配置
export function resetSettings(): boolean {
  store.clear()
  return true
}

// 获取主题
export function getTheme(): AppTheme {
  return store.get('app.theme', 'dark') as AppTheme
}

// 设置主题
export function setTheme(theme: AppTheme): void {
  store.set('app.theme', theme)
}

// 获取窗口尺寸
export function getWindowBounds(): WindowBounds | null {
  return store.get('app.windowBounds') as WindowBounds | null
}

// 设置窗口尺寸
export function setWindowBounds(bounds: WindowBounds): void {
  store.set('app.windowBounds', bounds)
}

// 获取启用的工具列表
export function getEnabledTools(): string[] {
  return store.get('app.enabledTools', []) as string[]
}

// 设置启用的工具列表
export function setEnabledTools(tools: string[]): void {
  store.set('app.enabledTools', tools)
}
