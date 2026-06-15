import { describe, expect, it } from 'vitest'
import { captureEditorReducer, createInitialCaptureEditorState } from './reducer'
import type { CaptureAnnotation } from './types'

const annotation: CaptureAnnotation = {
  id: 'rect',
  type: 'rect',
  rect: { x: 10, y: 10, width: 100, height: 80 },
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
  points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
  brushSize: 20,
  strength: 10
}

describe('全新截图状态机', () => {
  it('替换选区时清空标注历史', () => {
    const state = captureEditorReducer({
      ...createInitialCaptureEditorState(),
      annotations: [annotation],
      past: [[]]
    }, {
      type: 'set-selection',
      selection: { x: 0, y: 0, width: 200, height: 100 },
      clearAnnotations: true
    })
    expect(state.annotations).toEqual([])
    expect(state.past).toEqual([])
  })

  it('支持标注撤销与重做', () => {
    const committed = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'commit-annotations',
      annotations: [annotation]
    })
    const undone = captureEditorReducer(committed, { type: 'undo' })
    const redone = captureEditorReducer(undone, { type: 'redo' })
    expect(undone.annotations).toEqual([])
    expect(redone.annotations).toEqual([annotation])
  })

  it('预览移动不写入历史', () => {
    const state = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'preview-annotations',
      annotations: [annotation]
    })
    expect(state.annotations).toEqual([annotation])
    expect(state.past).toEqual([])
  })

  it('切换工具时取消选中但不清除标注', () => {
    const state = captureEditorReducer({
      ...createInitialCaptureEditorState(),
      annotations: [annotation],
      selectedId: 'rect'
    }, {
      type: 'set-tool',
      tool: 'ellipse'
    })
    expect(state.selectedId).toBeNull()
    expect(state.annotations).toEqual([annotation])
    expect(state.tool).toBe('ellipse')
  })

  it('新建标注后自动选中', () => {
    const state = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'commit-annotations',
      annotations: [annotation],
      selectedId: 'rect'
    })
    expect(state.selectedId).toBe('rect')
    expect(state.annotations).toEqual([annotation])
  })

  it('修改工具样式不影响其他工具', () => {
    const state = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'set-tool-style',
      tool: 'rect',
      patch: { color: '#00ff00' }
    })
    expect(state.toolStyles.rect.color).toBe('#00ff00')
    expect(state.toolStyles.ellipse.color).toBe('#ff4d4f')
    expect(state.toolStyles.arrow.color).toBe('#ff4d4f')
  })

  it('修改选中标注样式写入历史', () => {
    const state = captureEditorReducer({
      ...createInitialCaptureEditorState(),
      annotations: [annotation],
      selectedId: 'rect'
    }, {
      type: 'update-selected-style',
      patch: { color: '#0000ff' }
    })
    expect((state.annotations[0] as { color: string }).color).toBe('#0000ff')
    expect(state.past.length).toBe(1)
    expect(state.future).toEqual([])
  })

  it('未选中时修改样式不影响标注', () => {
    const state = captureEditorReducer({
      ...createInitialCaptureEditorState(),
      annotations: [annotation],
      selectedId: null
    }, {
      type: 'update-selected-style',
      patch: { color: '#0000ff' }
    })
    expect((state.annotations[0] as { color: string }).color).toBe('#ff0000')
  })

  it('序号计数器递增和重置', () => {
    const state1 = captureEditorReducer(createInitialCaptureEditorState(), { type: 'increment-step' })
    expect(state1.stepCounter).toBe(2)
    const state2 = captureEditorReducer(state1, { type: 'increment-step' })
    expect(state2.stepCounter).toBe(3)
    const reset = captureEditorReducer(state2, { type: 'reset-step-counter' })
    expect(reset.stepCounter).toBe(1)
  })

  it('支持步骤序号标注', () => {
    const state = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'commit-annotations',
      annotations: [stepAnnotation]
    })
    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0].type).toBe('step')
  })

  it('支持涂抹马赛克标注', () => {
    const state = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'commit-annotations',
      annotations: [mosaicPaintAnnotation]
    })
    expect(state.annotations).toHaveLength(1)
    expect(state.annotations[0].type).toBe('mosaic-paint')
  })

  it('撤销支持涂抹马赛克和步骤序号', () => {
    let state = captureEditorReducer(createInitialCaptureEditorState(), {
      type: 'commit-annotations',
      annotations: [stepAnnotation]
    })
    state = captureEditorReducer(state, {
      type: 'commit-annotations',
      annotations: [stepAnnotation, mosaicPaintAnnotation]
    })
    expect(state.annotations).toHaveLength(2)
    const undone = captureEditorReducer(state, { type: 'undo' })
    expect(undone.annotations).toHaveLength(1)
    expect(undone.annotations[0].type).toBe('step')
  })
})
