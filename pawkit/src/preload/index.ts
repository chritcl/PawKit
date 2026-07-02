import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type {
  ClipboardItem,
  GeoFileDialogFilter,
  GeoSaveArchiveRequest,
  GeoSaveFileRequest,
  ElectronAPI,
  HttpApiSendRequest,
  ImageToolBatchProgress,
  ImageToolBatchRequest,
  ImageToolProcessRequest,
  ImageToolSendRequest,
  ImageToolSourceRef,
  OcrOverlayResult,
  OcrQuickResult,
  OcrRecognizeRequest,
  OcrRecognizeResult,
  OcrSendRequest,
  OcrSourceRef,
  PinnedWindowActionRequest,
  PinnedWindowCreateRequest,
  PinnedWindowData,
  PinnedWindowUpdateRequest,
  ScreenColorPickResult,
  ScreenColorPickerPayload,
  ScreenCaptureActionRequest,
  ScreenCaptureDisplayPayload,
  ScreenCaptureSessionState,
  StreamProxyEvent,
  StreamProxyStartRequest
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
  geo: {
    // 打开地理空间数据文件
    openFiles: (filters: GeoFileDialogFilter[]) => ipcRenderer.invoke(IPC_CHANNELS.GEO_OPEN_FILES, filters),
    // 保存单个地理空间数据文件
    saveFile: (request: GeoSaveFileRequest) => ipcRenderer.invoke(IPC_CHANNELS.GEO_SAVE_FILE, request),
    // 保存多文件地理空间压缩包
    saveArchive: (request: GeoSaveArchiveRequest) => ipcRenderer.invoke(IPC_CHANNELS.GEO_SAVE_ARCHIVE, request)
  },
  streamProxy: {
    // 启动串流代理会话
    start: (request: StreamProxyStartRequest) => ipcRenderer.invoke(IPC_CHANNELS.STREAM_PROXY_START, request),
    // 停止串流代理会话
    stop: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.STREAM_PROXY_STOP, sessionId),
    // 重试串流代理会话
    retry: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.STREAM_PROXY_RETRY, sessionId),
    // 监听串流代理事件
    onEvent: (callback: (event: StreamProxyEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: StreamProxyEvent) => {
        callback(payload)
      }
      ipcRenderer.on(IPC_CHANNELS.STREAM_PROXY_EVENT, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.STREAM_PROXY_EVENT, listener)
      }
    }
  },
  httpApi: {
    // 发送 HTTP API 调试请求
    send: (request: HttpApiSendRequest) => ipcRenderer.invoke(IPC_CHANNELS.HTTP_API_SEND, request),
    // 取消 HTTP API 调试请求
    cancel: (requestId: string) => ipcRenderer.invoke(IPC_CHANNELS.HTTP_API_CANCEL, requestId)
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
    // 撤销删除单条记录
    restoreItem: (undoToken: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_RESTORE_ITEM, { undoToken }),
    // 切换收藏状态
    toggleFavorite: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_TOGGLE_FAVORITE, { id }),
    // 复制历史项到系统剪贴板
    copyItem: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_COPY_ITEM, { id }),
    // 以纯文本复制历史项
    copyItemText: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_COPY_ITEM_TEXT, { id }),
    // 打开历史中的链接
    openLink: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_OPEN_LINK, { id }),
    // 在资源管理器中定位文件
    showFile: (id: string, path: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_SHOW_FILE, { id, path }),
    // 保存历史中的图片
    saveImage: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_SAVE_IMAGE, { id }),
    // 读取历史图片用于详情预览
    getImageData: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET_IMAGE_DATA, { id }),
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
  imageTool: {
    // 打开本地图片文件
    openImages: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_OPEN_IMAGES),
    // 导入当前剪贴板图片
    importClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_IMPORT_CLIPBOARD),
    // 导入剪贴板历史图片
    importClipboardHistory: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_IMPORT_CLIPBOARD_HISTORY, { id }),
    // 导入 Data URL 图片
    importDataUrl: (dataUrl: string, name?: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_IMPORT_DATA_URL, { dataUrl, name }),
    // 从其他工具发送图片到图片处理工作台
    sendToTool: (request: ImageToolSendRequest) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_SEND_TO_TOOL, request),
    // 处理单张图片
    process: (request: ImageToolProcessRequest) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_PROCESS, request),
    // 批量处理图片
    processBatch: (request: ImageToolBatchRequest) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_PROCESS_BATCH, request),
    // 复制处理结果到剪贴板
    copyResult: (resultId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_COPY_RESULT, { resultId }),
    // 保存处理结果
    saveResult: (resultId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_SAVE_RESULT, { resultId }),
    // 导出处理结果为 Data URL
    exportDataUrl: (resultId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_TOOL_EXPORT_DATA_URL, { resultId }),
    // 监听跨工具打开图片源
    onOpenSource: (callback: (source: ImageToolSourceRef) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, source: ImageToolSourceRef) => callback(source)
      ipcRenderer.on(IPC_CHANNELS.IMAGE_TOOL_OPEN_SOURCE, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.IMAGE_TOOL_OPEN_SOURCE, listener)
      }
    },
    // 监听批量处理进度
    onBatchProgress: (callback: (progress: ImageToolBatchProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ImageToolBatchProgress) => callback(progress)
      ipcRenderer.on(IPC_CHANNELS.IMAGE_TOOL_BATCH_PROGRESS, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.IMAGE_TOOL_BATCH_PROGRESS, listener)
      }
    }
  },
  ocr: {
    // 执行 OCR 识别
    recognize: (request: OcrRecognizeRequest): Promise<OcrRecognizeResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE, request),
    // 识别当前剪贴板图片
    recognizeClipboard: (): Promise<OcrRecognizeResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE_CLIPBOARD),
    // 截图覆盖层专用 OCR 识别（返回文字位置信息）
    recognizeOverlay: (request: OcrRecognizeRequest): Promise<OcrOverlayResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_RECOGNIZE_OVERLAY, request),
    // 仅识别二维码
    detectQr: (request: OcrRecognizeRequest): Promise<OcrQuickResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_DETECT_QR, request),
    // 仅提取颜色
    extractColors: (request: OcrRecognizeRequest): Promise<OcrQuickResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_EXTRACT_COLORS, request),
    // 复制识别文本
    copyText: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.OCR_COPY_TEXT, { text }),
    // 从其他工具发送图片到 OCR 工具
    sendToTool: (request: OcrSendRequest): Promise<OcrSourceRef | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.OCR_SEND_TO_TOOL, request),
    // 监听跨工具打开 OCR 图片源
    onOpenSource: (callback: (source: OcrSourceRef) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, source: OcrSourceRef) => callback(source)
      ipcRenderer.on(IPC_CHANNELS.OCR_OPEN_SOURCE, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.OCR_OPEN_SOURCE, listener)
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
  pinned: {
    // 创建截图置顶窗口
    create: (request: PinnedWindowCreateRequest) => ipcRenderer.invoke(IPC_CHANNELS.PINNED_WINDOW_CREATE, request),
    // 通知主进程置顶窗口已准备
    overlayReady: () => ipcRenderer.send(IPC_CHANNELS.PINNED_WINDOW_READY),
    // 更新置顶窗口图片
    update: (request: PinnedWindowUpdateRequest) => ipcRenderer.invoke(IPC_CHANNELS.PINNED_WINDOW_UPDATE, request),
    // 执行置顶窗口复制或保存动作
    performAction: (request: PinnedWindowActionRequest) => ipcRenderer.invoke(IPC_CHANNELS.PINNED_WINDOW_ACTION, request),
    // 关闭置顶窗口
    close: () => ipcRenderer.send(IPC_CHANNELS.PINNED_WINDOW_CLOSE),
    // 接收置顶窗口数据
    onData: (callback: (data: PinnedWindowData) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: PinnedWindowData) => callback(data)
      ipcRenderer.on(IPC_CHANNELS.PINNED_WINDOW_DATA, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.PINNED_WINDOW_DATA, listener)
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
