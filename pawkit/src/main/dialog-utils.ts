import { BrowserWindow, dialog } from 'electron'
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron'

// 安全弹出保存对话框，自动处理窗口可用性
export async function showSaveDialogSafe(
  options: SaveDialogOptions,
  ownerWindow?: BrowserWindow | null
): Promise<SaveDialogReturnValue> {
  const window = ownerWindow && !ownerWindow.isDestroyed()
    ? ownerWindow
    : BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  return window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
}
