// 截图坐标点
export interface ScreenshotPoint {
  x: number
  y: number
}

// 截图矩形
export interface ScreenshotRect {
  x: number
  y: number
  width: number
  height: number
}

// 二维尺寸
export interface ScreenshotSize {
  width: number
  height: number
}

// 归一化拖拽矩形
export function normalizeScreenshotRect(
  start: ScreenshotPoint,
  end: ScreenshotPoint
): ScreenshotRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

// 判断选区是否可用
export function isUsableScreenshotRect(rect: ScreenshotRect, minSize = 6): boolean {
  return rect.width >= minSize && rect.height >= minSize
}

// 将覆盖层 CSS 坐标映射为原始截图像素坐标
export function mapCssRectToImageRect(
  rect: ScreenshotRect,
  viewport: ScreenshotSize,
  image: ScreenshotSize
): ScreenshotRect {
  const scaleX = image.width / viewport.width
  const scaleY = image.height / viewport.height

  const x = Math.max(0, Math.round(rect.x * scaleX))
  const y = Math.max(0, Math.round(rect.y * scaleY))
  const right = Math.min(image.width, Math.round((rect.x + rect.width) * scaleX))
  const bottom = Math.min(image.height, Math.round((rect.y + rect.height) * scaleY))

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y)
  }
}

// 计算图片在容器内的等比缩放尺寸
export function fitImageSize(image: ScreenshotSize, maxSize: ScreenshotSize): ScreenshotSize {
  const scale = Math.min(1, maxSize.width / image.width, maxSize.height / image.height)
  return {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale))
  }
}
