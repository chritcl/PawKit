import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { ScreenCaptureActionRequest } from '../../shared/types'
import {
  handleScreenCaptureAction,
  handleScreenCaptureCancel,
  handleScreenCaptureClaim,
  handleScreenCaptureOverlayReady,
  startScreenCapture
} from '../screen-capture/session-manager'
import { validateSender } from './validate-sender'

// 注册全新截图会话 IPC
export function registerScreenCaptureIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SCREEN_CAPTURE_START, async (event) => {
    if (!validateSender(event)) {
      return { status: 'error', message: 'IPC 请求来源无效' }
    }
    return await startScreenCapture(BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(
    IPC_CHANNELS.SCREEN_CAPTURE_ACTION,
    async (event, request: ScreenCaptureActionRequest) => {
      if (!validateSender(event)) {
        return { status: 'error', message: 'IPC 请求来源无效' }
      }
      return await handleScreenCaptureAction(event, request)
    }
  )

  ipcMain.on(IPC_CHANNELS.SCREEN_CAPTURE_OVERLAY_READY, handleScreenCaptureOverlayReady)
  ipcMain.on(IPC_CHANNELS.SCREEN_CAPTURE_CLAIM, handleScreenCaptureClaim)
  ipcMain.on(IPC_CHANNELS.SCREEN_CAPTURE_CANCEL, handleScreenCaptureCancel)
}
