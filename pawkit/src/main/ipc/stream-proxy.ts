import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { StreamProxyStartRequest } from '../../shared/types'
import {
  retryStreamProxySession,
  setStreamProxyMainWindow,
  startStreamProxySession,
  stopStreamProxySession
} from '../services/stream-proxy'
import { validateSender } from './validate-sender'

export function registerStreamProxyIpcHandlers(mainWindow: BrowserWindow): void {
  setStreamProxyMainWindow(mainWindow)

  ipcMain.handle(IPC_CHANNELS.STREAM_PROXY_START, async (event, request: StreamProxyStartRequest) => {
    if (!validateSender(event)) {
      return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    }
    return await startStreamProxySession(request)
  })

  ipcMain.handle(IPC_CHANNELS.STREAM_PROXY_STOP, (event, sessionId: string) => {
    if (!validateSender(event)) {
      return { success: false, message: 'IPC 请求来源无效' }
    }
    return stopStreamProxySession(sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.STREAM_PROXY_RETRY, (event, sessionId: string) => {
    if (!validateSender(event)) {
      return { success: false, message: 'IPC 请求来源无效' }
    }
    return retryStreamProxySession(sessionId)
  })
}
