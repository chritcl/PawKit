import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { HttpApiSendRequest } from '../../shared/types'
import { cancelHttpApiRequest, sendHttpApiRequest } from '../services/http-api'
import { validateSender } from './validate-sender'

// 注册 HTTP API 调试相关 IPC 处理器
export function registerHttpApiIpcHandlers(): void {
  // 发送 HTTP 请求
  ipcMain.handle(IPC_CHANNELS.HTTP_API_SEND, async (event, request: HttpApiSendRequest) => {
    if (!validateSender(event)) {
      return {
        success: false,
        status: 'error',
        message: 'IPC 请求来源无效',
        requestId: request?.requestId ?? ''
      }
    }
    return await sendHttpApiRequest(request)
  })

  // 取消正在执行的 HTTP 请求
  ipcMain.handle(IPC_CHANNELS.HTTP_API_CANCEL, (event, requestId: string) => {
    if (!validateSender(event)) {
      return { success: false, message: 'IPC 请求来源无效' }
    }
    return cancelHttpApiRequest(requestId)
  })
}
