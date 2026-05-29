import { BrowserWindow, ipcMain, app } from 'electron'
import {
  showWindow,
  hideWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  toggleWindow
} from '../window'
import { setIsQuitting } from '../index'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { validateSender } from './validate-sender'

// 注册应用相关 IPC 处理器
export function registerAppIpcHandlers(mainWindow: BrowserWindow): void {
  // 显示窗口
  ipcMain.handle(IPC_CHANNELS.APP_SHOW_WINDOW, (event) => {
    if (!validateSender(event)) return
    showWindow(mainWindow)
  })

  // 隐藏窗口
  ipcMain.handle(IPC_CHANNELS.APP_HIDE_WINDOW, (event) => {
    if (!validateSender(event)) return
    hideWindow(mainWindow)
  })

  // 最小化窗口
  ipcMain.handle(IPC_CHANNELS.APP_MINIMIZE_WINDOW, (event) => {
    if (!validateSender(event)) return
    minimizeWindow(mainWindow)
  })

  // 最大化或还原窗口
  ipcMain.handle(IPC_CHANNELS.APP_TOGGLE_MAXIMIZE_WINDOW, (event) => {
    if (!validateSender(event)) return
    toggleMaximizeWindow(mainWindow)
  })

  // 切换窗口显示/隐藏
  ipcMain.handle(IPC_CHANNELS.APP_TOGGLE_WINDOW, (event) => {
    if (!validateSender(event)) return
    toggleWindow(mainWindow)
  })

  // 退出应用
  ipcMain.handle(IPC_CHANNELS.APP_QUIT, (event) => {
    if (!validateSender(event)) return
    setIsQuitting(true)
    app.quit()
  })
}
