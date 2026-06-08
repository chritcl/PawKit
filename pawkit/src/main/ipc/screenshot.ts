import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { copyImageToClipboard, pickScreenColor, saveImage } from '../screenshot-service'
import { validateSender } from './validate-sender'

// 注册截图相关 IPC 处理器
export function registerScreenshotIpcHandlers(): void {
  // 复制图片到剪贴板
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_COPY_IMAGE_TO_CLIPBOARD, (event, dataUrl: string) => {
    if (!validateSender(event)) return false
    return copyImageToClipboard(dataUrl)
  })

  // 保存图片到本地
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_SAVE_IMAGE, async (event, dataUrl: string) => {
    if (!validateSender(event)) return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    return await saveImage(dataUrl)
  })

  // 全屏滴管取色
  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_PICK_SCREEN_COLOR, async (event) => {
    if (!validateSender(event)) {
      return { status: 'error', message: 'IPC 请求来源无效' }
    }
    try {
      return await pickScreenColor()
    } catch (error) {
      console.error('屏幕取色失败:', error)
      return { status: 'error', message: '屏幕取色失败' }
    }
  })
}
