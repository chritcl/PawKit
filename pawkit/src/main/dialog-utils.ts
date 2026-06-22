import { BrowserWindow, dialog } from 'electron'
import type {
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue
} from 'electron'

function getDialogOwner(ownerWindow?: BrowserWindow | null): BrowserWindow | null {
  return ownerWindow && !ownerWindow.isDestroyed()
    ? ownerWindow
    : BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

// 安全弹出保存对话框，自动处理窗口可用性
export async function showSaveDialogSafe(
  options: SaveDialogOptions,
  ownerWindow?: BrowserWindow | null
): Promise<SaveDialogReturnValue> {
  const window = getDialogOwner(ownerWindow)

  return window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
}

// 安全弹出打开文件对话框，自动处理窗口可用性
export async function showOpenDialogSafe(
  options: OpenDialogOptions,
  ownerWindow?: BrowserWindow | null
): Promise<OpenDialogReturnValue> {
  const window = getDialogOwner(ownerWindow)

  return window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
}
