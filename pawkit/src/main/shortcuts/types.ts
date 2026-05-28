// 快捷键类型定义

// 快捷键标识
export type ShortcutKey =
  | 'toggleWindow'
  | 'clipboard'
  | 'screenshot'
  | 'colorPicker'

// 快捷键配置项
export interface ShortcutConfigItem {
  key: ShortcutKey
  label: string
  accelerator: string
  enabled: boolean
  description: string
}

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
