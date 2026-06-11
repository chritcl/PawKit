import type {
  CaptureAnnotation,
  CaptureDraft,
  CaptureEditorState,
  CaptureRect,
  CaptureTool
} from './types'

export type CaptureEditorAction =
  | { type: 'set-phase'; phase: CaptureEditorState['phase'] }
  | { type: 'set-tool'; tool: CaptureTool }
  | { type: 'set-selection'; selection: CaptureRect | null; clearAnnotations?: boolean }
  | { type: 'set-selected'; id: string | null }
  | { type: 'set-draft'; draft: CaptureDraft | null }
  | { type: 'preview-annotations'; annotations: CaptureAnnotation[] }
  | { type: 'commit-annotations'; annotations: CaptureAnnotation[]; previous?: CaptureAnnotation[] }
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
    draft: null
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
        selectedId: null,
        draft: null,
        phase: 'editing'
      }
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
