import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { exportConfig, getSetting, setSetting, getAllSettings, resetSettings } from '../store'
import { validateSender } from './validate-sender'

// 注册设置相关 IPC 处理器
export function registerSettingIpcHandlers(): void {
  // 获取设置值
  ipcMain.handle(IPC_CHANNELS.SETTING_GET, (event, key: string) => {
    if (!validateSender(event)) return null
    return getSetting(key)
  })

  // 设置值
  ipcMain.handle(IPC_CHANNELS.SETTING_SET, (event, key: string, value: unknown) => {
    if (!validateSender(event)) return false
    return setSetting(key, value)
  })

  // 获取所有设置
  ipcMain.handle(IPC_CHANNELS.SETTING_GET_ALL, (event) => {
    if (!validateSender(event)) return null
    return getAllSettings()
  })

  // 重置设置
  ipcMain.handle(IPC_CHANNELS.SETTING_RESET, (event) => {
    if (!validateSender(event)) return false
    return resetSettings()
  })

  // 导出配置
  ipcMain.handle(IPC_CHANNELS.SETTING_EXPORT_CONFIG, async (event) => {
    if (!validateSender(event)) return { success: false, message: 'IPC 请求来源无效' }
    return await exportConfig(BrowserWindow.fromWebContents(event.sender))
  })
}
