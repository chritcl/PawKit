import { describe, expect, it } from 'vitest'
import {
  fitImageSize,
  isUsableScreenshotRect,
  mapCssRectToImageRect,
  normalizeScreenshotRect
} from './screenshot-geometry'

describe('截图几何工具函数', () => {
  it('归一化反向拖选矩形', () => {
    const rect = normalizeScreenshotRect({ x: 300, y: 200 }, { x: 100, y: 50 })

    expect(rect).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150
    })
  })

  it('识别零面积选区不可用', () => {
    expect(isUsableScreenshotRect({ x: 0, y: 0, width: 0, height: 20 })).toBe(false)
    expect(isUsableScreenshotRect({ x: 0, y: 0, width: 20, height: 20 })).toBe(true)
  })

  it('把 CSS 坐标映射到高 DPI 截图像素', () => {
    const rect = mapCssRectToImageRect(
      { x: 100, y: 50, width: 200, height: 100 },
      { width: 960, height: 540 },
      { width: 1920, height: 1080 }
    )

    expect(rect).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 200
    })
  })

  it('映射时不会超出图片边界', () => {
    const rect = mapCssRectToImageRect(
      { x: 900, y: 500, width: 200, height: 100 },
      { width: 960, height: 540 },
      { width: 1920, height: 1080 }
    )

    expect(rect.width).toBe(120)
    expect(rect.height).toBe(80)
  })

  it('等比缩放图片尺寸', () => {
    expect(fitImageSize(
      { width: 1920, height: 1080 },
      { width: 960, height: 600 }
    )).toEqual({
      width: 960,
      height: 540
    })
  })
})
