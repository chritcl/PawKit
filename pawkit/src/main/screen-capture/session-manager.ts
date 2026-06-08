import { BrowserWindow } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type {
  ScreenCaptureActionRequest,
  ScreenCaptureActionResponse,
  ScreenCaptureDisplayPayload,
  ScreenCaptureSessionState,
  ScreenCaptureStartResponse,
  ScreenshotPreferences
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { getSetting } from '../store'
import { captureAllDisplays } from './source-provider'
import { performScreenCaptureOutput } from './output-service'

interface OverlayEntry {
  displayId: string
  window: BrowserWindow
  payload: ScreenCaptureDisplayPayload
}

interface ScreenCaptureSession {
  id: string
  ownerWindow: BrowserWindow | null
  shouldRestoreOwner: boolean
  activeDisplayId: string | null
  overlays: OverlayEntry[]
  closing: boolean
}

let activeSession: ScreenCaptureSession | null = null

// 启动全新截图会话
export async function startScreenCapture(
  ownerWindow?: BrowserWindow | null
): Promise<ScreenCaptureStartResponse> {
  if (activeSession) {
    focusActiveOverlay(activeSession)
    return {
      status: 'busy',
      message: '截图会话已经打开',
      sessionId: activeSession.id
    }
  }

  const shouldRestoreOwner = Boolean(ownerWindow && !ownerWindow.isDestroyed() && ownerWindow.isVisible())
  if (shouldRestoreOwner && ownerWindow) {
    ownerWindow.hide()
    await delay(100)
  }

  let sources
  try {
    sources = await captureAllDisplays()
  } catch (error) {
    restoreOwner(ownerWindow ?? null, shouldRestoreOwner)
    console.error('冻结显示器失败:', error)
    return { status: 'error', message: '冻结屏幕失败' }
  }

  if (sources.length === 0) {
    restoreOwner(ownerWindow ?? null, shouldRestoreOwner)
    return { status: 'no-source', message: '没有找到可用的显示器' }
  }

  const sessionId = randomUUID()
  const preferences = getScreenshotPreferences()
  const session: ScreenCaptureSession = {
    id: sessionId,
    ownerWindow: ownerWindow ?? null,
    shouldRestoreOwner,
    activeDisplayId: null,
    overlays: [],
    closing: false
  }
  activeSession = session

  for (const source of sources) {
    const payload: ScreenCaptureDisplayPayload = {
      sessionId,
      displayId: source.displayId,
      dataUrl: source.dataUrl,
      bounds: source.bounds,
      scaleFactor: source.scaleFactor,
      width: source.width,
      height: source.height,
      preferences
    }
    const window = createOverlayWindow(payload)
    const entry = { displayId: source.displayId, window, payload }
    session.overlays.push(entry)
    bindOverlayLifecycle(session, entry)
    void loadOverlay(window, source.displayId).catch((error) => {
      console.error('加载新版截图覆盖层失败:', error)
      closeScreenCaptureSession()
    })
  }

  return {
    status: 'started',
    message: '截图会话已启动',
    sessionId
  }
}

// 覆盖层准备完成
export function handleScreenCaptureOverlayReady(event: IpcMainEvent): void {
  const entry = findOverlayBySender(event.sender)
  if (!activeSession || !entry) return
  entry.window.webContents.send(IPC_CHANNELS.SCREEN_CAPTURE_PAYLOAD, entry.payload)
  sendState(activeSession, entry)
  if (!entry.window.isVisible()) {
    entry.window.show()
  }
}

// 覆盖层认领活动显示器
export function handleScreenCaptureClaim(event: IpcMainEvent): void {
  const entry = findOverlayBySender(event.sender)
  if (!activeSession || !entry) return
  if (activeSession.activeDisplayId && activeSession.activeDisplayId !== entry.displayId) return
  activeSession.activeDisplayId = entry.displayId
  broadcastStates(activeSession)
  entry.window.focus()
}

// 执行截图输出动作
export async function handleScreenCaptureAction(
  event: IpcMainInvokeEvent,
  request: ScreenCaptureActionRequest
): Promise<ScreenCaptureActionResponse> {
  const entry = findOverlayBySender(event.sender)
  if (!activeSession || !entry || activeSession.activeDisplayId !== entry.displayId) {
    return { status: 'error', message: '当前显示器未获得截图控制权' }
  }
  if (!isValidActionRequest(request, entry.displayId)) {
    return { status: 'error', message: '截图输出请求无效' }
  }

  const response = await performScreenCaptureOutput(request, entry.window)
  if (
    (request.action === 'complete' && response.status === 'copied') ||
    (request.action === 'save' && response.status === 'saved')
  ) {
    closeScreenCaptureSession()
  }
  return response
}

// 取消截图会话
export function handleScreenCaptureCancel(event: IpcMainEvent): void {
  if (!findOverlayBySender(event.sender)) return
  closeScreenCaptureSession()
}

// 关闭当前截图会话
export function closeScreenCaptureSession(): void {
  const session = activeSession
  if (!session || session.closing) return
  session.closing = true
  activeSession = null

  for (const entry of session.overlays) {
    if (!entry.window.isDestroyed()) {
      entry.window.webContents.send(IPC_CHANNELS.SCREEN_CAPTURE_SESSION_STATE, {
        sessionId: session.id,
        displayId: entry.displayId,
        status: 'closed',
        activeDisplayId: session.activeDisplayId
      } satisfies ScreenCaptureSessionState)
      entry.window.destroy()
    }
  }
  restoreOwner(session.ownerWindow, session.shouldRestoreOwner)
}

// 创建单显示器覆盖窗口
function createOverlayWindow(payload: ScreenCaptureDisplayPayload): BrowserWindow {
  const window = new BrowserWindow({
    x: payload.bounds.x,
    y: payload.bounds.y,
    width: payload.bounds.width,
    height: payload.bounds.height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  return window
}

// 绑定覆盖窗口生命周期
function bindOverlayLifecycle(session: ScreenCaptureSession, entry: OverlayEntry): void {
  entry.window.webContents.once('did-finish-load', () => {
    if (!entry.window.isDestroyed()) entry.window.show()
  })
  entry.window.webContents.once('did-fail-load', () => closeScreenCaptureSession())
  entry.window.webContents.once('render-process-gone', () => closeScreenCaptureSession())
  entry.window.once('closed', () => {
    if (!session.closing) closeScreenCaptureSession()
  })
}

// 加载覆盖层页面
async function loadOverlay(window: BrowserWindow, displayId: string): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    url.searchParams.set('mode', 'screen-capture-overlay')
    url.searchParams.set('displayId', displayId)
    await window.loadURL(url.toString())
    return
  }
  await window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: {
      mode: 'screen-capture-overlay',
      displayId
    }
  })
}

// 广播各显示器当前会话状态
function broadcastStates(session: ScreenCaptureSession): void {
  for (const entry of session.overlays) sendState(session, entry)
}

// 发送单个覆盖层状态
function sendState(session: ScreenCaptureSession, entry: OverlayEntry): void {
  if (entry.window.isDestroyed()) return
  const status = session.activeDisplayId === null
    ? 'idle'
    : session.activeDisplayId === entry.displayId
      ? 'active'
      : 'locked'
  entry.window.webContents.send(IPC_CHANNELS.SCREEN_CAPTURE_SESSION_STATE, {
    sessionId: session.id,
    displayId: entry.displayId,
    status,
    activeDisplayId: session.activeDisplayId
  } satisfies ScreenCaptureSessionState)
}

// 根据发送方定位覆盖窗口
function findOverlayBySender(sender: WebContents): OverlayEntry | null {
  return activeSession?.overlays.find((entry) => entry.window.webContents === sender) ?? null
}

// 聚焦当前活动覆盖窗口
function focusActiveOverlay(session: ScreenCaptureSession): void {
  const entry = session.overlays.find((item) => item.displayId === session.activeDisplayId)
    ?? session.overlays[0]
  if (entry && !entry.window.isDestroyed()) entry.window.focus()
}

// 恢复截图前可见的主窗口
function restoreOwner(ownerWindow: BrowserWindow | null, shouldRestore: boolean): void {
  if (!shouldRestore || !ownerWindow || ownerWindow.isDestroyed()) return
  ownerWindow.show()
  ownerWindow.focus()
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

// 校验输出动作请求
function isValidActionRequest(
  value: ScreenCaptureActionRequest,
  displayId: string
): boolean {
  return (
    value &&
    ['copy', 'complete', 'save'].includes(value.action) &&
    value.displayId === displayId &&
    value.dataUrl.startsWith('data:image/png') &&
    Number.isFinite(value.width) &&
    value.width > 0 &&
    Number.isFinite(value.height) &&
    value.height > 0
  )
}

// 等待指定毫秒
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
