import { describe, expect, it } from 'vitest'
import {
  getAnnotationBounds,
  hitTestAnnotation,
  hitTestAnnotationResizeHandle,
  hitTestArrowEndpoint,
  moveAnnotation,
  resizeAnnotation,
  dragArrowEndpoint
} from './annotations'
import type { CaptureAnnotation } from './types'

const annotations: CaptureAnnotation[] = [
  {
    id: 'rect',
    type: 'rect',
    rect: { x: 10, y: 20, width: 100, height: 80 },
    color: '#ff0000',
    strokeWidth: 4
  },
  {
    id: 'text',
    type: 'text',
    point: { x: 30, y: 40 },
    text: '说明',
    color: '#ffffff',
    fontSize: 20
  }
]

const arrowAnnotation: CaptureAnnotation = {
  id: 'arrow1',
  type: 'arrow',
  points: [{ x: 10, y: 10 }, { x: 100, y: 100 }],
  color: '#ff0000',
  strokeWidth: 4
}

const stepAnnotation: CaptureAnnotation = {
  id: 'step1',
  type: 'step',
  point: { x: 50, y: 50 },
  number: 1,
  color: '#ffffff',
  bgColor: '#ff4d4f',
  size: 28
}

const mosaicPaintAnnotation: CaptureAnnotation = {
  id: 'mosaic1',
  type: 'mosaic-paint',
  points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 15 }],
  brushSize: 20,
  strength: 10
}

describe('全新截图标注引擎', () => {
  it('从顶层开始命中标注', () => {
    expect(hitTestAnnotation(annotations, { x: 35, y: 45 })?.id).toBe('text')
  })

  it('计算画笔边界', () => {
    expect(getAnnotationBounds({
      id: 'pen',
      type: 'pen',
      points: [{ x: 20, y: 40 }, { x: 100, y: 90 }],
      color: '#fff',
      strokeWidth: 4
    })).toEqual({ x: 20, y: 40, width: 80, height: 50 })
  })

  it('移动标注不改变原对象', () => {
    const moved = moveAnnotation(annotations[0], { x: 20, y: -10 })
    expect(getAnnotationBounds(moved)).toEqual({ x: 30, y: 10, width: 100, height: 80 })
    expect(getAnnotationBounds(annotations[0])).toEqual({ x: 10, y: 20, width: 100, height: 80 })
  })

  it('计算步骤序号边界', () => {
    const bounds = getAnnotationBounds(stepAnnotation)
    expect(bounds.x).toBe(22)
    expect(bounds.y).toBe(22)
    expect(bounds.width).toBe(56)
    expect(bounds.height).toBe(56)
  })

  it('命中测试步骤序号', () => {
    expect(hitTestAnnotation([stepAnnotation], { x: 50, y: 50 })?.id).toBe('step1')
    expect(hitTestAnnotation([stepAnnotation], { x: 50, y: 80 })?.id).toBe('step1')
    expect(hitTestAnnotation([stepAnnotation], { x: 50, y: 90 })).toBeNull()
  })

  it('移动步骤序号', () => {
    const moved = moveAnnotation(stepAnnotation, { x: 10, y: -5 })
    expect((moved as { point: { x: number; y: number } }).point).toEqual({ x: 60, y: 45 })
  })

  it('计算涂抹马赛克边界', () => {
    const bounds = getAnnotationBounds(mosaicPaintAnnotation)
    expect(bounds.x).toBe(0)
    expect(bounds.y).toBe(0)
    expect(bounds.width).toBe(40)
    expect(bounds.height).toBe(30)
  })

  it('移动涂抹马赛克', () => {
    const moved = moveAnnotation(mosaicPaintAnnotation, { x: 5, y: 5 })
    expect((moved as { points: Array<{ x: number; y: number }> }).points[0]).toEqual({ x: 15, y: 15 })
  })

  it('缩放矩形标注', () => {
    const rect = annotations[0]
    const resized = resizeAnnotation(rect, 'bottom-right', { x: 20, y: 30 })
    expect((resized as { rect: { width: number; height: number } }).rect.width).toBe(120)
    expect((resized as { rect: { width: number; height: number } }).rect.height).toBe(110)
  })

  it('非矩形标注缩放返回原对象', () => {
    const resized = resizeAnnotation(arrowAnnotation, 'bottom-right', { x: 20, y: 30 })
    expect(resized).toBe(arrowAnnotation)
  })

  it('命中测试矩形缩放手柄', () => {
    const rect = annotations[0]
    expect(hitTestAnnotationResizeHandle(rect, { x: 110, y: 100 })).toBe('bottom-right')
    expect(hitTestAnnotationResizeHandle(rect, { x: 10, y: 20 })).toBe('top-left')
    expect(hitTestAnnotationResizeHandle(rect, { x: 60, y: 20 })).toBe('top')
    expect(hitTestAnnotationResizeHandle(rect, { x: 200, y: 200 })).toBeNull()
  })

  it('非矩形标注无缩放手柄', () => {
    expect(hitTestAnnotationResizeHandle(arrowAnnotation, { x: 10, y: 10 })).toBeNull()
  })

  it('命中测试箭头端点', () => {
    expect(hitTestArrowEndpoint(arrowAnnotation, { x: 10, y: 10 })).toBe(0)
    expect(hitTestArrowEndpoint(arrowAnnotation, { x: 100, y: 100 })).toBe(1)
    expect(hitTestArrowEndpoint(arrowAnnotation, { x: 50, y: 50 })).toBeNull()
  })

  it('拖动箭头端点', () => {
    const moved = dragArrowEndpoint(arrowAnnotation, 0, { x: 5, y: 5 })
    expect((moved as { points: Array<{ x: number; y: number }> }).points[0]).toEqual({ x: 5, y: 5 })
    expect((moved as { points: Array<{ x: number; y: number }> }).points[1]).toEqual({ x: 100, y: 100 })
  })

  it('非箭头标注拖动端点返回原对象', () => {
    const result = dragArrowEndpoint(annotations[0], 0, { x: 5, y: 5 })
    expect(result).toBe(annotations[0])
  })

  it('计算多行文字边界', () => {
    const multiline: CaptureAnnotation = {
      id: 'text2',
      type: 'text',
      point: { x: 0, y: 0 },
      text: '第一行\n第二行\n第三行',
      color: '#fff',
      fontSize: 20
    }
    const bounds = getAnnotationBounds(multiline)
    expect(bounds.height).toBeGreaterThan(20 * 1.4 * 2)
  })
})
