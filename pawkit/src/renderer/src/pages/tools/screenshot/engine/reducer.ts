import type {
  CaptureAnnotation,
  CaptureDraft,
  CaptureEditorState,
  CaptureRect,
  CaptureTool,
  ToolStyleMap
} from './types'

export type CaptureEditorAction =
  | { type: 'set-phase'; phase: CaptureEditorState['phase'] }
  | { type: 'set-tool'; tool: CaptureTool }
  | { type: 'set-selection'; selection: CaptureRect | null; clearAnnotations?: boolean }
  | { type: 'set-selected'; id: string | null }
  | { type: 'set-draft'; draft: CaptureDraft | null }
  | { type: 'preview-annotations'; annotations: CaptureAnnotation[] }
  | { type: 'commit-annotations'; annotations: CaptureAnnotation[]; previous?: CaptureAnnotation[]; selectedId?: string | null }
  | { type: 'set-tool-style'; tool: keyof ToolStyleMap; patch: Partial<ToolStyleMap[keyof ToolStyleMap]> }
  | { type: 'update-selected-style'; patch: Record<string, unknown> }
  | { type: 'increment-step' }
  | { type: 'reset-step-counter' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }

export function createInitialCaptureEditorState(): CaptureEditorState {
  return {
    phase: 'idle',
    tool: 'select',
    selection: null,
    annotations: [],
    past: [],
    future: [],
    selectedId: null,
    draft: null,
    toolStyles: {
      rect: { color: '#ff4d4f', strokeWidth: 4, dashed: false, fillColor: null },
      ellipse: { color: '#ff4d4f', strokeWidth: 4, dashed: false, fillColor: null },
      arrow: { color: '#ff4d4f', strokeWidth: 4, arrowSize: 16 },
      pen: { color: '#ff4d4f', strokeWidth: 4 },
      text: { color: '#ff4d4f', fontSize: 20, bold: false, bgColor: null, align: 'left' },
      mosaic: { brushSize: 20, strength: 10, mode: 'pixelate' },
      step: { color: '#ffffff', bgColor: '#ff4d4f', size: 28 }
    },
    stepCounter: 1
  }
}

export function captureEditorReducer(
  state: CaptureEditorState,
  action: CaptureEditorAction
): CaptureEditorState {
  switch (action.type) {
    case 'set-phase':
      return { ...state, phase: action.phase }
    case 'set-tool':
      return { ...state, tool: action.tool, selectedId: null, draft: null }
    case 'set-selection':
      return {
        ...state,
        selection: action.selection,
        phase: action.selection ? 'editing' : 'idle',
        annotations: action.clearAnnotations ? [] : state.annotations,
        past: action.clearAnnotations ? [] : state.past,
        future: action.clearAnnotations ? [] : state.future,
        selectedId: null,
        draft: null
      }
    case 'set-selected':
      return { ...state, selectedId: action.id }
    case 'set-draft':
      return { ...state, draft: action.draft, phase: action.draft ? 'drawing' : 'editing' }
    case 'preview-annotations':
      return { ...state, annotations: action.annotations }
    case 'commit-annotations':
      return {
        ...state,
        annotations: action.annotations,
        past: [...state.past, action.previous ?? state.annotations],
        future: [],
        selectedId: action.selectedId !== undefined ? action.selectedId : null,
        draft: null,
        phase: 'editing'
      }
    case 'set-tool-style': {
      const current = state.toolStyles[action.tool]
      return {
        ...state,
        toolStyles: {
          ...state.toolStyles,
          [action.tool]: { ...current, ...action.patch }
        }
      }
    }
    case 'update-selected-style': {
      if (!state.selectedId) return state
      const updated = state.annotations.map((annotation) =>
        annotation.id === state.selectedId
          ? { ...annotation, ...action.patch }
          : annotation
      )
      return {
        ...state,
        annotations: updated,
        past: [...state.past, state.annotations],
        future: []
      }
    }
    case 'increment-step':
      return { ...state, stepCounter: state.stepCounter + 1 }
    case 'reset-step-counter':
      return { ...state, stepCounter: 1 }
    case 'undo':
      if (state.past.length === 0) return state
      return {
        ...state,
        annotations: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [state.annotations, ...state.future],
        selectedId: null
      }
    case 'redo':
      if (state.future.length === 0) return state
      return {
        ...state,
        annotations: state.future[0],
        past: [...state.past, state.annotations],
        future: state.future.slice(1),
        selectedId: null
      }
    case 'reset':
      return createInitialCaptureEditorState()
    default:
      return state
  }
}
