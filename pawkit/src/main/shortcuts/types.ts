import type {
  ShortcutKey,
  ShortcutRegisterStatus,
  ShortcutSetEnabledPayload,
  ShortcutStatusItem,
  ShortcutUpdatePayload
} from '../../shared/types'

export interface ShortcutConfigItem {
  key: ShortcutKey
  label: string
  accelerator: string
  enabled: boolean
  description: string
}

export type {
  ShortcutKey,
  ShortcutRegisterStatus,
  ShortcutSetEnabledPayload,
  ShortcutStatusItem,
  ShortcutUpdatePayload
}
