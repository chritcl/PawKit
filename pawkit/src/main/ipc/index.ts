import { BrowserWindow } from 'electron'
import { registerAppIpcHandlers } from './app'
import { registerSettingIpcHandlers } from './setting'
import { registerClipboardIpcHandlers } from './clipboard'
import { registerScreenshotIpcHandlers } from './screenshot'
import { registerShortcutIpcHandlers } from './shortcut'

// 注册所有 IPC 处理器
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerAppIpcHandlers(mainWindow)
  registerSettingIpcHandlers()
  registerClipboardIpcHandlers()
  registerScreenshotIpcHandlers()
  registerShortcutIpcHandlers()
}
