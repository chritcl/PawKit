import { desktopCapturer, clipboard, nativeImage, dialog, BrowserWindow, screen, ipcMain } from 'electron'
import type { Display, IpcMainEvent } from 'electron'
import { is } from '@electron-toolkit/utils'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import {
  ImageSaveResult,
  ScreenColorPickerPayload,
  ScreenColorPickResponse,
  ScreenColorPickResult,
  ScreenshotCapturePayload,
  ScreenshotCaptureResponse,
  ScreenshotResult,
  WindowBounds
} from '../shared/types'
import { IPC_CHANNELS } from '../shared/ipc-channels'

// 当前取色覆盖层窗口
let activeColorPickerWindow: BrowserWindow | null = null
// 当前截图覆盖层窗口
let activeScreenshotWindow: BrowserWindow | null = null

// 等待指定毫秒
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 截取指定显示器
async function captureDisplay(display: Display): Promise<ScreenshotResult> {
  const captureWidth = Math.max(1, Math.round(display.bounds.width * display.scaleFactor))
  const captureHeight = Math.max(1, Math.round(display.bounds.height * display.scaleFactor))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: captureWidth,
      height: captureHeight
    }
  })

  if (sources.length === 0) {
    throw new Error('没有找到屏幕源')
  }

  const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0]
  const thumbnail = source.thumbnail
  if (!source || thumbnail.isEmpty()) {
    throw new Error('屏幕源为空')
  }

  return {
    dataUrl: thumbnail.toDataURL(),
    width: thumbnail.getSize().width,
    height: thumbnail.getSize().height,
    createdAt: new Date().toISOString(),
    displayId: String(display.id),
    displayBounds: display.bounds as WindowBounds,
    scaleFactor: display.scaleFactor
  }
}

// 全屏截图
export async function captureFullScreen(): Promise<ScreenshotResult> {
  return await captureDisplay(screen.getPrimaryDisplay())
}

// 加载截图覆盖层页面
async function loadScreenshotCaptureOverlay(window: BrowserWindow): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    url.searchParams.set('mode', 'screenshot-capture-overlay')
    await window.loadURL(url.toString())
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: { mode: 'screenshot-capture-overlay' }
  })
}

// 校验截图结果
function isValidScreenshotResult(value: unknown): value is ScreenshotResult {
  if (!value || typeof value !== 'object') return false
  const result = value as ScreenshotResult
  return (
    typeof result.dataUrl === 'string' &&
    result.dataUrl.startsWith('data:image/png') &&
    typeof result.width === 'number' &&
    result.width > 0 &&
    typeof result.height === 'number' &&
    result.height > 0 &&
    typeof result.createdAt === 'string'
  )
}

// 启动系统级截图
export async function startScreenshotCapture(ownerWindow?: BrowserWindow | null): Promise<ScreenshotCaptureResponse> {
  if (activeScreenshotWindow && !activeScreenshotWindow.isDestroyed()) {
    activeScreenshotWindow.focus()
    return {
      status: 'busy',
      message: '截图窗口已经打开'
    }
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const bounds = display.bounds
  const shouldRestoreOwner = Boolean(ownerWindow && !ownerWindow.isDestroyed() && ownerWindow.isVisible())

  if (ownerWindow && !ownerWindow.isDestroyed()) {
    ownerWindow.hide()
  }

  await delay(120)

  let screenshot: ScreenshotResult
  try {
    screenshot = await captureDisplay(display)
  } catch (error) {
    if (shouldRestoreOwner && ownerWindow && !ownerWindow.isDestroyed()) {
      ownerWindow.show()
      ownerWindow.focus()
    }
    console.error('截图失败:', error)
    return {
      status: 'no-source',
      message: '没有找到可用的屏幕截图源'
    }
  }

  const payload: ScreenshotCapturePayload = {
    screenshot,
    displayBounds: bounds as WindowBounds,
    scaleFactor: display.scaleFactor
  }

  const overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  activeScreenshotWindow = overlayWindow
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  return await new Promise<ScreenshotCaptureResponse>((resolve) => {
    let completed = false
    let dataSent = false

    const restoreOwnerWindow = (): void => {
      if (shouldRestoreOwner && ownerWindow && !ownerWindow.isDestroyed()) {
        ownerWindow.show()
        ownerWindow.focus()
      }
    }

    const cleanup = (response: ScreenshotCaptureResponse): void => {
      if (completed) return
      completed = true
      clearTimeout(loadTimer)
      ipcMain.removeListener(IPC_CHANNELS.SCREENSHOT_CAPTURE_READY, handleReady)
      ipcMain.removeListener(IPC_CHANNELS.SCREENSHOT_CAPTURE_FINISH, handleFinish)
      ipcMain.removeListener(IPC_CHANNELS.SCREENSHOT_CAPTURE_CANCEL, handleCancel)
      if (activeScreenshotWindow === overlayWindow) {
        activeScreenshotWindow = null
      }
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.close()
      }
      restoreOwnerWindow()
      resolve(response)
    }

    const isOverlaySender = (event: IpcMainEvent): boolean => {
      return event.sender === overlayWindow.webContents
    }

    const sendCaptureData = (): void => {
      if (overlayWindow.isDestroyed()) return
      dataSent = true
      overlayWindow.webContents.send(IPC_CHANNELS.SCREENSHOT_CAPTURE_DATA, payload)
    }

    const handleReady = (event: IpcMainEvent): void => {
      if (!isOverlaySender(event)) return
      sendCaptureData()
    }

    const handleFinish = (event: IpcMainEvent, result: unknown): void => {
      if (!isOverlaySender(event)) return
      cleanup(isValidScreenshotResult(result)
        ? { status: 'captured', message: '截图完成', result }
        : { status: 'error', message: '截图结果无效' })
    }

    const handleCancel = (event: IpcMainEvent): void => {
      if (!isOverlaySender(event)) return
      cleanup({ status: 'cancelled', message: '已取消截图' })
    }

    ipcMain.on(IPC_CHANNELS.SCREENSHOT_CAPTURE_READY, handleReady)
    ipcMain.on(IPC_CHANNELS.SCREENSHOT_CAPTURE_FINISH, handleFinish)
    ipcMain.on(IPC_CHANNELS.SCREENSHOT_CAPTURE_CANCEL, handleCancel)

    const loadTimer = setTimeout(() => {
      cleanup({ status: 'timeout', message: dataSent ? '等待截图操作超时' : '截图窗口加载超时' })
    }, 300000)

    overlayWindow.webContents.once('did-finish-load', () => {
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.show()
        overlayWindow.focus()
        setTimeout(sendCaptureData, 80)
      }
    })

    overlayWindow.webContents.once('did-fail-load', () => {
      cleanup({ status: 'load-failed', message: '截图窗口加载失败' })
    })

    overlayWindow.once('ready-to-show', () => {
      overlayWindow.show()
      overlayWindow.focus()
    })

    overlayWindow.once('closed', () => {
      cleanup({ status: 'cancelled', message: '已取消截图' })
    })

    void loadScreenshotCaptureOverlay(overlayWindow).catch(() => {
      cleanup({ status: 'load-failed', message: '截图窗口加载失败' })
    })
  })
}

// 复制图片到剪贴板
export function copyImageToClipboard(dataUrl: string): boolean {
  try {
    const image = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(image)
    return true
  } catch (error) {
    console.error('复制图片到剪贴板失败:', error)
    return false
  }
}

// 保存图片到本地
export async function saveImage(dataUrl: string): Promise<ImageSaveResult> {
  try {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options = {
      title: '保存截图',
      defaultPath: `screenshot-${Date.now()}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return { success: false, status: 'cancelled', message: '保存已取消' }
    }

    const image = nativeImage.createFromDataURL(dataUrl)
    const buffer = image.toPNG()
    await writeFile(result.filePath, buffer)

    return { success: true, status: 'saved', path: result.filePath, message: '保存成功' }
  } catch (error) {
    console.error('保存图片失败:', error)
    return { success: false, status: 'error', message: '保存失败' }
  }
}

// 获取当前取色显示器
function getColorPickerDisplay(): Display {
  const focusedWindow = BrowserWindow.getFocusedWindow()
  if (focusedWindow && !focusedWindow.isDestroyed()) {
    return screen.getDisplayMatching(focusedWindow.getBounds())
  }

  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

// 截取当前屏幕用于取色覆盖层
async function captureColorPickerPayload(display: Display): Promise<ScreenColorPickerPayload> {
  const captureWidth = Math.max(1, Math.round(display.bounds.width * display.scaleFactor))
  const captureHeight = Math.max(1, Math.round(display.bounds.height * display.scaleFactor))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: captureWidth,
      height: captureHeight
    }
  })

  const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) {
    return {
      sources: [],
      virtualBounds: display.bounds as WindowBounds
    }
  }

  const size = source.thumbnail.getSize()

  return {
    sources: [{
      displayId: String(display.id),
      dataUrl: source.thumbnail.toDataURL(),
      bounds: display.bounds as WindowBounds,
      scaleFactor: display.scaleFactor,
      width: size.width,
      height: size.height
    }],
    virtualBounds: display.bounds as WindowBounds
  }
}

// 加载取色覆盖层页面
async function loadColorPickerOverlay(window: BrowserWindow): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    url.searchParams.set('mode', 'color-picker-overlay')
    await window.loadURL(url.toString())
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: { mode: 'color-picker-overlay' }
  })
}

// 校验取色结果
function isValidPickResult(value: unknown): value is ScreenColorPickResult {
  if (!value || typeof value !== 'object') return false
  const result = value as ScreenColorPickResult
  return (
    /^#[0-9a-fA-F]{6}$/.test(result.hex) &&
    typeof result.rgb?.r === 'number' &&
    typeof result.rgb?.g === 'number' &&
    typeof result.rgb?.b === 'number' &&
    typeof result.point?.x === 'number' &&
    typeof result.point?.y === 'number' &&
    typeof result.displayId === 'string'
  )
}

// 启动全屏滴管取色
export async function pickScreenColor(): Promise<ScreenColorPickResponse> {
  if (activeColorPickerWindow && !activeColorPickerWindow.isDestroyed()) {
    activeColorPickerWindow.focus()
    return {
      status: 'busy',
      message: '取色窗口已经打开'
    }
  }

  const display = getColorPickerDisplay()
  const payload = await captureColorPickerPayload(display)
  if (payload.sources.length === 0) {
    return {
      status: 'no-source',
      message: '没有找到可用的屏幕取色源'
    }
  }

  const bounds = display.bounds
  const overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  activeColorPickerWindow = overlayWindow
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  return await new Promise<ScreenColorPickResponse>((resolve) => {
    let completed = false
    let dataSent = false

    const cleanup = (response: ScreenColorPickResponse): void => {
      if (completed) return
      completed = true
      clearTimeout(loadTimer)
      ipcMain.removeListener(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_READY, handleReady)
      ipcMain.removeListener(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_FINISH, handleFinish)
      ipcMain.removeListener(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_CANCEL, handleCancel)
      if (activeColorPickerWindow === overlayWindow) {
        activeColorPickerWindow = null
      }
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.close()
      }
      resolve(response)
    }

    const isOverlaySender = (event: IpcMainEvent): boolean => {
      return event.sender === overlayWindow.webContents
    }

    const sendPickerData = (): void => {
      if (overlayWindow.isDestroyed()) return
      dataSent = true
      overlayWindow.webContents.send(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_DATA, payload)
    }

    const handleReady = (event: IpcMainEvent): void => {
      if (!isOverlaySender(event)) return
      sendPickerData()
    }

    const handleFinish = (event: IpcMainEvent, result: unknown): void => {
      if (!isOverlaySender(event)) return
      cleanup(isValidPickResult(result)
        ? { status: 'picked', message: `已取色 ${result.hex}`, result }
        : { status: 'error', message: '取色结果无效' })
    }

    const handleCancel = (event: IpcMainEvent): void => {
      if (!isOverlaySender(event)) return
      cleanup({ status: 'cancelled', message: '已取消取色' })
    }

    ipcMain.on(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_READY, handleReady)
    ipcMain.on(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_FINISH, handleFinish)
    ipcMain.on(IPC_CHANNELS.SCREENSHOT_COLOR_PICKER_CANCEL, handleCancel)

    const loadTimer = setTimeout(() => {
      cleanup({ status: 'timeout', message: dataSent ? '等待取色超时' : '取色窗口加载超时' })
    }, 10000)

    overlayWindow.webContents.once('did-finish-load', () => {
      clearTimeout(loadTimer)
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.show()
        overlayWindow.focus()
        setTimeout(sendPickerData, 80)
      }
    })

    overlayWindow.webContents.once('did-fail-load', () => {
      cleanup({ status: 'load-failed', message: '取色窗口加载失败' })
    })

    overlayWindow.once('ready-to-show', () => {
      overlayWindow.show()
      overlayWindow.focus()
    })

    overlayWindow.once('closed', () => {
      cleanup({ status: 'cancelled', message: '已取消取色' })
    })

    void loadColorPickerOverlay(overlayWindow).catch(() => {
      cleanup({ status: 'load-failed', message: '取色窗口加载失败' })
    })
  })
}
