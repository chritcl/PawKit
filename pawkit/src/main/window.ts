import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getIsQuitting } from './index'
import { getWindowBounds, setWindowBounds } from './store'
import { WindowBounds } from '../shared/types'

// 默认窗口尺寸
const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 680
const MIN_WIDTH = 800
const MIN_HEIGHT = 560

// 创建主窗口
export function createMainWindow(): BrowserWindow {
  // 读取保存的窗口尺寸
  const savedBounds = getWindowBounds()

  const mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? DEFAULT_WIDTH,
    height: savedBounds?.height ?? DEFAULT_HEIGHT,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 窗口准备好后显示
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 关闭窗口时隐藏到托盘，不退出应用
  mainWindow.on('close', (event) => {
    if (!getIsQuitting()) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // 窗口移动或调整大小时保存尺寸
  const saveBounds = (): void => {
    const bounds = mainWindow.getBounds() as WindowBounds
    setWindowBounds(bounds)
  }

  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  // 打开外部链接时用默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 阻止页面导航到外部 URL（安全措施）
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (is.dev) {
      // 开发模式下允许本地开发服务器导航
      try {
        const urlObj = new URL(navigationUrl)
        if (['localhost', '127.0.0.1', '::1'].includes(urlObj.hostname)) {
          return
        }
      } catch {
        // URL 解析失败，继续阻止
      }
    }
    // 生产模式下阻止所有导航
    event.preventDefault()
    console.warn(`导航被阻止：${navigationUrl}`)
  })

  // 加载页面
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// 显示窗口
export function showWindow(window: BrowserWindow): void {
  window.show()
  window.focus()
}

// 隐藏窗口
export function hideWindow(window: BrowserWindow): void {
  window.hide()
}

// 切换窗口显示/隐藏
export function toggleWindow(window: BrowserWindow): void {
  if (window.isVisible()) {
    hideWindow(window)
  } else {
    showWindow(window)
  }
}
