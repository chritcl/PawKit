import { describe, expect, it } from 'vitest'
import { getAnnotationBounds, hitTestAnnotation, moveAnnotation } from './annotations'
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
})
