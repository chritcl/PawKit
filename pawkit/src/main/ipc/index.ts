import { BrowserWindow } from 'electron'
import { registerAppIpcHandlers } from './app'
import { registerSettingIpcHandlers } from './setting'
import { registerClipboardIpcHandlers } from './clipboard'
import { registerScreenshotIpcHandlers } from './screenshot'
import { registerShortcutIpcHandlers } from './shortcut'
import { registerScreenCaptureIpcHandlers } from './screen-capture'
import { registerPinnedWindowIpcHandlers } from './pinned-window'
import { registerGeoIpcHandlers } from './geo'
import { registerStreamProxyIpcHandlers } from './stream-proxy'
import { registerHttpApiIpcHandlers } from './http-api'

// 注册所有 IPC 处理器
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerAppIpcHandlers(mainWindow)
  registerSettingIpcHandlers()
  registerClipboardIpcHandlers()
  registerScreenshotIpcHandlers()
  registerGeoIpcHandlers()
  registerStreamProxyIpcHandlers(mainWindow)
  registerHttpApiIpcHandlers()
  registerScreenCaptureIpcHandlers()
  registerPinnedWindowIpcHandlers()
  registerShortcutIpcHandlers()
}
