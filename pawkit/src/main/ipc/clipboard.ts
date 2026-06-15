import { ipcMain, clipboard } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  getClipboardHistory,
  writeClipboardText,
  removeClipboardItem,
  restoreClipboardItem,
  clearClipboardHistory,
  toggleClipboardFavorite,
  copyClipboardItem,
  copyClipboardItemAsText,
  openClipboardLink,
  showClipboardFile,
  saveClipboardImage,
  getClipboardImageData
} from '../services/clipboard-service'
import { validateSender } from './validate-sender'

// 注册剪贴板相关 IPC 处理器
export function registerClipboardIpcHandlers(): void {
  // 读取系统剪贴板文本
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_READ_TEXT, (event) => {
    if (!validateSender(event)) return ''
    return clipboard.readText()
  })

  // 写入文本到系统剪贴板
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, async (event, payload: { text: string }) => {
    if (!validateSender(event)) return []
    if (!payload || typeof payload.text !== 'string') {
      return []
    }
    return await writeClipboardText(payload.text)
  })

  // 获取剪贴板历史
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_HISTORY, (event) => {
    if (!validateSender(event)) return []
    return getClipboardHistory()
  })

  // 清空剪贴板历史
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_CLEAR_HISTORY, (event, payload: { keepFavorites?: boolean }) => {
    if (!validateSender(event)) return []
    return clearClipboardHistory({
      keepFavorites: payload?.keepFavorites !== false
    })
  })

  // 删除单条记录
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_REMOVE_ITEM, (event, payload: { id: string }) => {
    if (!validateSender(event)) return { success: false, history: [], message: '请求来源无效' }
    if (!payload || typeof payload.id !== 'string') {
      return { success: false, history: [], message: '剪贴板记录参数无效' }
    }
    return removeClipboardItem(payload.id)
  })

  // 撤销删除单条记录
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_RESTORE_ITEM, (event, payload: { undoToken: string }) => {
    if (!validateSender(event)) return { success: false, history: [], message: '请求来源无效' }
    if (!payload || typeof payload.undoToken !== 'string') {
      return { success: false, history: [], message: '撤销参数无效' }
    }
    return restoreClipboardItem(payload.undoToken)
  })

  // 切换收藏状态
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_TOGGLE_FAVORITE, (event, payload: { id: string }) => {
    if (!validateSender(event)) return []
    if (!payload || typeof payload.id !== 'string') {
      return []
    }
    return toggleClipboardFavorite(payload.id)
  })

  // 复制历史项到系统剪贴板
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_COPY_ITEM, async (event, payload: { id: string }) => {
    if (!validateSender(event)) return { success: false, history: [], message: '请求来源无效' }
    if (!payload || typeof payload.id !== 'string') {
      return { success: false, history: [], message: '剪贴板记录参数无效' }
    }
    return await copyClipboardItem(payload.id)
  })

  // 以纯文本复制历史项
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_COPY_ITEM_TEXT, async (event, payload: { id: string }) => {
    if (!validateSender(event)) return { success: false, history: [], message: '请求来源无效' }
    if (!payload || typeof payload.id !== 'string') {
      return { success: false, history: [], message: '剪贴板记录参数无效' }
    }
    return await copyClipboardItemAsText(payload.id)
  })

  // 打开历史中的链接
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_OPEN_LINK, async (event, payload: { id: string }) => {
    if (!validateSender(event)) return { success: false, message: '请求来源无效' }
    if (!payload || typeof payload.id !== 'string') {
      return { success: false, message: '剪贴板记录参数无效' }
    }
    return await openClipboardLink(payload.id)
  })

  // 在资源管理器中定位文件
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_SHOW_FILE, (event, payload: { id: string; path: string }) => {
    if (!validateSender(event)) return { success: false, message: '请求来源无效' }
    if (!payload || typeof payload.id !== 'string' || typeof payload.path !== 'string') {
      return { success: false, message: '文件参数无效' }
    }
    return showClipboardFile(payload.id, payload.path)
  })

  // 保存历史中的图片
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE, async (event, payload: { id: string }) => {
    if (!validateSender(event)) return { success: false, status: 'error', message: '请求来源无效' }
    if (!payload || typeof payload.id !== 'string') {
      return { success: false, status: 'error', message: '剪贴板记录参数无效' }
    }
    return await saveClipboardImage(payload.id)
  })

  // 读取历史图片用于详情预览
  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_GET_IMAGE_DATA, (event, payload: { id: string }) => {
    if (!validateSender(event)) return null
    if (!payload || typeof payload.id !== 'string') return null
    return getClipboardImageData(payload.id)
  })
}
