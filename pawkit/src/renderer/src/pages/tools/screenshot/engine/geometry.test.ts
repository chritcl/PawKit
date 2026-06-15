import { describe, expect, it } from 'vitest'
import {
  clampRect,
  constrainSquare,
  getResizeHandle,
  getToolbarPosition,
  moveRect,
  normalizeRect,
  resizeRect,
  toPixelRect
} from './geometry'

describe('全新截图几何引擎', () => {
  it('支持反向框选', () => {
    expect(normalizeRect({ x: 300, y: 200 }, { x: 100, y: 50 })).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150
    })
  })

  it('限制选区在当前显示器内', () => {
    expect(clampRect(
      { x: -20, y: 680, width: 1200, height: 100 },
      { width: 1000, height: 700 }
    )).toEqual({ x: 0, y: 600, width: 1000, height: 100 })
  })

  it('移动选区时保持尺寸', () => {
    expect(moveRect(
      { x: 100, y: 100, width: 300, height: 200 },
      { x: 900, y: -200 },
      { width: 1000, height: 700 }
    )).toEqual({ x: 700, y: 0, width: 300, height: 200 })
  })

  it('八方向缩放时保持最小尺寸', () => {
    expect(resizeRect(
      { x: 100, y: 100, width: 200, height: 120 },
      'top-left',
      { x: 500, y: 500 },
      { width: 1000, height: 700 },
      20
    )).toEqual({ x: 280, y: 200, width: 20, height: 20 })
  })

  it('识别控制点', () => {
    expect(getResizeHandle(
      { x: 300, y: 220 },
      { x: 100, y: 100, width: 200, height: 120 }
    )).toBe('bottom-right')
  })

  it('工具栏空间不足时显示在选区上方', () => {
    expect(getToolbarPosition(
      { x: 850, y: 600, width: 120, height: 80 },
      { width: 300, height: 48 },
      { width: 1000, height: 700 }
    )).toEqual({ x: 670, y: 542 })
  })

  it('将 CSS 选区映射为高 DPI 物理像素', () => {
    expect(toPixelRect(
      { x: 100, y: 50, width: 200, height: 100 },
      { width: 960, height: 540 },
      { width: 1920, height: 1080 }
    )).toEqual({ x: 200, y: 100, width: 400, height: 200 })
  })

  it('Shift 约束为正方形（右下）', () => {
    const rect = constrainSquare({ x: 100, y: 100 }, { x: 250, y: 180 })
    expect(rect.width).toBe(150)
    expect(rect.height).toBe(150)
    expect(rect.x).toBe(100)
    expect(rect.y).toBe(100)
  })

  it('Shift 约束为正方形（左上）', () => {
    const rect = constrainSquare({ x: 200, y: 200 }, { x: 100, y: 150 })
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(100)
    expect(rect.x).toBe(100)
    expect(rect.y).toBe(100)
  })
})
