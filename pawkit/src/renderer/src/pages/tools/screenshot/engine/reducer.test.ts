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
})
