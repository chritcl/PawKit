import { desktopCapturer, screen } from 'electron'
import type { Display } from 'electron'
import type { WindowBounds } from '../../shared/types'

// 捕获后的单显示器数据
export interface CapturedDisplaySource {
  displayId: string
  dataUrl: string
  bounds: WindowBounds
  scaleFactor: number
  width: number
  height: number
}

// 一次性冻结所有显示器
export async function captureAllDisplays(): Promise<CapturedDisplaySource[]> {
  const displays = screen.getAllDisplays()
  if (displays.length === 0) return []

  const maxSize = displays.reduce((result, display) => ({
    width: Math.max(result.width, Math.round(display.bounds.width * display.scaleFactor)),
    height: Math.max(result.height, Math.round(display.bounds.height * display.scaleFactor))
  }), { width: 1, height: 1 })

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: maxSize
  })

  return displays.flatMap((display, index) => {
    const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[index]
    if (!source || source.thumbnail.isEmpty()) return []
    return [createDisplaySource(display, source.thumbnail)]
  })
}

// 将 Electron 屏幕源转换为稳定的显示器数据
function createDisplaySource(
  display: Display,
  thumbnail: Electron.NativeImage
): CapturedDisplaySource {
  const width = Math.max(1, Math.round(display.bounds.width * display.scaleFactor))
  const height = Math.max(1, Math.round(display.bounds.height * display.scaleFactor))
  const image = thumbnail.getSize().width === width && thumbnail.getSize().height === height
    ? thumbnail
    : thumbnail.resize({ width, height, quality: 'best' })

  return {
    displayId: String(display.id),
    dataUrl: image.toDataURL(),
    bounds: display.bounds as WindowBounds,
    scaleFactor: display.scaleFactor,
    width,
    height
  }
}
