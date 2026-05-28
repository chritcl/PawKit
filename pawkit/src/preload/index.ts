import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { ClipboardItem } from '../shared/types'

// 使用 any 避免 preload 环境下的类型导入问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronAPI: any = {
  app: {
    // 显示窗口
    showWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_WINDOW),
    // 隐藏窗口
    hideWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_HIDE_WINDOW),
    // 切换窗口显示/隐藏
    toggleWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_TOGGLE_WINDOW),
    // 退出应用
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT)
  },
  setting: {
    // 获取设置值
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTING_GET, key),
    // 设置值
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTING_SET, key, value),
    // 获取所有设置
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING_GET_ALL),
    // 重置设置
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING_RESET)
  },
  clipboard: {
    // 读取系统剪贴板文本
    readText: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_READ_TEXT),
    // 写入文本到系统剪贴板
    writeText: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, { text }),
    // 获取剪贴板历史
    getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET_HISTORY),
    // 清空剪贴板历史
    clearHistory: (keepFavorites = true) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CLEAR_HISTORY, { keepFavorites }),
    // 删除单条记录
    removeItem: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_REMOVE_ITEM, { id }),
    // 切换收藏状态
    toggleFavorite: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_TOGGLE_FAVORITE, { id }),
    // 监听历史记录变化
    onHistoryChanged: (callback: (history: ClipboardItem[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, history: ClipboardItem[]) => {
        callback(history)
      }
      ipcRenderer.on(IPC_CHANNELS.CLIPBOARD_HISTORY_CHANGED, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.CLIPBOARD_HISTORY_CHANGED, listener)
      }
    }
  },
  screenshot: {
    // 全屏截图
    captureFullScreen: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_CAPTURE_FULL_SCREEN),
    // 复制图片到剪贴板
    copyImageToClipboard: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_COPY_IMAGE_TO_CLIPBOARD, dataUrl),
    // 保存图片到本地
    saveImage: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_SAVE_IMAGE, dataUrl)
  },
  shortcut: {
    // 获取快捷键状态
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUT_GET_STATUS),
    // 修改快捷键
    update: (payload: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUT_UPDATE, payload),
    // 重置快捷键为默认值
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUT_RESET),
    // 启用/禁用快捷键
    setEnabled: (payload: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SHORTCUT_SET_ENABLED, payload),
    // 监听导航事件
    onNavigate: (callback: (data: { page: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { page: string }) => callback(data)
      ipcRenderer.on('shortcut:navigate', listener)
      return () => {
        ipcRenderer.removeListener('shortcut:navigate', listener)
      }
    }
  }
}

// 通过 contextBridge 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
