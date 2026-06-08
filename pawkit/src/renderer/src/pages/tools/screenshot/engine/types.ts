export interface CapturePoint {
  x: number
  y: number
}

export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CaptureSize {
  width: number
  height: number
}

export type ResizeDirection =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export type CaptureTool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'pen'
  | 'text'
  | 'mosaic'

interface AnnotationBase {
  id: string
  type: Exclude<CaptureTool, 'select'>
}

export interface LineAnnotation extends AnnotationBase {
  type: 'pen' | 'arrow'
  points: CapturePoint[]
  color: string
  strokeWidth: number
}

export interface ShapeAnnotation extends AnnotationBase {
  type: 'rect' | 'ellipse'
  rect: CaptureRect
  color: string
  strokeWidth: number
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  point: CapturePoint
  text: string
  color: string
  fontSize: number
}

export interface MosaicAnnotation extends AnnotationBase {
  type: 'mosaic'
  rect: CaptureRect
}

export type CaptureAnnotation =
  | LineAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | MosaicAnnotation

export type CaptureDraft =
  | LineAnnotation
  | ShapeAnnotation
  | MosaicAnnotation

export interface CaptureEditorState {
  phase: 'idle' | 'selecting' | 'editing' | 'drawing' | 'typing'
  tool: CaptureTool
  selection: CaptureRect | null
  annotations: CaptureAnnotation[]
  past: CaptureAnnotation[][]
  future: CaptureAnnotation[][]
  selectedId: string | null
  draft: CaptureDraft | null
}
