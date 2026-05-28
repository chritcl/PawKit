import { desktopCapturer, clipboard, nativeImage, dialog, BrowserWindow, screen } from 'electron'
import { writeFile } from 'fs/promises'
import { ScreenshotResult } from '../shared/types'

// 获取主屏幕尺寸（考虑高 DPI）
function getPrimaryScreenSize(): { width: number; height: number } {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const scaleFactor = primaryDisplay.scaleFactor
  return {
    width: width * scaleFactor,
    height: height * scaleFactor
  }
}

// 全屏截图
export async function captureFullScreen(): Promise<ScreenshotResult> {
  const screenSize = getPrimaryScreenSize()

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: screenSize
  })

  if (sources.length === 0) {
    throw new Error('没有找到屏幕源')
  }

  // 查找主屏幕源（通过 display_id 或名称匹配）
  const primaryDisplay = screen.getPrimaryDisplay()
  let primarySource = sources.find(
    (source) => source.display_id === String(primaryDisplay.id)
  )

  // 如果找不到匹配的主屏幕，使用第一个源
  if (!primarySource) {
    primarySource = sources[0]
  }

  const thumbnail = primarySource.thumbnail

  return {
    dataUrl: thumbnail.toDataURL(),
    width: thumbnail.getSize().width,
    height: thumbnail.getSize().height,
    createdAt: new Date().toISOString()
  }
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
export async function saveImage(dataUrl: string): Promise<{ success: boolean; path?: string }> {
  try {
    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(window!, {
      title: '保存截图',
      defaultPath: `screenshot-${Date.now()}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    const image = nativeImage.createFromDataURL(dataUrl)
    const buffer = image.toPNG()
    await writeFile(result.filePath, buffer)

    return { success: true, path: result.filePath }
  } catch (error) {
    console.error('保存图片失败:', error)
    return { success: false }
  }
}
