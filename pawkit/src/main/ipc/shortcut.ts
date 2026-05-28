import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  getShortcutStatusList,
  updateShortcut,
  updateShortcutEnabled,
  resetAllShortcuts
} from '../shortcuts'
import type { ShortcutUpdatePayload, ShortcutSetEnabledPayload } from '../shortcuts'
import { validateSender } from './validate-sender'

// 注册快捷键相关 IPC 处理器
export function registerShortcutIpcHandlers(): void {
  // 查询快捷键状态
  ipcMain.handle(IPC_CHANNELS.SHORTCUT_GET_STATUS, (event) => {
    if (!validateSender(event)) return []
    return getShortcutStatusList()
  })

  // 修改快捷键
  ipcMain.handle(IPC_CHANNELS.SHORTCUT_UPDATE, (event, payload: ShortcutUpdatePayload) => {
    if (!validateSender(event)) return []
    return updateShortcut(payload.key, payload.accelerator, payload.enabled)
  })

  // 重置快捷键为默认值
  ipcMain.handle(IPC_CHANNELS.SHORTCUT_RESET, (event) => {
    if (!validateSender(event)) return []
    return resetAllShortcuts()
  })

  // 启用/禁用快捷键
  ipcMain.handle(IPC_CHANNELS.SHORTCUT_SET_ENABLED, (event, payload: ShortcutSetEnabledPayload) => {
    if (!validateSender(event)) return []
    return updateShortcutEnabled(payload.key, payload.enabled)
  })
}
