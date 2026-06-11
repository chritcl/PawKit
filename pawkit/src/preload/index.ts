import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type {
  ClipboardItem,
  ElectronAPI,
  ScreenColorPickResult,
  ScreenColorPickerPayload,
  ScreenCaptureActionRequest,
  ScreenCaptureDisplayPayload,
  ScreenCaptureSessionState
} from '../shared/types'

const electronAPI: ElectronAPI = {
  app: {
    // 显示窗口
    showWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SHOW_WINDOW),
    // 隐藏窗口
    hideWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_HIDE_WINDOW),
    // 最小化窗口
    minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_MINIMIZE_WINDOW),
    // 最大化或还原窗口
    toggleMaximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_TOGGLE_MAXIMIZE_WINDOW),
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
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING_RESET),
    // 导出配置
    exportConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING_EXPORT_CONFIG)
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
    // 复制历史项到系统剪贴板
    copyItem: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_COPY_ITEM, { id }),
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
    // 复制图片到剪贴板
    copyImageToClipboard: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_COPY_IMAGE_TO_CLIPBOARD, dataUrl),
    // 保存图片到本地
    saveImage: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_SAVE_IMAGE, dataUrl),
    // 启动全屏滴管取色
    pickScreenColor: () => ipcRenderer.invoke(IPC_CHANNELS.SCREENSHOT_PICK_SCREEN_COLOR),
    // 通知主进程覆盖层已准备
    colorPickerReady: () => ipcRenderer.send(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_READY),
    // 完成屏幕取色
    finishColorPick: (result: ScreenColorPickResult) => ipcRenderer.send(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_FINISH, result),
    // 取消屏幕取色
    cancelColorPick: () => ipcRenderer.send(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_CANCEL),
    // 接收覆盖层取色数据
    onColorPickerData: (callback: (payload: ScreenColorPickerPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ScreenColorPickerPayload) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_DATA, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_DATA, listener)
      }
    }
  },
  screenCapture: {
    // 启动全新截图会话
    start: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE_START),
    // 通知主进程覆盖层已准备
    overlayReady: () => ipcRenderer.send(IPC_CHANNELS.SCREEN_CAPTURE_OVERLAY_READY),
    // 当前覆盖层认领截图会话
    claim: () => ipcRenderer.send(IPC_CHANNELS.SCREEN_CAPTURE_CLAIM),
    // 执行复制、完成或保存动作
    performAction: (request: ScreenCaptureActionRequest) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_CAPTURE_ACTION, request),
    // 取消整个截图会话
    cancel: () => ipcRenderer.send(IPC_CHANNELS.SCREEN_CAPTURE_CANCEL),
    // 接收当前显示器截图数据
    onPayload: (callback: (payload: ScreenCaptureDisplayPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ScreenCaptureDisplayPayload) => callback(payload)
      ipcRenderer.on(IPC_CHANNELS.SCREEN_CAPTURE_PAYLOAD, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SCREEN_CAPTURE_PAYLOAD, listener)
      }
    },
    // 接收截图会话状态
    onSessionState: (callback: (state: ScreenCaptureSessionState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: ScreenCaptureSessionState) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.SCREEN_CAPTURE_SESSION_STATE, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SCREEN_CAPTURE_SESSION_STATE, listener)
      }
    }
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
      ipcRenderer.on(IPC_CHANNELS.SHORTCUT_NAVIGATE, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SHORTCUT_NAVIGATE, listener)
      }
    }
  }
}

// 通过 contextBridge 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
