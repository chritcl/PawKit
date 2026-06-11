import { ipcMain, clipboard } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import {
  getClipboardHistory,
  writeClipboardText,
  removeClipboardItem,
  clearClipboardHistory,
  toggleClipboardFavorite,
  copyClipboardItem
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
    if (!validateSender(event)) return []
    if (!payload || typeof payload.id !== 'string') {
      return []
    }
    return removeClipboardItem(payload.id)
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
    if (!validateSender(event)) return []
    if (!payload || typeof payload.id !== 'string') {
      return []
    }
    return await copyClipboardItem(payload.id)
  })
}
