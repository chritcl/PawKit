import { BrowserWindow, nativeImage, screen } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  PinnedWindowActionRequest,
  PinnedWindowCreateRequest,
  PinnedWindowCreateResponse,
  PinnedWindowData,
  PinnedWindowUpdateRequest,
  PinnedWindowUpdateResponse,
  ScreenCaptureActionResponse,
  ScreenshotPreferences,
  WindowBounds
} from '../../shared/types'
import { getSetting } from '../store'
import { logger } from '../logger'
import { performScreenCaptureOutput } from './output-service'

interface PinnedWindowEntry {
  id: string
  window: BrowserWindow
  data: PinnedWindowData
}

const pinnedWindows = new Map<string, PinnedWindowEntry>()

// 创建截图置顶窗口
export async function createPinnedWindow(
  request: PinnedWindowCreateRequest
): Promise<PinnedWindowCreateResponse> {
  if (!request) {
    return { status: 'error', message: '置顶截图请求无效' }
  }
  if (!isValidImageData(request.dataUrl) || !isValidImageSize(request.width, request.height)) {
    return { status: 'error', message: '置顶截图数据无效' }
  }
  if (!isValidBounds(request.bounds)) {
    return { status: 'error', message: '置顶窗口位置无效' }
  }

  const id = randomUUID()
  const bounds = normalizePinnedBounds(request.bounds)
  const data: PinnedWindowData = {
    id,
    dataUrl: request.dataUrl,
    width: Math.round(request.width),
    height: Math.round(request.height),
    bounds,
    preferences: getScreenshotPreferences(),
    createdAt: new Date().toISOString()
  }
  const window = createPinnedBrowserWindow(bounds)
  const entry: PinnedWindowEntry = { id, window, data }
  pinnedWindows.set(id, entry)
  bindPinnedWindowLifecycle(entry)

  try {
    await loadPinnedWindow(window, id)
    return { status: 'pinned', message: '已钉在桌面', id }
  } catch (error) {
    logger.error('加载置顶截图窗口失败:', error)
    destroyPinnedWindow(entry)
    return { status: 'error', message: '创建置顶窗口失败' }
  }
}

// 置顶窗口准备完成
export function handlePinnedWindowReady(event: IpcMainEvent): void {
  const entry = findPinnedWindowBySender(event.sender)
  if (!entry || entry.window.isDestroyed()) return
  entry.window.webContents.send(IPC_CHANNELS.PINNED_WINDOW_DATA, entry.data)
  if (!entry.window.isVisible()) {
    entry.window.show()
  }
}

// 更新置顶窗口图片
export function handlePinnedWindowUpdate(
  event: IpcMainInvokeEvent,
  request: PinnedWindowUpdateRequest
): PinnedWindowUpdateResponse {
  if (!request) {
    return { status: 'error', message: '置顶窗口请求无效' }
  }
  const entry = findPinnedWindowBySender(event.sender)
  if (!entry || entry.id !== request.pinnedId) {
    return { status: 'error', message: '置顶窗口来源无效' }
  }
  if (!isValidImageData(request.dataUrl) || !isValidImageSize(request.width, request.height)) {
    return { status: 'error', message: '置顶截图数据无效' }
  }

  const nextBounds = request.bounds && isValidBounds(request.bounds)
    ? normalizePinnedBounds(request.bounds)
    : entry.window.getBounds() as WindowBounds
  entry.data = {
    ...entry.data,
    dataUrl: request.dataUrl,
    width: Math.round(request.width),
    height: Math.round(request.height),
    bounds: nextBounds
  }
  if (!entry.window.isDestroyed()) {
    entry.window.webContents.send(IPC_CHANNELS.PINNED_WINDOW_DATA, entry.data)
  }
  return { status: 'updated', message: '置顶截图已更新' }
}

// 执行置顶窗口复制或保存动作
export async function handlePinnedWindowAction(
  event: IpcMainInvokeEvent,
  request: PinnedWindowActionRequest
): Promise<ScreenCaptureActionResponse> {
  if (!request) {
    return { status: 'error', message: '置顶窗口请求无效' }
  }
  const entry = findPinnedWindowBySender(event.sender)
  if (!entry || entry.id !== request.pinnedId) {
    return { status: 'error', message: '置顶窗口来源无效' }
  }
  if (
    !['copy', 'save'].includes(request.action) ||
    !isValidImageData(request.dataUrl) ||
    !isValidImageSize(request.width, request.height)
  ) {
    return { status: 'error', message: '置顶截图输出请求无效' }
  }
  return await performScreenCaptureOutput({
    action: request.action,
    dataUrl: request.dataUrl,
    width: request.width,
    height: request.height,
    displayId: ''
  }, entry.window)
}

// 关闭置顶窗口
export function handlePinnedWindowClose(event: IpcMainEvent): void {
  const entry = findPinnedWindowBySender(event.sender)
  if (!entry) return
  destroyPinnedWindow(entry)
}

// 创建置顶 BrowserWindow
function createPinnedBrowserWindow(bounds: WindowBounds): BrowserWindow {
  const window = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 96,
    minHeight: 72,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'PawKit 置顶截图',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  window.setAlwaysOnTop(true, 'floating')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  return window
}

// 绑定置顶窗口生命周期
function bindPinnedWindowLifecycle(entry: PinnedWindowEntry): void {
  entry.window.webContents.once('render-process-gone', () => destroyPinnedWindow(entry))
  entry.window.webContents.once('did-fail-load', () => destroyPinnedWindow(entry))
  entry.window.once('closed', () => {
    pinnedWindows.delete(entry.id)
  })
  entry.window.on('move', () => savePinnedWindowBounds(entry))
  entry.window.on('resize', () => savePinnedWindowBounds(entry))
}

// 加载置顶窗口页面
async function loadPinnedWindow(window: BrowserWindow, pinnedId: string): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    url.searchParams.set('mode', 'pinned-overlay')
    url.searchParams.set('pinnedId', pinnedId)
    await window.loadURL(url.toString())
    return
  }
  await window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: {
      mode: 'pinned-overlay',
      pinnedId
    }
  })
}

// 销毁并移除置顶窗口
function destroyPinnedWindow(entry: PinnedWindowEntry): void {
  pinnedWindows.delete(entry.id)
  if (!entry.window.isDestroyed()) {
    entry.window.destroy()
  }
}

// 保存置顶窗口当前桌面坐标
function savePinnedWindowBounds(entry: PinnedWindowEntry): void {
  if (entry.window.isDestroyed()) return
  entry.data = {
    ...entry.data,
    bounds: entry.window.getBounds() as WindowBounds
  }
}

// 根据发送方查找置顶窗口
function findPinnedWindowBySender(sender: WebContents): PinnedWindowEntry | null {
  for (const entry of pinnedWindows.values()) {
    if (entry.window.webContents === sender) return entry
  }
  return null
}

// 校验图片数据
function isValidImageData(dataUrl: string): boolean {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) return false
  try {
    return !nativeImage.createFromDataURL(dataUrl).isEmpty()
  } catch {
    return false
  }
}

// 校验图片尺寸
function isValidImageSize(width: number, height: number): boolean {
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
}

// 校验窗口坐标
function isValidBounds(bounds: WindowBounds): boolean {
  return Boolean(bounds) &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
}

// 规范化置顶窗口坐标，避免极小窗口不可操作
function normalizePinnedBounds(bounds: WindowBounds): WindowBounds {
  const display = screen.getDisplayMatching(bounds)
  const minWidth = 96
  const minHeight = 72
  const width = Math.max(minWidth, Math.round(bounds.width))
  const height = Math.max(minHeight, Math.round(bounds.height))
  const x = Math.round(bounds.x)
  const y = Math.round(bounds.y)
  const maxWidth = Math.max(minWidth, Math.round(display.bounds.width))
  const maxHeight = Math.max(minHeight, Math.round(display.bounds.height))

  return {
    x,
    y,
    width: Math.min(width, maxWidth),
    height: Math.min(height, maxHeight)
  }
}

// 读取并校验截图默认设置
function getScreenshotPreferences(): ScreenshotPreferences {
  const saved = getSetting<ScreenshotPreferences>('screenshot.preferences')
  return {
    annotationColor: saved && /^#[0-9a-fA-F]{6}$/.test(saved.annotationColor)
      ? saved.annotationColor
      : '#ff4d4f',
    strokeWidth: saved && Number.isFinite(saved.strokeWidth)
      ? Math.min(14, Math.max(2, Math.round(saved.strokeWidth)))
      : 4
  }
}
