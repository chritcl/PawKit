import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  ImageToolBatchRequest,
  ImageToolProcessRequest,
  ImageToolSendRequest
} from '../../shared/types'
import {
  copyImageResult,
  exportImageResultDataUrl,
  importClipboardHistoryImage,
  importClipboardImage,
  importImageDataUrl,
  openImageFiles,
  processImage,
  processImageBatch,
  saveImageResult,
  sendImageToTool
} from '../services/image-tool'
import { validateSender } from './validate-sender'
import { logger } from '../logger'

// 注册图片处理相关 IPC 处理器
export function registerImageToolIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_OPEN_IMAGES, async (event) => {
    if (!validateSender(event)) return []
    return await openImageFiles(BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_IMPORT_CLIPBOARD, async (event) => {
    if (!validateSender(event)) return null
    return await importClipboardImage()
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_IMPORT_CLIPBOARD_HISTORY, async (event, payload: { id: string }) => {
    if (!validateSender(event)) return null
    if (!payload || typeof payload.id !== 'string') return null
    return await importClipboardHistoryImage(payload.id)
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_IMPORT_DATA_URL, async (event, payload: { dataUrl: string; name?: string }) => {
    if (!validateSender(event)) return null
    if (!payload || typeof payload.dataUrl !== 'string') return null
    return await importImageDataUrl(payload.dataUrl, payload.name)
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_SEND_TO_TOOL, async (event, request: ImageToolSendRequest) => {
    if (!validateSender(event)) return null
    if (!request || typeof request.dataUrl !== 'string') return null
    try {
      return await sendImageToTool(request)
    } catch (error) {
      logger.error('发送图片到图片处理失败:', error)
      return null
    }
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_PROCESS, async (event, request: ImageToolProcessRequest) => {
    if (!validateSender(event)) {
      return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    }
    return await processImage(request)
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_PROCESS_BATCH, async (event, request: ImageToolBatchRequest) => {
    if (!validateSender(event)) {
      return { success: false, status: 'error', message: 'IPC 请求来源无效', items: [] }
    }
    return await processImageBatch(request, BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_COPY_RESULT, async (event, payload: { resultId: string }) => {
    if (!validateSender(event)) return { success: false, message: 'IPC 请求来源无效' }
    if (!payload || typeof payload.resultId !== 'string') return { success: false, message: '处理结果参数无效' }
    return await copyImageResult(payload.resultId)
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_SAVE_RESULT, async (event, payload: { resultId: string }) => {
    if (!validateSender(event)) return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    if (!payload || typeof payload.resultId !== 'string') {
      return { success: false, status: 'error', message: '处理结果参数无效' }
    }
    return await saveImageResult(payload.resultId, BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(IPC_CHANNELS.IMAGE_TOOL_EXPORT_DATA_URL, (event, payload: { resultId: string }) => {
    if (!validateSender(event)) return null
    if (!payload || typeof payload.resultId !== 'string') return null
    return exportImageResultDataUrl(payload.resultId)
  })
}

