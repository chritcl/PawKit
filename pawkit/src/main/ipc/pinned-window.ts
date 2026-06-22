import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  PinnedWindowActionRequest,
  PinnedWindowCreateRequest,
  PinnedWindowUpdateRequest
} from '../../shared/types'
import {
  createPinnedWindow,
  handlePinnedWindowAction,
  handlePinnedWindowClose,
  handlePinnedWindowReady,
  handlePinnedWindowUpdate
} from '../screen-capture/pinned-manager'
import { validateSender } from './validate-sender'

// 注册截图置顶窗口 IPC
export function registerPinnedWindowIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PINNED_WINDOW_CREATE,
    async (event, request: PinnedWindowCreateRequest) => {
      if (!validateSender(event)) {
        return { status: 'error', message: 'IPC 请求来源无效' }
      }
      return await createPinnedWindow(request)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PINNED_WINDOW_UPDATE,
    (event, request: PinnedWindowUpdateRequest) => handlePinnedWindowUpdate(event, request)
  )

  ipcMain.handle(
    IPC_CHANNELS.PINNED_WINDOW_ACTION,
    async (event, request: PinnedWindowActionRequest) => await handlePinnedWindowAction(event, request)
  )

  // 置顶窗口通道通过窗口 WebContents 关联校验发送方
  ipcMain.on(IPC_CHANNELS.PINNED_WINDOW_READY, handlePinnedWindowReady)
  ipcMain.on(IPC_CHANNELS.PINNED_WINDOW_CLOSE, handlePinnedWindowClose)
}
