import { describe, expect, it } from 'vitest'
import {
  createTextAnnotation,
  getAnnotationBounds,
  hitTestAnnotation,
  moveAnnotation,
  updateAnnotationStyle
} from './annotations'
import type { CaptureAnnotation, TextStyle } from './types'

const rectAnnotation: CaptureAnnotation = {
  id: 'rect',
  type: 'rect',
  rect: { x: 10, y: 20, width: 100, height: 80 },
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

const textStyle: TextStyle = {
  color: '#00ff00',
  fontSize: 24,
  bold: true,
  bgColor: 'rgba(0,0,0,0.5)',
  align: 'center'
}

describe('全新截图标注引擎', () => {
  it('计算矩形边界', () => {
    expect(getAnnotationBounds(rectAnnotation)).toEqual({ x: 10, y: 20, width: 100, height: 80 })
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

  it('计算步骤序号边界', () => {
    const bounds = getAnnotationBounds(stepAnnotation)
    expect(bounds.x).toBe(22)
    expect(bounds.y).toBe(22)
    expect(bounds.width).toBe(56)
    expect(bounds.height).toBe(56)
  })

  it('计算涂抹马赛克边界', () => {
    const bounds = getAnnotationBounds(mosaicPaintAnnotation)
    expect(bounds.x).toBe(0)
    expect(bounds.y).toBe(0)
    expect(bounds.width).toBe(40)
    expect(bounds.height).toBe(30)
  })

  it('计算多行文字边界', () => {
    const multiline: CaptureAnnotation = {
      id: 'text2',
      type: 'text',
      rect: { x: 0, y: 0, width: 160, height: 94 },
      text: '第一行\n第二行\n第三行',
      color: '#fff',
      fontSize: 20,
      lineHeight: 28
    }
    const bounds = getAnnotationBounds(multiline)
    expect(bounds.height).toBeGreaterThan(20 * 1.4 * 2)
  })

  it('空白文字不生成标注', () => {
    expect(createTextAnnotation({
      id: 'text',
      point: { x: 10, y: 20 },
      value: '  \n\t  ',
      style: textStyle
    })).toBeNull()
  })

  it('生成多行中文文字标注并写入当前样式', () => {
    const annotation = createTextAnnotation({
      id: 'text',
      point: { x: 10, y: 20 },
      value: '第一行\r\n第二行',
      style: textStyle
    })
    expect(annotation).toEqual({
      id: 'text',
      type: 'text',
      rect: { x: 10, y: 20, width: 160, height: 78 },
      text: '第一行\n第二行',
      color: '#00ff00',
      fontSize: 24,
      lineHeight: 34,
      bold: true,
      bgColor: 'rgba(0,0,0,0.5)',
      align: 'center'
    })
  })

  it('命中文字标注矩形区域', () => {
    const annotation = createTextAnnotation({
      id: 'text',
      point: { x: 10, y: 20 },
      value: '说明文字',
      style: textStyle
    })
    expect(annotation).not.toBeNull()
    expect(hitTestAnnotation([annotation!], { x: 20, y: 30 })?.id).toBe('text')
    expect(hitTestAnnotation([annotation!], { x: 220, y: 30 })).toBeNull()
  })

  it('移动文字标注时更新矩形位置', () => {
    const annotation = createTextAnnotation({
      id: 'text',
      point: { x: 10, y: 20 },
      value: '说明文字',
      style: textStyle
    })
    const moved = moveAnnotation(annotation!, { x: 15, y: -5 })
    expect(getAnnotationBounds(moved).x).toBe(25)
    expect(getAnnotationBounds(moved).y).toBe(15)
  })

  it('更新文字样式时重新计算尺寸和行高', () => {
    const annotation = createTextAnnotation({
      id: 'text',
      point: { x: 10, y: 20 },
      value: '说明文字',
      style: textStyle
    })
    const updated = updateAnnotationStyle(annotation!, { fontSize: 30 })
    expect(updated.type).toBe('text')
    if (updated.type === 'text') {
      expect(updated.lineHeight).toBe(42)
      expect(updated.rect.height).toBe(52)
    }
  })
})
