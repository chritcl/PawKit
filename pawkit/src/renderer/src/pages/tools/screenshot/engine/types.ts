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
  | 'step'

export type AnnotationType = Exclude<CaptureTool, 'select'> | 'mosaic-paint'

interface AnnotationBase {
  id: string
  type: AnnotationType
}

export interface LineAnnotation extends AnnotationBase {
  type: 'pen' | 'arrow'
  points: CapturePoint[]
  color: string
  strokeWidth: number
  arrowSize?: number
}

export interface ShapeAnnotation extends AnnotationBase {
  type: 'rect' | 'ellipse'
  rect: CaptureRect
  color: string
  strokeWidth: number
  dashed?: boolean
  fillColor?: string | null
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  rect: CaptureRect
  text: string
  color: string
  fontSize: number
  lineHeight: number
  bold?: boolean
  bgColor?: string | null
  align?: 'left' | 'center' | 'right'
}

export interface MosaicAnnotation extends AnnotationBase {
  type: 'mosaic'
  rect: CaptureRect
}

export interface MosaicPaintAnnotation extends AnnotationBase {
  type: 'mosaic-paint'
  points: CapturePoint[]
  brushSize: number
  strength: number
}

export interface StepAnnotation extends AnnotationBase {
  type: 'step'
  point: CapturePoint
  number: number
  color: string
  bgColor: string
  size: number
}

export type CaptureAnnotation =
  | LineAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | MosaicAnnotation
  | MosaicPaintAnnotation
  | StepAnnotation

export type CaptureDraft =
  | LineAnnotation
  | ShapeAnnotation
  | MosaicAnnotation
  | MosaicPaintAnnotation

export interface RectStyle {
  color: string
  strokeWidth: number
  dashed: boolean
  fillColor: string | null
}

export interface EllipseStyle {
  color: string
  strokeWidth: number
  dashed: boolean
  fillColor: string | null
}

export interface ArrowStyle {
  color: string
  strokeWidth: number
  arrowSize: number
}

export interface PenStyle {
  color: string
  strokeWidth: number
}

export interface TextStyle {
  color: string
  fontSize: number
  bold: boolean
  bgColor: string | null
  align: 'left' | 'center' | 'right'
}

export interface MosaicStyle {
  brushSize: number
  strength: number
  mode: 'pixelate' | 'blur'
}

export interface StepStyle {
  color: string
  bgColor: string
  size: number
}

export interface ToolStyleMap {
  rect: RectStyle
  ellipse: EllipseStyle
  arrow: ArrowStyle
  pen: PenStyle
  text: TextStyle
  mosaic: MosaicStyle
  step: StepStyle
}

export const DEFAULT_TOOL_STYLES: ToolStyleMap = {
  rect: { color: '#ff4d4f', strokeWidth: 4, dashed: false, fillColor: null },
  ellipse: { color: '#ff4d4f', strokeWidth: 4, dashed: false, fillColor: null },
  arrow: { color: '#ff4d4f', strokeWidth: 4, arrowSize: 16 },
  pen: { color: '#ff4d4f', strokeWidth: 4 },
  text: { color: '#ff4d4f', fontSize: 20, bold: false, bgColor: null, align: 'left' },
  mosaic: { brushSize: 20, strength: 10, mode: 'pixelate' },
  step: { color: '#ffffff', bgColor: '#ff4d4f', size: 28 }
}

export interface CaptureEditorState {
  phase: 'idle' | 'selecting' | 'editing' | 'drawing' | 'typing'
  tool: CaptureTool
  selection: CaptureRect | null
  annotations: CaptureAnnotation[]
  past: CaptureAnnotation[][]
  future: CaptureAnnotation[][]
  selectedId: string | null
  draft: CaptureDraft | null
  toolStyles: ToolStyleMap
  stepCounter: number
}
