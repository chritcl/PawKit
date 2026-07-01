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
import { registerImageToolIpcHandlers } from './image-tool'
import { registerOcrIpcHandlers } from './ocr'

// 注册所有 IPC 处理器
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerAppIpcHandlers(mainWindow)
  registerSettingIpcHandlers()
  registerClipboardIpcHandlers()
  registerScreenshotIpcHandlers()
  registerImageToolIpcHandlers()
  registerOcrIpcHandlers()
  registerGeoIpcHandlers()
  registerStreamProxyIpcHandlers(mainWindow)
  registerHttpApiIpcHandlers()
  registerScreenCaptureIpcHandlers()
  registerPinnedWindowIpcHandlers()
  registerShortcutIpcHandlers()
}
