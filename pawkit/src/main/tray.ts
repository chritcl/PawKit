import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'path'
import { setIsQuitting } from './index'
import { toggleWindow, showWindow } from './window'
import { APP_NAME } from '../shared/constants'
import { startScreenCapture } from './screen-capture/session-manager'

// 托盘实例
let tray: Tray | null = null

// 创建系统托盘
export function createTray(mainWindow: BrowserWindow): Tray {
  // 加载图标
  const iconPath = join(__dirname, '../../resources/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)

  // 设置托盘提示文本
  tray.setToolTip(APP_NAME)

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 PawKit',
      click: () => {
        showWindow(mainWindow)
      }
    },
    {
      label: '显示 / 隐藏',
      click: () => {
        toggleWindow(mainWindow)
      }
    },
    {
      label: '截图',
      click: () => {
        void startScreenCapture(mainWindow)
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        setIsQuitting(true)
        app.quit()
      }
    }
  ])

  // 设置托盘菜单
  tray.setContextMenu(contextMenu)

  // 单击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    toggleWindow(mainWindow)
  })

  return tray
}
