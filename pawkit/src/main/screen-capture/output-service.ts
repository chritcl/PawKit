import { clipboard, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { logger } from '../logger'
import { showSaveDialogSafe } from '../dialog-utils'
import type {
  ScreenCaptureActionRequest,
  ScreenCaptureActionResponse
} from '../../shared/types'

// 执行新版截图输出动作
export async function performScreenCaptureOutput(
  request: ScreenCaptureActionRequest,
  ownerWindow?: BrowserWindow | null
): Promise<ScreenCaptureActionResponse> {
  if (!request.dataUrl.startsWith('data:image/png')) {
    return { status: 'error', message: '截图数据无效' }
  }

  if (request.action === 'copy' || request.action === 'complete') {
    try {
      const image = nativeImage.createFromDataURL(request.dataUrl)
      if (image.isEmpty()) return { status: 'error', message: '截图数据无效' }
      clipboard.writeImage(image)
      return { status: 'copied', message: '已复制到剪贴板' }
    } catch (error) {
      logger.error('复制新版截图失败:', error)
      return { status: 'error', message: '复制截图失败' }
    }
  }

  try {
    const result = await showSaveDialogSafe({
      title: '保存截图',
      defaultPath: `PawKit截图_${formatTimestamp(new Date())}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    }, ownerWindow)

    if (result.canceled || !result.filePath) {
      return { status: 'cancelled', message: '保存已取消' }
    }

    const image = nativeImage.createFromDataURL(request.dataUrl)
    if (image.isEmpty()) return { status: 'error', message: '截图数据无效' }
    await writeFile(result.filePath, image.toPNG())
    return {
      status: 'saved',
      message: '截图已保存',
      path: result.filePath
    }
  } catch (error) {
    logger.error('保存新版截图失败:', error)
    return { status: 'error', message: '保存截图失败' }
  }
}

// 生成适合文件名的时间文本
function formatTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '-',
    pad(date.getSeconds())
  ].join('')
}
