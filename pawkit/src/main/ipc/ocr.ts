import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { OcrRecognizeRequest, OcrSendRequest } from '../../shared/types'
import {
  copyOcrText,
  detectQrFromImage,
  extractColorsFromImage,
  recognizeClipboardImage,
  recognizeOcr,
  sendImageToOcrTool
} from '../services/ocr-service'
import { validateSender } from './validate-sender'

// 注册 OCR 识别相关 IPC 处理器
export function registerOcrIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE, async (event, request: OcrRecognizeRequest) => {
    if (!validateSender(event)) {
      return createInvalidOcrResult(request?.mode)
    }
    return await recognizeOcr(request)
  })

  ipcMain.handle(IPC_CHANNELS.OCR_RECOGNIZE_CLIPBOARD, async (event) => {
    if (!validateSender(event)) {
      return createInvalidOcrResult('auto')
    }
    return await recognizeClipboardImage()
  })

  ipcMain.handle(IPC_CHANNELS.OCR_DETECT_QR, async (event, request: OcrRecognizeRequest) => {
    if (!validateSender(event)) return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    return await detectQrFromImage(request)
  })

  ipcMain.handle(IPC_CHANNELS.OCR_EXTRACT_COLORS, async (event, request: OcrRecognizeRequest) => {
    if (!validateSender(event)) return { success: false, status: 'error', message: 'IPC 请求来源无效' }
    return await extractColorsFromImage(request)
  })

  ipcMain.handle(IPC_CHANNELS.OCR_COPY_TEXT, (event, payload: { text: string }) => {
    if (!validateSender(event)) return { success: false, message: 'IPC 请求来源无效' }
    return copyOcrText(payload?.text ?? '')
  })

  ipcMain.handle(IPC_CHANNELS.OCR_SEND_TO_TOOL, async (event, request: OcrSendRequest) => {
    if (!validateSender(event)) return null
    return await sendImageToOcrTool(request)
  })
}

// 创建无效请求结果
function createInvalidOcrResult(mode: OcrRecognizeRequest['mode'] = 'auto') {
  return {
    success: false,
    status: 'error',
    message: 'IPC 请求来源无效',
    mode,
    text: '',
    paragraphText: '',
    codeText: '',
    table: null,
    urls: [],
    qrCodes: [],
    colors: [],
    confidence: 0,
    createdAt: new Date().toISOString()
  }
}
