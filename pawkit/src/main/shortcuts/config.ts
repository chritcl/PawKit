import { ShortcutKey, ShortcutConfigItem } from './types'
import { getSetting, setSetting } from '../store'

// 默认快捷键配置
export const DEFAULT_SHORTCUTS: Record<ShortcutKey, ShortcutConfigItem> = {
  toggleWindow: {
    key: 'toggleWindow',
    label: '显示 / 隐藏主窗口',
    accelerator: 'Alt+Space',
    enabled: true,
    description: '快速显示或隐藏 PawKit 主窗口'
  },
  clipboard: {
    key: 'clipboard',
    label: '打开剪贴板',
    accelerator: 'Alt+V',
    enabled: true,
    description: '打开主窗口并切换到剪贴板页面'
  },
  screenshot: {
    key: 'screenshot',
    label: '截图',
    accelerator: 'Alt+A',
    enabled: true,
    description: '触发截图功能'
  },
  colorPicker: {
    key: 'colorPicker',
    label: '打开调色板',
    accelerator: 'Alt+C',
    enabled: true,
    description: '打开主窗口并切换到调色板页面'
  }
}

// 快捷键存储路径
export const SHORTCUT_STORE_KEY = 'app.shortcuts'

// 读取合并后的快捷键配置
export function getMergedShortcutConfig(): Record<ShortcutKey, ShortcutConfigItem> {
  const saved = getSetting<Record<ShortcutKey, { accelerator: string; enabled: boolean }>>(SHORTCUT_STORE_KEY)

  if (!saved) {
    return { ...DEFAULT_SHORTCUTS }
  }

  // 合并默认配置和用户配置
  const merged: Record<ShortcutKey, ShortcutConfigItem> = {} as Record<ShortcutKey, ShortcutConfigItem>

  for (const key of Object.keys(DEFAULT_SHORTCUTS) as ShortcutKey[]) {
    const defaultItem = DEFAULT_SHORTCUTS[key]
    const savedItem = saved[key]

    if (savedItem) {
      merged[key] = {
        ...defaultItem,
        accelerator: savedItem.accelerator || defaultItem.accelerator,
        enabled: savedItem.enabled !== undefined ? savedItem.enabled : defaultItem.enabled
      }
    } else {
      merged[key] = { ...defaultItem }
    }
  }

  return merged
}

// 保存快捷键配置
export function saveShortcutConfig(config: Record<ShortcutKey, ShortcutConfigItem>): void {
  const toSave: Record<string, { accelerator: string; enabled: boolean }> = {}

  for (const key of Object.keys(config) as ShortcutKey[]) {
    toSave[key] = {
      accelerator: config[key].accelerator,
      enabled: config[key].enabled
    }
  }

  setSetting(SHORTCUT_STORE_KEY, toSave)
}

// 重置快捷键配置为默认值
export function resetShortcutConfig(): void {
  saveShortcutConfig({ ...DEFAULT_SHORTCUTS })
}

// 标准化快捷键格式
export function normalizeAccelerator(accelerator: string): string {
  return accelerator
    .replace(/\s/g, '') // 去除空格
    .replace(/\+/g, '+') // 统一加号
    .split('+')
    .map((part) => {
      // 标准化修饰键
      const lower = part.toLowerCase()
      if (lower === 'ctrl' || lower === 'control') return 'Ctrl'
      if (lower === 'alt') return 'Alt'
      if (lower === 'shift') return 'Shift'
      if (lower === 'meta' || lower === 'cmd' || lower === 'command') return 'Super'
      // 其他键保持原样
      return part
    })
    .join('+')
}
