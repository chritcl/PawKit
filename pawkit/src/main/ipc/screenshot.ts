import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { captureFullScreen, copyImageToClipboard, saveImage } from '../screenshot-service'
import { validateSender } from './validate-sender'

// 注册截图相关 IPC 处理器
export function registerScreenshotIpcHandlers(): void {
  // 全屏截图
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_CAPTURE_FULL_SCREEN, async (event) => {
    if (!validateSender(event)) return null
    try {
      return await captureFullScreen()
    } catch (error) {
      console.error('截图失败:', error)
      return null
    }
  })

  // 复制图片到剪贴板
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_COPY_IMAGE_TO_CLIPBOARD, (event, dataUrl: string) => {
    if (!validateSender(event)) return false
    return copyImageToClipboard(dataUrl)
  })

  // 保存图片到本地
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_SAVE_IMAGE, async (event, dataUrl: string) => {
    if (!validateSender(event)) return { success: false }
    return await saveImage(dataUrl)
  })
}
