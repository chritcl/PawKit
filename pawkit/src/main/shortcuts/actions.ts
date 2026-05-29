import { BrowserWindow } from 'electron'
import { ShortcutKey } from './types'
import { showWindow, toggleWindow } from '../window'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { startScreenshotCapture } from '../screenshot-service'

// 主窗口引用
let mainWindowRef: BrowserWindow | null = null

// 设置主窗口引用
export function setMainWindowForShortcuts(window: BrowserWindow): void {
  mainWindowRef = window
}

// 发送导航事件到渲染进程
function sendNavigateToRenderer(page: string): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(IPC_CHANNELS.SHORTCUT_NAVIGATE, { page })
  }
}

// 处理快捷键触发行为
export function handleShortcutAction(key: ShortcutKey): void {
  switch (key) {
    case 'toggleWindow':
      if (mainWindowRef) {
        toggleWindow(mainWindowRef)
      }
      break

    case 'clipboard':
      if (mainWindowRef) {
        showWindow(mainWindowRef)
        sendNavigateToRenderer('clipboard')
      }
      break

    case 'screenshot':
      if (mainWindowRef) {
        void startScreenshotCapture(mainWindowRef).then((response) => {
          if (!mainWindowRef || mainWindowRef.isDestroyed()) return
          if (response.status === 'captured') {
            showWindow(mainWindowRef)
            sendNavigateToRenderer('screenshot')
            mainWindowRef.webContents.send(IPC_CHANNELS.SCREENSHOT_CAPTURE_RESULT, response)
          }
        })
      }
      break

    case 'colorPicker':
      if (mainWindowRef) {
        showWindow(mainWindowRef)
        sendNavigateToRenderer('color-picker')
      }
      break
  }
}
