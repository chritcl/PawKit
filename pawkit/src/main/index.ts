import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { createTray } from './tray'
import { initShortcuts, unregisterAllShortcuts } from './shortcuts'
import { registerIpcHandlers } from './ipc'
import { startClipboardWatch, stopClipboardWatch } from './services/clipboard-service'

// 主窗口实例
let mainWindow: BrowserWindow | null = null

// 应用是否正在退出
let isQuitting = false

// 获取应用是否正在退出
export function getIsQuitting(): boolean {
  return isQuitting
}

// 设置应用正在退出
export function setIsQuitting(value: boolean): void {
  isQuitting = value
}

// 获取主窗口实例
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// 应用准备就绪
app.whenReady().then(() => {
  // 创建主窗口
  mainWindow = createMainWindow()

  // 创建系统托盘
  createTray(mainWindow)

  // 初始化快捷键系统
  initShortcuts(mainWindow)

  // 注册 IPC 处理器
  registerIpcHandlers(mainWindow)

  // 启动剪贴板监听
  startClipboardWatch()

  // macOS 点击 dock 图标时显示窗口
  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })
})

// 所有窗口关闭时
app.on('window-all-closed', () => {
  // macOS 不在所有窗口关闭时退出应用
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前
app.on('before-quit', () => {
  isQuitting = true
  // 注销所有快捷键
  unregisterAllShortcuts()
  // 停止剪贴板监听
  stopClipboardWatch()
})
