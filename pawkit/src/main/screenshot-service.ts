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
  WindowBounds
} from '../shared/types'
import { IPC_CHANNELS } from '../shared/ipc-channels'

// 当前取色覆盖层窗口
let activeColorPickerWindow: BrowserWindow | null = null

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
